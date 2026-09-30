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

## 1. Prepare

### 1.1 VMware-free prerequisites

* MongoDB Database Tools (`mongodump`, `mongorestore`, `mongosh`)
* Node.js 20+ and npm
* Python 3.10+ with `pymongo` (for `scripts/verify_migration.py`)
* Oracle SQLcl 25.2+ on a JRE 11+ (for the SQL scripts and the SQLcl MCP server)
* An Autonomous AI Database 26ai instance with the **MongoDB API** tool enabled
  (*Tool configuration → MongoDB API → Copy public access URL*)

### 1.2 Create the schemas

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

### 1.3 Point the application at the source database

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

## 2. Execute

### 2.1 Dump the MongoDB source

```bash
mongodump --uri "mongodb://127.0.0.1:27017/mern_ecommerce" --out dump
```

### 2.2 Restore into Autonomous through the MongoDB API

The target connection string is the ADB MongoDB API public URL for the *target schema*
(`MERN26`), with the schema password URL-encoded (`#` → `%23`):

```bash
mongorestore \
  --nsFrom 'mern_ecommerce.*' --nsTo 'mern26.*' \
  --drop --writeConcern '{w:1}' \
  --uri "mongodb://MERN26:<password>@<adb-host>:27017/mern26?loadBalanced=true&retryWrites=false&authMechanism=PLAIN&authSource=%24external&tls=true" \
  dump/mern_ecommerce
```

Expected result: `204 document(s) restored successfully. 0 document(s) failed to restore.`

### 2.3 Grant access for the duality schema

```sql
-- run as ADMIN
@sql/26ai/03_grants_after_restore.sql
```

---

## 3. Validate

Two independent checks are provided; both must pass.

### 3.1 Document-level verification (source vs target)

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

### 3.2 SQL-level verification (the official count check)

```sql
-- run as ADMIN
@sql/26ai/02_verify_counts.sql
```

Every collection must report `MATCH` and `MISMATCHED_COLLECTIONS` must be `0`.

---

## 4. Extend: relational views over the same documents

```sql
-- run as MERN26
@sql/26ai/04_relational_views.sql
```

| Object | Kind | Purpose |
|---|---|---|
| `PRODUCT_CATALOG` | relational view | products joined to brands, typed columns |
| `ACTIVE_PRODUCTS_OVER_50` / `ACTIVE_NONTAXABLE_PRODUCTS` | relational views | inventory monitoring |
| `PRODUCT_REVIEW_STATS` | relational view | review counts and average rating per product |
| `ORDER_SUMMARY` | relational view | orders joined to customers with totals |
| `PRODUCTS_ENRICHED` | **JSON collection view** (26ai) | read-only documents with brand + rating, readable through the MongoDB API |

Views and materialized views do not count against the Autonomous JSON Database non-JSON storage
limit, so this is a storage-neutral way to expose the document store to SQL and BI tools.

## 5. Extend: JSON-relational duality views

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

## 6. Extend: JSON validity views

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

## 7. Extend: AI inside the database

```sql
-- run as MERN26
@sql/26ai/08_ai_vector_store.sql     -- VECTOR column + similarity query
@sql/26ai/09_select_ai.sql           -- Select AI profile (requires a provider key)
```

### 7.1 Embedding model inside the schema (no API key, no data egress)

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

## 8. Run the migrated application

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

## Appendix: artefacts produced by the reference run

| Artefact | Location |
|---|---|
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
