# MongoDB → Oracle AI Database 26ai migration guide

This is the reproduction guide for the migration that ships with this repository: a MERN ecommerce
application moved from MongoDB to Oracle AI Database 26ai through the **Oracle Database API for
MongoDB**, verified document by document, and then extended with JSON-relational duality views,
JSON validity checks and in-database AI.

The guide follows Oracle's migration process — **plan, prepare, execute, validate** — and uses the
standard MongoDB tools (`mongodump` / `mongorestore`), exactly as described in the
[Quick Start Guide for MongoDB Migrations](https://docs.oracle.com/en/database/oracle/mdbqs/index.html).

---

## 0. Architecture used in this run

| Layer | Component |
|---|---|
| Source | MongoDB 8.0 (`mern_ecommerce`, 12 collections, 204 documents) |
| Migration tooling | `mongodump` / `mongorestore` (MongoDB Database Tools 100.x) |
| Target | Oracle Autonomous AI Database 26ai — `23.26.3.3.0` |
| Target schemas | `MERN26` (JSON collections, MongoDB API enabled) · `MERN26DV` (duality views) |
| Application | Express + Mongoose API (`mern-ecommerce/server`) · React 19 client (`mern-ecommerce/web`) |

```
MongoDB  ──mongodump──►  dump/mern_ecommerce  ──mongorestore──►  MERN26 (JSON collections)
                                                                  │
                                            DBMS_JSON_DUALITY ────┤──► MERN26DV (duality views)
                                            JSON_VALUE views ─────┤──► relational views
                                            DBMS_JSON_SCHEMA ─────┴──► validity views
```

---

## 1. Plan

The deck's planning step (slide 7) is: *profile the workload, review the application code,
`db.serverStatus()`, `db.setProfilingLevel()`, review operators & operation support, review
supported frameworks.* All of it runs on this workstation against the source database with
`mern-ecommerce/server/scripts/assess_workload.js` — a mongosh script with no dependencies.

### 1.1 `db.serverStatus()` — what the source looks like

```bash
ASSESS_MODE=status mongosh "mongodb://127.0.0.1:27017/mern_ecommerce" \
    --file mern-ecommerce/server/scripts/assess_workload.js
```

Reference output (2026-09-30, quiet source — the 204-document reference set):

```
version            : 8.0.10
host / process     : jasper / ...\.tools\mongodb-win32-x86_64-windows-8.0.10\bin\mongod.exe
uptime             : 699 s
connections        : current 12, available 999988, totalCreated 79
storageEngine      : wiredTiger
opcounters         : {insert=34, query=1091, update=37, delete=73, getmore=19, command=329}
opcountersRepl     : {insert=0, query=0, update=0, delete=0, getmore=0, command=0}
network bytes      : in 413035, out 1793468, requests 1548
mem resident       : 355 MB
```

with the per-collection counts of the source (12 collections; 204 documents in the reference set).
The runbook version of this capture (`demo-runbook.md` §2.1) adds the per-collection table.

### 1.2 Profile the workload

```bash
ASSESS_MODE=start  mongosh "$SOURCE_URI" --file mern-ecommerce/server/scripts/assess_workload.js
bash _scratch/planning/traffic-readonly.sh http://localhost:3001 3   # read-only browser pass
ASSESS_MODE=report mongosh "$SOURCE_URI" --file mern-ecommerce/server/scripts/assess_workload.js
```

`start` switches the profiler to level 2 (and drops any earlier `system.profile` first —
a client cannot truncate that collection, mongod answers
`cannot write to <db>.system.profile`). `report` switches profiling **off** first and only then
summarises, so the run can never leave profiling enabled.

Summary of the reference run (125 profile entries from 3 rounds of the read-only pass):

```
find           : 71
aggregate      : 50 (pipelines with $lookup: 100, with $sql: 0)

aggregation stages             query operators              expressions
$addFields 150 (26ai)          $gte 100 (19c)               $sum     50 (accumulator)
$match     112 (19c)           $lte  50 (19c)               $size    50
$lookup    100 (26ai, see 1.3) $in   13 (19c)               $cond    50
$unwind     50 (26ai)          $eq    6 (19c)               $eq      50
$project    50 (19c)           $regex 3 (19c)               $divide  50
$sort/$skip/$limit 25 each
```

### 1.3 Review operators and operation support

Every construct above is checked against Oracle's support matrix, and the script prints the verdict
(`every stage, query operator, update operator and expression observed is supported …`). The one
construct with real restrictions is `$lookup`:

> Field `let` is not supported. If the value of `localField` is a field that's *missing* from any
> input documents then an error is raised. If the value of `localField` is an *array*, or if it is a
> field that occurs more than once in an input document, then an error is raised.

That is exactly why the migrated code paths in `server/utils/queries.js` replace the three `$lookup`
stages with `$sql` (see §4.1) — the application's `$lookup` uses `let` in the wishlist pipeline, and
`localField` values are optional on products.

Two more findings worth carrying into a migration plan:

* **`$options` is ignored on the target when it is a separate field next to a regex** — the one
  compatibility defect this workload actually has. Symptom: `GET /api/product/list/search/:name`
  returned 3 products on MongoDB and **0** on Oracle (a `200` with an empty array, so nothing looks
  broken until the storefront search box comes up empty). The runbook tracks how the review surfaces
  it (`demo-runbook.md` §2.3); the probe that settles it is —

  ```
  {name: {$regex: /mug/, $options: 'is'}}  -> 0 documents on Oracle   3 on MongoDB 8.0
  {name: {$regex: 'mug', $options: 'is'}}  -> 0 documents on Oracle   3 on MongoDB 8.0
  {name: {$regex: /mug/i}}                 -> 3 documents on Oracle   3 on MongoDB 8.0
  ```

  Fix (one line): put the flags on the pattern —
  `{ name: { $regex: new RegExp(escapeRegex(name), 'i') }, isActive: true }` in
  `server/routes/api/product.js`. `assess_workload.js` now reports this pattern explicitly
  (`targeted compatibility check: $regex with a separate $options`), so the next migration cycle sees
  it in the plan rather than in the demo. The aggregate path honours `$options`; only `find` ignores it.
* **The `profiler` command does not exist on the target.** Oracle's Feature Support table marks it
  *No* with “Use SQL Monitor for query profiling”. Profile the source; on Oracle use `$sql` +
  `V$SQL`/SQL Monitor.

Sources, fetched 2026-09-30 (*Oracle Database API for MongoDB*, F44905-26):

* Feature Support — <https://docs.oracle.com/en/database/oracle/mongodb-api/mgapi/support-mongodb-apis-operations-and-data-types-reference.html>
* Aggregation Pipelines (`$sql`, `$external`, `$lookup`) — <https://docs.oracle.com/en/database/oracle/mongodb-api/mgapi/pipelines.html>

### 1.4 Review supported frameworks

The API requires a client that supports **load balanced connections**. Minimum versions, with what
this workstation runs:

| Client | Minimum | Here |
|---|---|---|
| mongosh | 0.15.6 | 2.5.1 |
| Database Tools (mongodump/mongorestore) | 100.5.0 | 100.12.0 |
| Node.js driver (via mongoose 6.10.0) | 4.1.0 | 4.x |
| PyMongo (`scripts/verify_migration.py`) | 3.12.0 | 4.18.2 |
| Compass | 1.28.1 | not installed here |

### 1.5 Application code review

The workload assessment points at the code it justifies: `server/utils/queries.js` holds every
aggregation pipeline (three `$lookup`s in the MongoDB branch, three `$sql` stages in the Oracle
branch), `server/services/{oracle,vectorSearch,llm,llmChat}.js` hold the SQL and AI paths, and the
only deployment-time change is the connection string (§4.2).

### 1.6 Clean up after planning

Leave the source as you found it before running any validation: profiling off, and the
`system.profile` collection dropped. A client cannot truncate that collection (mongod answers
`cannot write to <db>.system.profile`), so switch profiling off and `drop()` it — `verify_migration.py`
skips `system.*` and prints `skipped: N MongoDB system collection(s)`, but the demo database should
not keep the artefact.

---

## 2. Prepare

### 2.1 Prerequisites

* MongoDB Database Tools (`mongodump`, `mongorestore`, `mongosh`)
* Node.js 20+ and npm
* Python 3.10+ with `pymongo` (for `scripts/verify_migration.py`)
* Oracle SQLcl 25.2+ on a JRE 11+ (for the SQL scripts and the SQLcl MCP server)
* An Autonomous AI Database 26ai instance with the **MongoDB API** tool enabled
  (*Tool configuration → MongoDB API → Copy public access URL*)

### 2.2 Create the schemas

```bash
# saved SQLcl connections used by the scripts below
sql -name mig26-admin   # ADMIN
sql -name mig26-app     # MERN26
sql -name mig26-dv      # MERN26DV
```

```sql
-- run as ADMIN
@sql/26ai/01_schemas.sql              -- creates MERN26 + MERN26DV, enables ORDS for both
```

**The deck's “enable MongoDB API for user” toggle, two ways.** Slide 8 shows the target-system
preparation as *Enable MongoDB API for user* + *database grants* + *Oracle REST Data Services* +
*Oracle Database API for MongoDB*. That is one ORDS operation, and it can be done from the UI or
from SQL — the script does the second:

| Path | Steps | Equivalent call |
|---|---|---|
| Database Actions (the toggle in the deck) | *Administration → Database Users → (user) → **REST, GraphQL, MongoDB API, and Web access*** → on | enables the schema in ORDS |
| SQL (`sql/26ai/01_schemas.sql`) | run as `ADMIN` | `ORDS.ENABLE_SCHEMA(p_enabled => true, p_schema => 'MERN26', p_url_mapping_type => 'BASE_PATH', p_url_mapping_pattern => 'mern26', p_auto_rest_auth => false)` |

The script is idempotent (it checks `dba_users` first) and also issues the grants the API and the
views need: `GRANT DB_DEVELOPER_ROLE, DWROLE, UNLIMITED TABLESPACE, SODA_APP, CONNECT` to both
`MERN26` and `MERN26DV`; it ends with a `dba_users` status check. The MongoDB API itself ships with
the database — the toggle/ORDS call is what exposes it to a schema.

Oracle documents the mapping and the same call from the ORDS side: the MongoDB concept of a
*database* is an **ORDS-enabled schema**, and an ORDS-enabled user is created with
`create user foo identified by "…"; grant soda_app, create session, create table, create view,
create sequence, create procedure, create job, unlimited tablespace to foo; exec ords.enable_schema;`
— *Oracle REST Data Services Installation and Configuration Guide*, §9 “Enabling and Configuring the
Oracle Database API for MongoDB”
(<https://docs.oracle.com/en/database/oracle/oracle-rest-data-services/25.3/ordig/enabling-and-configuring-oracle-database-api-mongodb.html>).
That page is also where `authMechanism=PLAIN` / `authSource=$external` / `tls=true` (and the
`loadBalanced=true` requirement of the returned connect string) come from.

### 2.3 Point the application at the source database

```bash
cd mern-ecommerce/server
# .env
MONGO_URI=mongodb://127.0.0.1:27017/mern_ecommerce
npm install && npm run seed:db admin@example.com admin123
npm start
```

Exercise the application (browse, register, sell, order, review) so the source database contains a
realistic dataset across all 12 collections. This run produced:

```
addresses 4 · brands 16 · cartitems 15 · carts 8 · categories 13 · contacts 4 · merchants 4
orders 5 · products 112 · reviews 10 · users 7 · wishlists 6        = 204 documents
```

---

## 3. Execute

### 3.1 Dump the MongoDB source

```bash
mongodump --uri "mongodb://127.0.0.1:27017/mern_ecommerce" --out dump
```

### 3.2 Restore into Autonomous through the MongoDB API

The target connection string is the ADB MongoDB API public URL for the *target schema*
(`MERN26`), with the schema password URL-encoded (`#` → `%23`):

```bash
mongorestore \
  --drop --writeConcern '{w:1}' \
  --uri "mongodb://MERN26:<password>@<adb-host>:27017/mern26?loadBalanced=true&retryWrites=false&authMechanism=PLAIN&authSource=%24external&tls=true" \
  dump/mern_ecommerce          # the DATABASE directory - see the note
```

Expected result: `204 document(s) restored successfully. 0 document(s) failed to restore.`

> **The directory argument depends on the URI, and getting it wrong is silent.** `mongorestore`
> switches to “database directory” layout as soon as the target URI names a database — and this URI
> ends in `/mern26`. So the argument above is the **database directory** (`dump/mern_ecommerce`) and
> the target database name comes from the URI. With the dump **root** (`dump`) this form prints
> `don't know what to do with subdirectory "…\mern_ecommerce", skipping…`, restores **0 documents**
> and still exits `0`. Conversely, a URI *without* a database name (`mongodb://127.0.0.1:27017`)
> wants the dump root — that is the form §0.5 of the runbook uses for the local reset. Adding
> `--nsFrom`/`--nsTo` on top of a database-bearing URI changes nothing. Both combinations, and the
> requirement that the dump be fresh, are measured in `demo-runbook.md` §0.5 and §5.2 (Database
> Tools 100.12.0, against the local server and against `MERN26`: 204 restored, 0 failed).

### 3.3 Re-create what depends on the collections

`--drop` replaces the twelve JSON collection **tables**, so everything built on them must be rebuilt
(the vector table is the exception — it is not a Mongo collection, so it survives; re-check it
anyway). Run these in order — measured total ≈ 2 minutes:

```sql
-- run as ADMIN
@sql/26ai/03_grants_after_restore.sql          -- 22 collections granted to MERN26DV
@sql/26ai/03b_grants_duality_to_data.sql       -- 38 MERN26DV objects granted back to MERN26
```

```sql
-- run as MERN26
@sql/26ai/04_relational_views.sql              -- PRODUCT_CATALOG / ORDER_SUMMARY / PRODUCTS_ENRICHED
@sql/26ai/07_validity_views.sql                -- re-infer the JSON schemas: 0 invalid
@sql/26ai/08_ai_vector_store.sql               -- PRODUCT_EMBEDDINGS survives --drop; prove the search
```

```sql
-- run as MERN26DV
@sql/26ai/06_import_duality_views.sql          -- re-import the documents (12/12 MATCH)
@sql/26ai/10_duality_catalog.sql               -- republish the manifest the application reads
```

Measured after the sequence: `verify_migration.py` PASS (204/204), `02_verify_counts.sql` 12/12 MATCH,
`PRODUCTS_ENRICHED` readable through the MongoDB API (112 documents), `/api/admin-db/duality-views`
`inSync=true` for all 12 views, `invalidDocuments: []`, and `POST /api/ai/similar` still ranked by
`VECTOR_DISTANCE`. Skipping the grants is the loudest failure: as `MERN26DV` the collections answer
`ORA-00942: table or view "MERN26"."users" does not exist`, and right after the restore the views
(plus the `products_enriched` synonym) sit at `INVALID` until `04` re-creates them.

### 3.4 Application code: the `$sql` operator

The deck's application-code step is one bullet — *“Use `$sql` operator”* — and this is it, run for
real against the migrated schema:

```javascript
// mongosh "$MONGO_URI"
db.aggregate([{$sql: 'select banner from v$version'}])
[
  { BANNER: 'Oracle AI Database 26ai Enterprise Edition Release 23.26.3.3.0 - Production' }
]
```

The same stage is what the storefront's migrated pipelines use. Against the 112 migrated products:

```javascript
db.aggregate([{$sql: `select (select count(*) from "products") as products,
                             (select count(*) from "users")    as users,
                             (select count(*) from "orders")   as orders
                      from dual`}])
[ { PRODUCTS: 112, USERS: 7, ORDERS: 5 } ]      // USERS/ORDERS track live test traffic
```

`$sql` is an **Oracle extension**: the identical pipeline against the local MongoDB source fails with
`Unrecognized pipeline stage name: '$sql'`. It is also the only way to reach objects that are not
JSON collections, and the only place where `ddl`, `dml` and PL/SQL are allowed (a `$sql` stage that
is the *only* stage in a pipeline and has no starting collection; once it consumes documents it must
be a `SELECT` projecting a single JSON column — see
[Aggregation Pipelines](https://docs.oracle.com/en/database/oracle/mongodb-api/mgapi/pipelines.html)).

Where the application uses it — `mern-ecommerce/server/utils/queries.js`, guarded by
`process.env.MONGO_URI.includes('loadBalanced')`:

| Lines (MongoDB form / Oracle `$sql`) | MongoDB | Oracle |
|---|---|---|
| 19–24 / 25–27 | `$lookup` products → brands | `$sql` `json_mergepatch` + `left outer join brands` |
| 48–53 / 54 | `$lookup` products → reviews | `$sql` … `left outer join reviews` |
| 165–179 / 184–189 | `$lookup` pipeline with `let` | `$sql` … `left outer join wishlists` |

The MongoDB branches use `$lookup`; the Oracle branches use `$sql` because the API's `$lookup`
forbids `let` and errors when `localField` is an array or is missing from any input document (§1.3).

### 3.5 Alternatives that this migration does not demo

* **MongoDB Compass** (≥ 1.28.1) — connect to the ADB MongoDB API URL and browse/migrate the same
  collections; it can run the `$sql` aggregation too. Not installed on the reference workstation.
* **GoldenGate for MongoDB Migrations 23ai** — bulk export/import plus change data capture for
  sources that cannot stop; the deck's CDC option.
* **Bulk export/import** (`mongoexport`/`mongoimport`) — JSON text instead of BSON; slower, and
  type-fidelity needs care (see the normalisation rules in `scripts/verify_migration.py`).

---

## 4. Validate

Two independent checks are provided; both must pass — and **both require a quiet system**. Any
writer (the UAT harness, a human clicking through the storefront) creates rows that exist on one
side for a few seconds and then disappear, which shows up as `missing`/`extra` `_id`s. Stop the
traffic, drop the planning artefacts (§1.6), then compare.

### 4.1 Document-level verification (source vs target)

```bash
python scripts/verify_migration.py \
  --source "mongodb://127.0.0.1:27017/mern_ecommerce" \
  --target "mongodb://MERN26:<password>@<adb-host>:27017/mern26?loadBalanced=true&retryWrites=false&authMechanism=PLAIN&authSource=%24external&tls=true" \
  --report docs/26ai/migration-report.json
```

The script compares, per collection: the `_id` sets, document counts and a canonical hash of every
document (numbers by value, dates/decimals/binary/ObjectId normalised). Result of the reference run:

```
source: mern_ecommerce  (12 collections)
target: mern26  (12 collections, 1 views)  [views: PRODUCTS_ENRICHED]
[OK] addresses … [OK] wishlists
RESULT: PASS - source and target documents match
```

The JSON report is consumed by `GET /api/admin-db/migration-status` and rendered in the
**Migration dashboard** page of the new client.

### 4.2 SQL-level verification (the official count check)

```sql
-- run as ADMIN
@sql/26ai/02_verify_counts.sql
```

Every collection must report `MATCH` and `MISMATCHED_COLLECTIONS` must be `0`.

### 4.3 Update the application endpoint

The deck's *“update application endpoint”* is a one-line change — and the whole cut-over:

```diff
# mern-ecommerce/server/.env
- MONGO_URI=mongodb://127.0.0.1:27017/mern_ecommerce
+ MONGO_URI=mongodb://MERN26:<password>@REDACTED-ADB-TENANT-MERN.adb.us-phoenix-1.oraclecloudapps.com:27017/mern26?loadBalanced=true&retryWrites=false&authMechanism=PLAIN&authSource=$external&tls=true&tlsAllowInvalidCertificates=true
```

`loadBalanced=true` is also the switch that moves `server/utils/queries.js` onto its `$sql` branches
(§3.4), so the connection string is both the endpoint and the feature flag. Restart the API
(`mern-server`) afterwards. The only other environment inputs are the SQL/AI ones
(`ORACLE_*`, `LLM_*`, `SELECT_AI_PROFILE`) documented in section 8.

### 4.4 User acceptance testing

The two backends are exercised with the same harness, one against `:3001` (local MongoDB) and one
against `:3000` (Oracle). The exact invocations — both `api-e2e` runs plus `ui-sweep.js` (every route
renders, full purchase flow through the UI) and `ui-flows.js` (write paths: newsletter, contact,
seller application, wishlist, order, chat, review moderation) — live in `_scratch/e2e/README.md`
§1–§4; the presenter's sequence is `demo-runbook.md` §6.6.

Reference result, 2026-09-30: **96/96 API assertions · 27/27 pages + 8/8 member-flow steps · 13/13
flows · no data drift** on both backends. The suites create and delete their own data and assert that
per-collection counts are unchanged afterwards, so they may run before a demo — but never at the same
time as `verify_migration.py` (§4 of this guide).

Two differences between the backends are expected and documented in `_scratch/e2e/README.md`: the
Oracle side lists `PRODUCTS_ENRICHED` (the JSON collection view, so 13 collections against 12) and
`isLiked` is `false` rather than absent when a user has no wishlist row.

---

## 5. Extend: relational views over the same documents

```sql
-- run as MERN26
@sql/26ai/04_relational_views.sql
```

| Object | Kind | Purpose |
|---|---|---|
| `PRODUCT_CATALOG` | relational view | products joined to brands, typed columns |
| `ACTIVE_PRODUCTS_OVER_50` / `ACTIVE_NONTAXABLE_PRODUCTS` | relational views | inventory monitoring |
| `PRODUCT_REVIEW_STATS` | relational view | review counts and average rating per product |
| `ORDER_SUMMARY` | relational view | orders joined to customers with totals; `order_subtotal` / `order_tax` / `order_total_with_tax` are summed from the same cart lines the application reads (`utils/store.js`), so the view matches `GET /api/order/:id` exactly — e.g. order `683e12bbacee1c7cbfaa2f59`: 1110 / 38.1 / 1148.1, order `6abc425d65ad8983ff9e84bd`: 169.48 / 8.47 / 177.95 |
| `PRODUCTS_ENRICHED` | **JSON collection view** (26ai) | read-only documents with brand + rating, readable through the MongoDB API |

Views and materialized views do not count against the Autonomous JSON Database non-JSON storage
limit, so this is a storage-neutral way to expose the document store to SQL and BI tools.

## 6. Extend: JSON-relational duality views

```sql
-- run as MERN26  (generates one DDL script per collection)
@sql/26ai/05_generate_duality_ddl.sql
```

```bash
# export the generated DDL and create the objects in MERN26DV
python _scratch/export_dv_ddl.py            # or spool DV_GENERATED_DDL
# then execute sql/26ai/generated/duality_ddl/*.sql as MERN26DV
```

```sql
-- run as MERN26DV
@sql/26ai/06_import_duality_views.sql
```

The reference run created 12 duality views and imported all documents with **0 error-log rows**;
the script's own comparison reports `MATCH` for every collection (204 documents).

> **A duality view is a point-in-time copy.** `DBMS_JSON_DUALITY.IMPORT_ALL` fills the views at the
> moment it runs, so any document written through the MongoDB API *afterwards* is missing from the
> view until `06` is re-run (measured on the live instance after the UAT suite had written:
> `users`, `addresses`, `carts` and `orders` one pending document each, `stale` 0, the other eight
> views in sync). The script's own `MATCH` comparison is therefore only green immediately after an
> import — re-run `06_import_duality_views.sql` before a demo, and treat “N pending” as drift, not
> as a migration defect. `/api/admin-db/duality-views` reports this as
> `collectionDocuments` / `pending` / `stale` / `inSync`.

## 7. Extend: JSON validity views

```sql
-- run as ADMIN first (cross-schema grants), then as MERN26
@sql/26ai/03b_grants_duality_to_data.sql
@sql/26ai/07_validity_views.sql
```

A JSON schema is inferred for every collection from its duality view
(`DBMS_JSON_SCHEMA.DESCRIBE`), stored in `JSON_SCHEMAS`, and each document is validated with
`DBMS_JSON_SCHEMA.IS_VALID`. `DOCUMENT_VALIDITY` reports per-collection totals; the
`*_VALIDITY` views list offending documents with a `VALIDATE_REPORT`. Reference run: **132/132
documents valid, 0 invalid**.

## 8. Extend: AI inside the database

```sql
-- run as MERN26
@sql/26ai/08_ai_vector_store.sql     -- VECTOR column + similarity query
@sql/26ai/09_select_ai.sql           -- Select AI profile (needs the key file below)
```

`09_select_ai.sql` reads the provider key from `sql/26ai/09_select_ai_key.sql`, which is **not**
committed: copy `09_select_ai_key.sql.example`, put your OCI Generative AI API key in it, and run the
one-time ADMIN ACL step (`@sql/26ai/09b_select_ai_acl.sql`) first. Both scripts are re-runnable — the
credential and the profile are dropped and re-created, which is also how a changed `object_list`
(e.g. adding `categories`) reaches the live profile. Reference run: 15 s + 37 s, `MERN_LLM` `ENABLED`,
`showsql` planning `SELECT JSON_VALUE(c."DATA", '$.name') … FROM "MERN26"."categories"`.

### 8.1 Embedding model inside the schema (no API key, no data egress)

`onnx2oracle` (jasperan/onnx2oracle) builds the augmented ONNX graph — tokenizer, transformer,
mean pooling and L2 normalization in one graph — and pushes the bytes straight into
`DBMS_VECTOR.LOAD_ONNX_MODEL`, so the model lands in the *application* schema:

```bash
# as ADMIN, once per application schema
grant execute on dbms_vector to MERN26;
grant create mining model to MERN26;

# loader environment (the package pulls onnxruntime-extensions + transformers)
python -m venv .tools/onnx2oracle-venv
.tools/onnx2oracle-venv/Scripts/pip install onnx2oracle

# build + upload all-MiniLM-L12-v2 (384 dims) into MERN26
.tools/onnx2oracle-venv/Scripts/python mern-ecommerce/server/scripts/load_onnx_embedding.py \
    MERN26 '<schema password>' 'tcps://<adb-host>:1522/<service_name>'
```

Two wrinkles this run hit, both handled by that script:

* the `onnx2oracle` CLI parses `user/pw@host:port/service`, which cannot express the walletless
  TLS endpoint Autonomous Database exposes (`tcps://`), so the script connects with
  `python-oracledb` itself and calls `DBMS_VECTOR.LOAD_ONNX_MODEL` with the same metadata;
* `build_augmented()` deletes its scratch `.onnx` while ONNX still holds the handle, which raises
  `WinError 32` on Windows after the bytes are already in memory — the script makes that unlink
  best-effort.

**Platform constraint worth knowing:** `DATA_PUMP_DIR` is per-schema in Autonomous Database, so
exporting a model from `ADMIN` (`DBMS_DATA_MINING.EXPORT_MODEL`) and importing it into `MERN26`
fails (`ORA-40223` / `ORA-31627`) even with `GRANT READ ON DIRECTORY`. Mining models also cannot be
granted across schemas (`GRANT SELECT ON <model>` → `ORA-00942`). Load the model into each schema
that needs it.

```bash
# embeddings: in-database ONNX model (112 products, 384 dims)
VECTOR_EMBEDDING_MODEL=ALL_MINILM_L12_V2 node scripts/embed_catalog.js
# … or an OpenAI-compatible embedding endpoint
node scripts/embed_catalog.js
```

| Endpoint | Backing feature |
|---|---|
| `GET /api/ai/status` | configuration report: `{llm:{configured,provider,baseUrl,model,embeddingModel,hint}, embeddings:{inDatabaseModel,dimension,table,remoteModel}, selectAi:{profile,configured}}` — live values `MERN_LLM`, `xai.grok-4.3`, `ALL_MINILM_L12_V2`/384/`PRODUCT_EMBEDDINGS` |
| `POST /api/ai/similar` | `VECTOR_DISTANCE` over `PRODUCT_EMBEDDINGS` (in-database ranking) |
| `POST /api/ai/ask` | Oracle Select AI (`DBMS_CLOUD_AI.GENERATE`) natural-language SQL |
| `POST /api/chat` | RAG: in-database retrieval + OpenAI-compatible chat model |

Configure the provider in `mern-ecommerce/server/.env`. OCI Generative AI is the default workshop
setup — `LLM_PROVIDER=oci`, `OCI_GENAI_ENDPOINT` (a bare region URL; the client appends
`/openai/v1`), `OCI_GENAI_API_KEY` and `LLM_MODEL` (e.g. `xai.grok-4.3`). Any other
OpenAI-compatible provider works through `LLM_BASE_URL` + `LLM_API_KEY`, which override the OCI
settings. `LLM_EMBEDDING_MODEL` and `SELECT_AI_PROFILE` are optional extras. Similarity search
needs no provider key at all once the ONNX model is loaded; Select AI and chat generation do, and
without a key those endpoints return an explicit configuration hint instead of failing silently.
The chat service also degrades to keyword retrieval over the same JSON collections when no
embedding model is configured, and reports which path it used.

---

## 9. Run the migrated application

```bash
cd mern-ecommerce/server && npm install && npm start     # API on :3000, MongoDB API → MERN26
cd mern-ecommerce/web && npm install && npm run dev      # client on :8080
```

No application code changes were needed for the migration itself: the only difference is the
connection string (`MONGO_URI`). The aggregation pipelines used by the storefront run through the
Oracle MongoDB API; stages that MongoDB implements with `$lookup` are expressed with the supported
`$sql` operator where the Oracle implementation needs it (see
`server/utils/queries.js` and the complex-migration notes).

---

## 10. Where to go next

* `docs/26ai/demo-runbook.md` — the same migration as a presenter script in deck order, with the
  pre-flight checklist, the reset procedure and fallbacks for slow live steps.
* `docs/26ai/api-contract.md` — every Express endpoint and its side effects.
* `docs/26ai/ui-inventory.md` — every page of the client.

---

## Appendix: artefacts produced by the reference run

| Artefact | Location |
|---|---|
| Workload assessment (deck slide 7, mongosh) | `mern-ecommerce/server/scripts/assess_workload.js` |
| Presenter runbook, deck order | `docs/26ai/demo-runbook.md` |
| Document verification report (204/204, 12/12 collections) | `docs/26ai/migration-report.json` |
| Generated duality-view DDL (12) | `sql/26ai/generated/duality_ddl/*.sql` |
| Setup / view / AI SQL scripts | `sql/26ai/*.sql` |
| In-database embedding loader (onnx2oracle + ADB tcps workaround) | `mern-ecommerce/server/scripts/load_onnx_embedding.py` |
| Embedding + AI endpoint evidence | `PRODUCT_EMBEDDINGS` 112/112 rows, 384 dims; `POST /api/ai/similar` returns `source: in-database:ALL_MINILM_L12_V2` |
| Application-visible showcase | `/support/admin-db` in the new client |

Checks that pass without any provider key (all executed against the live instance):

```
verify_migration.py            -> PASS  source and target documents match (204/204)
sql/26ai/02_verify_counts.sql  -> 12/12 collections MATCH
DBMS_JSON_DUALITY.IMPORT_ALL   -> 12/12 views, 0 error-log rows
DBMS_JSON_SCHEMA.IS_VALID      -> 132/132 documents valid
POST /api/ai/similar           -> 200, in-database ranking (no API key)
POST /api/chat                 -> retrieval from Oracle (in-database:ALL_MINILM_L12_V2),
                                  generation reports the missing LLM_* settings
cart preview vs stored order   -> tax $2.71 == $2.71, subtotal $118.24 == $118.24 (5% CA rate)
```

Select AI (`POST /api/ai/ask`) and answer generation (`POST /api/chat`) need an
OpenAI-compatible provider key; both return an explicit hint until one is configured.
