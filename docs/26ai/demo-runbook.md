# Demo runbook — MongoDB → Oracle AI Database 26ai

Presenter script for the Oracle deck **“Seamless Migration from MongoDB to Oracle”**
(`MongoDB_to_OracleAPI.pptx`), in slide order, mapped onto this repository and this workstation.

Every command below was executed on the workstation described in
[Prerequisites](#0-prerequisites) unless it is explicitly marked **DESTRUCTIVE — DO NOT RUN HERE**.
The outputs shown are the real command output from that run.

| Deck slide | Step below | Show |
|---|---|---|
| 5 — Oracle Database API for MongoDB | [1](#1-slide-5--the-api-in-one-picture) | the connection string is the only difference |
| 6 — Migration process (4 phases) | [1](#1-slide-5--the-api-in-one-picture) | the agenda for the demo |
| 7 — Planning / workload analysis | [2](#2-slides-67--planning-workload-analysis) | `serverStatus`, profiler, operator support check |
| 8 — Preparation | [3](#3-slide-8--preparation) | Database Actions toggle **and** `01_schemas.sql` |
| 9 — Execution (application code) | [4](#4-slide-9--execution-application-code-sql-operator) | the `$sql` operator, live |
| 9 — Execution (data migration) | [5](#5-slide-9--execution-data-migration) | `mongodump` / `mongorestore --drop`, then the post-restore block |
| 10 — Validation | [6](#6-slide-10--validation) | document verification, `MONGO_URI` diff, side-by-side app, UAT |
| 11 — Migration demo | [7](#7-slide-11--the-live-demo-walk-through) | the browser walk-through |
| 12 — Session recap | [8](#8-slide-12--recap-what-to-say) | confirm each recap claim on screen |
| 12 — Recap, live AI | [7, step 9](#7-slide-11--the-live-demo-walk-through) | Select AI profile re-created and answering |
| 15 — Resources | [9](#9-slide-15--resources) | links |

---

## 0. Prerequisites

### 0.1 Services (all local; `docker compose` is covered in the migration guide §9)

| Name | What it serves | Port |
|---|---|---|
| `mongodb-local` | MongoDB 8.0.10 — the **source** database `mern_ecommerce` | 27017 |
| `api-local` | Express API → local MongoDB (`MONGO_URI=mongodb://127.0.0.1:27017/mern_ecommerce`) | 3001 |
| `mern-server` | Express API → Oracle (`MONGO_URI` from `mern-ecommerce/server/.env`) | 3000 |
| `web-local` | Vite preview of the React client → `:3001` (the “MongoDB” side) | 8090 |
| `web-preview` | Vite preview of the React client → `:3000` (the “Oracle” side) | 8080 |
| `web-local-admin` | second origin → `:3001`, only needed for two signed-in users at once | 8091 |
| `web-oracle-admin` | second origin → `:3000`, same reason | 8081 |

Start each one with the application's own start script, from its own directory:

```bash
# Oracle-side API (:3000) - MONGO_URI comes from server/.env
cd mern-ecommerce/server && npm start
# local-MongoDB API (:3001) - the two variables below override .env for this shell
cd mern-ecommerce/server && PORT=3001 MONGO_URI=mongodb://127.0.0.1:27017/mern_ecommerce npm start
# Oracle-side client (:8080)
cd mern-ecommerce/web && API_PROXY_TARGET=http://localhost:3000 npx vite preview --port 8080
# local-MongoDB-side client (:8090)
cd mern-ecommerce/web && API_PROXY_TARGET=http://localhost:3001 npx vite preview --port 8090
```

Verify each one — always on `localhost`, never `127.0.0.1` (see §6.6):
`curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/api/admin-db/views` → `200`, the same on
`:3001` (`http://localhost:3001/api/admin-db/views`), and
`curl -s -o /dev/null -w '%{http_code}' http://localhost:8080/` → `200`; `curl -s http://localhost:3000/api/health`
→ `{"status":"ok","mongo":"up","oracle":"up"}`.

> **Never export `ORACLE_*` before starting an API.** dotenv does not override a variable that is
> already in the environment, so a stale exported `ORACLE_APP_PASSWORD` silently wins over `server/.env`
> and every SQL endpoint answers `ORA-01017: invalid credential`. (The app's Oracle pool reads only
> `ORACLE_APP_USER`/`ORACLE_APP_PASSWORD`/`ORACLE_CONNECT_STRING`; it no longer falls back to the
> ADMIN pair `ORACLE_USER`/`ORACLE_PASSWORD`, which are for the `sql/26ai` setup scripts.) The two traps
> that used to need a
> scratch launcher are fixed in `server/.env` itself: `ORACLE_CONNECT_STRING` now carries the full TLS
> descriptor (thin mode cannot resolve a bare service name - `NJS-516`) and `ORACLE_APP_PASSWORD` is
> quoted, because `#` in an unquoted value survives dotenv but is truncated by Node's `--env-file`
> parser. Measured: from a shell with no `ORACLE_*` set at all, both commands above come up and all
> nine `/api/admin-db/*` endpoints answer `200` on `:3000` and on `:3001`.

> **Server environment this runbook relies on** (all documented in `mern-ecommerce/server/.env.example`).
> `JWT_SECRET` (≥ 32 characters) is required — the API refuses to start without it. Optional:
> `CORS_ORIGINS` (default `CLIENT_URL`), `TRUST_PROXY` (leave empty when the API is reached directly, as
> here), `ORACLE_POOL_MAX` (default 6) and `ORACLE_CALL_TIMEOUT_MS` (default 15000). Per-IP rate limits:
> `RATE_LIMIT_AUTH` (50 / 15 min: sign-in, sign-up, password reset), `RATE_LIMIT_FORMS` (30 / 15 min:
> contact, newsletter, merchant application) and `RATE_LIMIT_AI` (30 / min: `/api/chat` and `/api/ai/*`);
> `0` disables a limit and over-budget calls answer `429 {error}`. Scripts that replay many sign-ins or
> hammer `/api/chat` / `/api/ai/*` (the UAT harnesses) should start the API under test with
> `RATE_LIMIT_AUTH=0 RATE_LIMIT_FORMS=0 RATE_LIMIT_AI=0`; the read-only traffic pass touches none of them.

> **Only if your runner strips `node` from `PATH`.** A service runner that spawns from another
> directory on this workstation needs the command wrapped as
> `bash -c 'cd mern-ecommerce/server && export PATH="/c/Program Files/nodejs:$PATH" && exec npm start'`.
> A presenter's own terminal needs none of that.

### 0.2 Tools

* `mongosh` 2.5.1 (`C:\mongosh\mongosh.exe`) — cannot be executed from git-bash by POSIX path;
  this runbook uses the wrapper `_scratch/mongosh.sh "<uri>" <script.js>`.
* MongoDB Database Tools 100.12.0 — `mongodump`, `mongorestore` on `PATH`.
* SQLcl 26.3 + JDK 17 — wrapped by `_scratch/sqlrun.sh <connection> <file.sql>`
  (saved connections `mig26-admin`, `mig26-app`, `mig26-dv`).
* A Python with `pymongo` for `scripts/verify_migration.py` — here
  `H:/Programs/miniconda/python.exe` (the `.tools/onnx2oracle-venv` interpreter has **no** pymongo).

### 0.3 Credentials

| Secret | Where it lives |
|---|---|
| Target MongoDB-API URI for `MERN26` | `mern-ecommerce/server/.env` → `MONGO_URI` |
| `ADMIN` password | `mern-ecommerce/server/.env` → `ORACLE_PASSWORD` |
| `MERN26` / `MERN26DV` passwords | `mern-ecommerce/server/.env`; `sql/26ai/01_schemas.sql` takes them as the substitution variables `mern26_password` / `mern26dv_password` (nothing is stored in the script) |
| Storefront admin login | `admin@example.com` / `admin123` (`npm run seed:db`) |

### 0.4 Pre-flight checklist

* [ ] `mongodb-local`, `mern-server`, `api-local` responding (`curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/api/ai/status` → `200`, and the same on `:3001`).
* [ ] Both clients up: `:8090` (MongoDB side) and `:8080` (Oracle side) — probe them as
      `curl -s -o /dev/null -w '%{http_code}' http://localhost:8080/`. `vite preview` binds IPv6
      `::1` only, so `curl http://127.0.0.1:8080/` answers `000` while the page is perfectly up;
      use `localhost` (the browser tabs are `localhost` too).
* [ ] **No test traffic running** (see the rule in §6.1) — the UAT harness writes to both backends.
* [ ] `.tools/sqlcl` and a JDK 17 present; `_scratch/sqlrun.sh mig26-admin sql/26ai/02_verify_counts.sql` returns a count table.
* [ ] Browser tabs pre-opened: `:8090/`, `:8090/shop`, `:8080/`, `:8080/shop`, `:8080/support/admin-db`.
* [ ] Terminal 1 at the repo root, sized for `mongosh` output; terminal 2 for `curl`/traffic.
* [ ] Profiling is **off** on the source (`db.getProfilingStatus().was === 0`) and any `system.profile`
      collection from a previous run is dropped (§3.2 explains why).

---

### 0.5 Reset to a clean “before migration” state

Run this before every rehearsal so the numbers on both sides are the reference set.

```bash
# 1. local source back to the reference dataset (204 documents / 12 collections)
#    no --nsFrom/--nsTo: the dump directory name already is the database name
mongorestore --drop --uri "mongodb://127.0.0.1:27017" _scratch/dump

# 2. the target is reset by re-running the migration itself (see §5.2) - DESTRUCTIVE
```

Reference dataset (the state both slides 9 and 10 assume):

```
addresses 4 · brands 16 · cartitems 15 · carts 8 · categories 13 · contacts 4 · merchants 4
orders 5 · products 112 · reviews 10 · users 7 · wishlists 6      = 204 documents
```

The restore goes into `mongodb://127.0.0.1:27017` — a URI with **no database name**, which is what
makes the dump root the right argument (see the note below). Verified on this workstation:

```
204 document(s) restored successfully. 0 document(s) failed to restore.
```

Verify it afterwards — the source must be exactly the reference set, with profiling off and no
`system.profile`:

```bash
bash _scratch/mongosh.sh "mongodb://127.0.0.1:27017/mern_ecommerce" _scratch/planning/preflight.js
```

```
profiling : {"was":0,"slowms":100,"sampleRate":1,"ok":1}
  addresses     4   brands 16   cartitems 15   carts 8   categories 13   contacts 4
  merchants     4   orders 5    products 112   reviews 10   users 7   wishlists 6
collections: 12  documents: 204
```

> **Two traps with `mongorestore`, both measured with Database Tools 100.12.0.**
> **(1) The dump must be fresh.** `_scratch/dump` is a snapshot of the source, not a constant: the
> dump taken at 00:59 still carried the pre-rename catalogue (12 of 112 products had
> `"Seed Wool Blanket 1790722649409"` / `SEED-WB-1790722649409` where the live source has
> `"Wool Blanket"` / `MS-WB-01`). Restoring it silently installs the *old* names into the target
> and `verify_migration.py` then reports those 12 documents as differing — with no error anywhere.
> Re-dump whenever the source is at the reference state (§5.1 does exactly that) and never restore
> a dump you cannot date. Also clear harness leftovers first
> (`bash _scratch/mongosh.sh "mongodb://127.0.0.1:27017/mern_ecommerce" _scratch/planning/harness-leftovers.js`
> → `harness leftovers: 0`); an interrupted `api-e2e` run leaves one `E2E-<id> Product` behind,
> and a stale `mongodump` does not see it either way.
> **(2) The dump root only works for a URI without a database name** — that is what makes the command
> above (a URI with no database name, root argument) correct, and it is why §5.2 passes the *database*
> directory instead. Measured in §5.2.

---

## 1. Slide 5 — the API in one picture

No command. Talking point, in one sentence: *the application keeps speaking the MongoDB wire
protocol; only the connection string changes.*

Show the two strings side by side (password masked) on slide 10:

```
source : mongodb://127.0.0.1:27017/mern_ecommerce
target : mongodb://MERN26:<password>@<adb-host>:27017/mern26
         ?loadBalanced=true&retryWrites=false&authMechanism=PLAIN&authSource=$external&tls=true
```

---

## 2. Slides 6–7 — Planning (workload analysis)

Deck slide 7 lists: *profile the workload, application code review, `db.serverStatus()`,
`db.setProfilingLevel()`, review operators & operation support, review supported frameworks.*

The runnable version is `mern-ecommerce/server/scripts/assess_workload.js` (mongosh script, no
dependencies). Modes are selected with `ASSESS_MODE`.

### 2.1 `db.serverStatus()` — 1 min

```bash
ASSESS_MODE=status bash _scratch/mongosh.sh "mongodb://127.0.0.1:27017/mern_ecommerce" \
  mern-ecommerce/server/scripts/assess_workload.js
```

Real output (2026-09-30, quiet system — the counts are the 204-document reference set, which is what
the deck's “before” slide assumes; the runbook's dry run measured this step at 0.8 s):

```
== db.serverStatus() - mern_ecommerce ========================================
version            : 8.0.10
host / process     : jasper / ...\.tools\mongodb-win32-x86_64-windows-8.0.10\bin\mongod.exe
uptime             : 699 s
connections        : current 12, available 999988, totalCreated 79
storageEngine      : wiredTiger
opcounters         : {insert=34, query=1091, update=37, delete=73, getmore=19, command=329}
opcountersRepl     : {insert=0, query=0, update=0, delete=0, getmore=0, command=0}
network bytes      : in 413035, out 1793468, requests 1548
mem resident       : 355 MB

== collections in mern_ecommerce =============================================
addresses             4
brands                16
cartitems             15
carts                 8
categories            13
contacts              4
merchants             4
orders                5
products              112
reviews               10
users                 7
wishlists             6
TOTAL                 204  (12 collections)

== profiler ==================================================================
profiling level    : 0 (slowms 100)
```

Reading the numbers for the audience: one read/write-heavy storefront, a few thousand commands
against a 12-connection pool, 112 products — small, but the operator set is what matters, not the
volume. (While a UAT suite is running the same step prints noticeably higher counts — 214 documents,
`current 33` connections — and that is the honest “live source” picture, not an error.)

### 2.2 `db.setProfilingLevel(2)`, then the traffic pass — 1 min

```bash
ASSESS_MODE=start bash _scratch/mongosh.sh "mongodb://127.0.0.1:27017/mern_ecommerce" \
  mern-ecommerce/server/scripts/assess_workload.js

bash _scratch/planning/traffic-readonly.sh http://localhost:3001 3      # read-only browser pass
```

```
profiling level before : 0
dropped the previous system.profile
system.profile exists  : true
profiling level now    : 2 (slowms 100)
```

The traffic pass mirrors what the React client really sends (12 read-only GETs per round:
catalogue pages, sorts, category and brand filters, search, product detail); 3 rounds → `36 × 200 OK`.

### 2.3 Summarise `system.profile`, then `db.setProfilingLevel(0)` — 2 min

```bash
ASSESS_MODE=report bash _scratch/mongosh.sh "mongodb://127.0.0.1:27017/mern_ecommerce" \
  mern-ecommerce/server/scripts/assess_workload.js
```

Real output:

```
== profiling =================================================================
level before : 2  ->  level now : 0

== operations by type and collection (125 entries) ===========================
op          namespace                         count   millis
command     mern_ecommerce.products           50      386
query       mern_ecommerce.brands             32      0
query       mern_ecommerce.categories         29      0
query       mern_ecommerce.products           6       0
query       mern_ecommerce.merchants          4       0
getmore     mern_ecommerce.products           4       4

== shapes observed (125 of 125 entries analysed) =============================
find           : 71
aggregate      : 50 (pipelines with $lookup: 100, with $sql: 0)

== aggregation stages (vs Oracle support matrix) =============================
[ok] $addFields        150    supported since 26ai (alias $set)
[ok] $match            112    supported since 19c
[ok] $lookup           100    supported since 26ai (acl/array localField raise an error; `let` unsupported)
[ok] $unwind           50     supported since 26ai
[ok] $project          50     supported since 19c
[ok] $sort             25     supported since 19c
[ok] $skip             25     supported since 19c
[ok] $limit            25     supported since 19c

== query operators in find/aggregate filters (vs Oracle support matrix) ======
[ok] $gte              100    supported since 19c
[ok] $lte              50     supported since 19c
[ok] $in               13     supported since 19c
[ok] $eq               6      supported since 19c
[ok] $regex            3      supported since 19c

== update operators (vs Oracle support matrix) ===============================
(none observed)

== aggregation expressions (vs Oracle support matrix) ========================
[ok] $sum              50     supported since 26ai (accumulator)
[ok] $size             50     supported since 26ai
[ok] $cond             50     supported since 26ai
[ok] $eq               50     supported since 26ai
[ok] $divide           50     supported since 26ai

== targeted compatibility check: $regex with a separate $options =============
(not observed - every regex carries its flags on the pattern)

== verdict ===================================================================
every stage, query operator, update operator and expression observed is supported by the
Oracle Database API for MongoDB (see the sources at the top of this file).

profiling is off (level 0).
```

Add one sentence the audience needs: this is the check that **caught the demo's one real compatibility
defect**. Re-run it against the pre-fix shape (one `find` with `{name: {$regex: /mug/, $options: 'is'}}`
— `_scratch/planning/old-shape-search.js`) and the same section reports:

```
== targeted compatibility check: $regex with a separate $options =============
[!!] find filter on "name": 1 occurrence(s) of {$regex: …, $options: …}
     The Oracle Database API for MongoDB IGNORES the separate $options field in find
     filters, so the match becomes case-sensitive (0 rows instead of 3 for "mug").
     Put the flags on the pattern: new RegExp(escapeRegex(term), 'i')

== verdict ===================================================================
UNSUPPORTED / INCOMPATIBLE constructs observed:
  !! found {$regex, $options} on "name" - rewrite as new RegExp(escapeRegex(x), 'i')
```

**Symptom → how the review surfaces it → fix**

| | |
|---|---|
| Symptom | `GET /api/product/list/search/mug` returned 3 products on MongoDB and **0** on Oracle — the storefront search box looked empty after the cut-over. Nothing errors: the API answers `200` with an empty array |
| How it surfaces | the workload pass records the `find` filters, the operator review reads them against Oracle's matrix (`$options` is *documented* as supported), and a direct probe of the live API settles it: `{name:{$regex:/mug/, $options:'is'}}` → 0 rows on Oracle / 3 on MongoDB, while `{name:{$regex:/mug/i}}` → 3 on both. The wire shape is visible in `system.profile` (`_scratch/planning/read-filter.js`) |
| Fix | one line — the flags move onto the pattern: `{ name: { $regex: new RegExp(escapeRegex(name), 'i') }, isActive: true }` (`GET /product/list/search/:name` in `routes/api/product.js`, `escapeRegex` in `server/utils/utils.js`). This is the demo's honest “minimal code change” |

Two points worth saying out loud:

1. The storefront's `$lookup` stages are the only construct with real restrictions on the target
   (no `let`, no array/missing `localField`) — which is exactly why the migrated code paths in
   `server/utils/queries.js` replace them with `$sql` (§4). The script prints the restriction next
   to `$lookup` so the audience sees the *reason* for the code change.
2. **`$sql` count is 0 here** because the profiler is watching the *source*: the `$sql` branch only
   exists when `MONGO_URI` contains `loadBalanced` (i.e. on Oracle). Say it, then show it in §4.

### 2.4 The profiler does not exist on the target — 30 s

Oracle's support matrix marks the `profiler` command **not supported**: *“Use SQL Monitor for query
profiling.”* So: profile the source (above), and on Oracle use `$sql` + `V$SQL` / SQL Monitor for the
same job. The script's header cites the source.

### 2.5 Supported frameworks — 30 s

From the same Oracle page (Feature Support → *Client Tools and Drivers*): the MongoDB API requires a
client that supports **load balanced connections** — Compass ≥ 1.28.1, Database Tools ≥ 100.5.0,
mongosh ≥ 0.15.6, Node.js driver ≥ 4.1.0, PyMongo ≥ 3.12.0. This workstation: mongosh 2.5.1,
Database Tools 100.12.0, mongoose 6.10.0 (driver 4.x), PyMongo 4.18.2 — all above the floor.

**Sources** (fetched 2026-09-30, *Oracle Database API for MongoDB*, F44905-26):

* Feature Support (commands, operators, stages, types, indexes) —
  <https://docs.oracle.com/en/database/oracle/mongodb-api/mgapi/support-mongodb-apis-operations-and-data-types-reference.html>
* Aggregation Pipelines (`$sql`, `$external`, `$lookup` restrictions) —
  <https://docs.oracle.com/en/database/oracle/mongodb-api/mgapi/pipelines.html>

### 2.6 Application code review — 1 min

Point at the code the profiling just justified: `mern-ecommerce/server/utils/queries.js` holds every
aggregation pipeline (three `$lookup`s in the MongoDB branch, one `$sql` stage that joins brands,
reviews and wishlists in the Oracle branch — table in §4.3), and `server/services/{oracle,vectorSearch,llm,llmChat}.js` hold the
SQL/AI paths.

---

## 3. Slide 8 — Preparation

The slide has two halves: *source system* (permissions, network access) and *target system*
(*enable MongoDB API for user*, database grants, ORDS, the API itself).

### 3.1 Two ways to enable the API for a schema — say both, demo one

| Path | What you do | What actually happens |
|---|---|---|
| **Database Actions UI** (the deck's “enable MongoDB API for user” toggle) | *Database Actions → Administration → Database Users → (user) → REST, GraphQL, MongoDB API, and Web access* → toggle **on** | ORDS enables the schema and its REST/MongoDB-API handlers |
| **SQL** (what this repo automates) | `sql/26ai/01_schemas.sql` as `ADMIN` | `ORDS.ENABLE_SCHEMA(p_enabled => true, p_schema => 'MERN26', p_url_mapping_type => 'BASE_PATH', p_url_mapping_pattern => 'mern26', p_auto_rest_auth => false)` — the same operation, scripted and idempotent |

```bash
# the schema passwords come from your shell (same values as in server/.env), never from the repo
{ echo "define mern26_password = $MERN26_PASSWORD"; echo "define mern26dv_password = $MERN26DV_PASSWORD"
  cat sql/26ai/01_schemas.sql; } > _scratch/01_schemas_run.sql
bash _scratch/sqlrun.sh mig26-admin _scratch/01_schemas_run.sql
```

The script then grants the schema what the MongoDB API needs
(`GRANT DB_DEVELOPER_ROLE, DWROLE, UNLIMITED TABLESPACE, SODA_APP, CONNECT` for `MERN26` and
`MERN26DV`), and finishes with a `dba_users` check.

Demo tip: show the UI toggle for 10 seconds (it is what most customers click), then say *“and here is
the same thing as code, which is what we run in this repo”* and run the script.

Oracle documents the mapping from the other side: a MongoDB *database* **is** an ORDS-enabled schema,
and an ORDS-enabled user is created with `grant soda_app, create session, create table, create view,
create sequence, create procedure, create job, unlimited tablespace to <user>;` followed by
`exec ords.enable_schema;` — *ORDS Installation and Configuration Guide* §9
(<https://docs.oracle.com/en/database/oracle/oracle-rest-data-services/25.3/ordig/enabling-and-configuring-oracle-database-api-mongodb.html>).
That page is also the source of `authMechanism=PLAIN`, `authSource=$external`, `tls=true` and the
`loadBalanced=true` requirement seen in `MONGO_URI` (§6.4).

### 3.2 Source side — 30 s

Network access is a plain TCP connection to `mongodb://127.0.0.1:27017` for the demo; for a real
source it is the same host/port allow-list question as any MongoDB client. Permissions needed by the
migration tool: `read` on the source database for `mongodump`, `readWrite` on the target schema for
`mongorestore` (here: the `MERN26` credentials inside the API URI).

After the planning step, clean the source before you validate:

```bash
# profiling must be off first - mongod refuses to drop system.profile while it is on
ASSESS_MODE=report bash _scratch/mongosh.sh "mongodb://127.0.0.1:27017/mern_ecommerce" \
  mern-ecommerce/server/scripts/assess_workload.js        # summarises and leaves profiling at 0
bash _scratch/mongosh.sh "mongodb://127.0.0.1:27017/mern_ecommerce" _scratch/planning/drop-profile.js
```

```
dropped system.profile
collections now : ["addresses","brands","cartitems","carts","categories","contacts","merchants","orders","products","reviews","users","wishlists"]
```

`system.profile` is a real collection in the source. `mongodump` does not copy it, and
`scripts/verify_migration.py` now skips `system.*` (printing
`skipped: 1 MongoDB system collection(s): system.profile`), but drop it anyway: the presenter should
not leave planning artefacts on the demo database.

---

## 4. Slide 9 — Execution, application code (`$sql` operator)

### 4.1 The slide's own command, run for real — 1 min

```bash
URI=$(grep -m1 '^MONGO_URI=' mern-ecommerce/server/.env | cut -d= -f2-)
bash _scratch/mongosh.sh "$URI" _scratch/planning/sql-operator.js
```

```
db      : mern26
version : 7.0.22

--- db.aggregate([{$sql:"select banner from v$version"}]) ---
[
  {
    BANNER: 'Oracle AI Database 26ai Enterprise Edition Release 23.26.3.3.0 - Production'
  }
]

--- $sql over the migrated collections (SQL against JSON collection tables) ---
[
  {
    PRODUCTS: 112,
    USERS: 7,
    ORDERS: 5
  }
]

--- $sql as a pipeline stage with input (documents from the previous stage) ---
3
(3 documents returned, each carrying the sqlStage marker)

--- explain: the pipeline becomes one SQL statement ---
generated SQL: yes (355 chars)
```

`version : 7.0.22` is what the API reports as its MongoDB wire version — worth pointing out: your
driver sees a MongoDB 7.0 endpoint, your data lives in 26ai.

### 4.2 The same pipeline against MongoDB — 30 s

```bash
bash _scratch/mongosh.sh "mongodb://127.0.0.1:27017/mern_ecommerce" _scratch/planning/sql-operator.js
```

```
--- db.aggregate([{$sql:"select banner from v$version"}]) ---
ERROR: Unrecognized pipeline stage name: '$sql'
```

`$sql` (and `$external`) are Oracle extensions — the demo's “minimal code change” is only needed
where MongoDB cannot express the join safely, and it is a one-stage swap.

### 4.3 Where the app uses it — 1 min

`mern-ecommerce/server/utils/queries.js`, selected by `ORACLE_API = /loadBalanced/i.test(process.env.MONGO_URI)`:

| Join | MongoDB branch (`mongoJoinStages`) | Oracle branch (`oracleJoinStage`, one `$sql`) |
|---|---|---|
| products → brands | `$lookup` on `brand` | `left outer join brands` + `json_mergepatch` |
| products → reviews | `$lookup` + `$filter` on `status: 'Approved'`, then `$sum`/`$size`/`$cond` | `left outer join` of a per-product pre-aggregated subquery (`status = 'Approved'`, `count`/`sum`) |
| products → wishlists (`isLiked`, signed-in callers only) | `$lookup` pipeline with `let` (unsupported on Oracle) + `$ifNull` → `false` | correlated scalar subquery on `wishlists`, `nvl(…, false)` |

The Oracle branch is one `$sql` stage that does all three joins at once (`oracleJoinStage`); the
MongoDB branch is three `$lookup`s (`mongoJoinStages`). The backend is picked once at start-up
(`ORACLE_API`), not per request. `getStoreProductsQuery` puts the raw-field `$match` stages
(`isActive`, price, name, category, brand) *before* the `$sql` stage, because a `$sql` stage sees only
the pipeline's original collection as `input`.

Everything else in the pipelines (`$match`, `$project`, `$sort`, `$skip`, `$limit`, `$unwind`,
`$addFields`, `$sum`, `$size`, `$cond`, `$divide`) is used unchanged on both backends — that is the
“no application rewrite” claim, made concrete.

---

## 5. Slide 9 — Execution, data migration

### 5.1 Dump the source — 1 min

```bash
mongodump --uri "mongodb://127.0.0.1:27017/mern_ecommerce" --out _scratch/dump
```

Real output (tail, measured 0.2 s):

```
2026-09-30T07:04:42.273+0200	writing mern_ecommerce.addresses to _scratch\dump\mern_ecommerce\addresses.bson
2026-09-30T07:04:42.273+0200	done dumping mern_ecommerce.contacts (4 documents)
2026-09-30T07:04:42.273+0200	done dumping mern_ecommerce.brands (16 documents)
2026-09-30T07:04:42.273+0200	done dumping mern_ecommerce.merchants (4 documents)
```

`system.profile` is not copied — the dump is 12 collections. Dumping **into `_scratch/dump`** (rather
than a throwaway directory) is deliberate: that path is the reference snapshot §0.5 restores the
source from, and this is the moment the source is known to be at the reference set — so the two can
never disagree. Never restore a dump you cannot date (§0.5).

### 5.2 Restore into the target — 3 min — **DESTRUCTIVE**

```bash
URI=$(grep -m1 '^MONGO_URI=' mern-ecommerce/server/.env | cut -d= -f2-)
mongorestore --drop --writeConcern '{w:1}' --uri "$URI" _scratch/dump/mern_ecommerce
```

Expected (and measured — **6 s**):

```
2026-09-30T07:06:59.834+0200	dropping collection mern26.contacts before restoring
2026-09-30T07:06:59.837+0200	finished restoring mern26.reviews (10 documents, 0 failures)
2026-09-30T07:07:00.367+0200	restoring mern26.addresses from _scratch\dump\mern_ecommerce\addresses.bson
2026-09-30T07:07:00.643+0200	no indexes to restore for collection mern26.users
2026-09-30T07:07:01.528+0200	204 document(s) restored successfully. 0 document(s) failed to restore.
```

> **Why this exact command — the one step that can silently do nothing.** `mongorestore` picks the
> “database directory” layout as soon as the target URI names a database, and our `MONGO_URI` ends in
> `/mern26`. So the positional argument must be the **database directory** (`_scratch/dump/mern_ecommerce`)
> and the database name comes from the URI; `--nsFrom`/`--nsTo` are *ignored* in this form (mongorestore
> says so: `The --db and --collection flags are deprecated for this use-case`) and the dump **root**
> restores **0 documents with exit code 0**:
>
> ```
> $ mongorestore --nsFrom 'mern_ecommerce.*' --nsTo 'mern26.*' --drop --uri "$URI" _scratch/dump
> don't know what to do with subdirectory "dump\mern_ecommerce", skipping...
> 0 document(s) restored successfully. 0 document(s) failed to restore.        <-- exit 0
> ```
>
> With a URI **without** a database name the opposite holds (root, not database directory) — that is
> the form §0.5 uses for `mongodb://127.0.0.1:27017`. Both combinations were measured against the
> local server and against `MERN26`; the rule of thumb is *one directory level per namespace level the
> URI does not supply*.

**Backup first — and here is the rollback line.** Before the destructive step, snapshot the target
through the same API (12 s, 85 KB):

```bash
TS=$(date -u +%Y%m%dT%H%M%SZ)
mongodump --uri "$URI" --out "_scratch/backup/$TS"
echo "$TS" > _scratch/backup/LATEST
```

If the live migration goes wrong, roll back:

```bash
mongorestore --drop --nsExclude 'mern26.PRODUCTS_ENRICHED' \
  --uri "$URI" "_scratch/backup/$(cat _scratch/backup/LATEST)/mern26"
```

Measured: `204 document(s) restored successfully. 0 document(s) failed to restore.` into `MERN26` in
6 s (from `_scratch/backup/20260930T050030Z`). The `--nsExclude` is not cosmetic: the dump records
the JSON collection *view* `PRODUCTS_ENRICHED` as a collection entry with no data, so excluding it
leaves the view — and its definition — exactly as it is. A restore always needs the §5.3 block
afterwards.

### 5.3 Post-restore: what `--drop` breaks — 2 min

The restore replaces the twelve JSON collection **tables**. Everything built on them survives, but
comes back invalid or stale, so the demo must re-run the dependent scripts in this order. Skipping
any of them is visible on `/support/admin-db`:

| Skipped step | What you see | Measured symptom |
|---|---|---|
| `03_grants_after_restore.sql` (ADMIN) | the duality-view schema can no longer read the data schema | `ORA-00942: table or view "MERN26"."users" does not exist` as `MERN26DV`; the duality panel goes empty |
| `03b_grants_duality_to_data.sql` (ADMIN) | the data schema cannot read the duality views it feeds | `07` fails to infer schemas (`describe` on `…_DV` denied) |
| `04_relational_views.sql` (MERN26) | `PRODUCT_CATALOG`, `ORDER_SUMMARY`, `PRODUCTS_ENRICHED` + synonym are left `INVALID` | 11 views + 1 synonym `INVALID` in `user_objects` right after the restore |
| `06_import_duality_views.sql` (MERN26DV) | duality views still hold the pre-restore snapshot | `pending > 0` on the duality panel |
| `10_duality_catalog.sql` (MERN26DV) | the published manifest is stale (and the grant is gone) | `/api/admin-db/duality-views` reads an empty manifest |
| `07_validity_views.sql` (MERN26) | validity views keep a schema inferred from the previous data | the panel can report rows as invalid |
| `08_ai_vector_store.sql` (MERN26) | nothing breaks — `PRODUCT_EMBEDDINGS` is **not** a Mongo collection, so `--drop` leaves it alone | 112 embeddings, all still joined to the restored products |

```bash
bash _scratch/sqlrun.sh mig26-admin sql/26ai/03_grants_after_restore.sql     # 22 collections granted to MERN26DV  (16 s)
bash _scratch/sqlrun.sh mig26-admin sql/26ai/03b_grants_duality_to_data.sql  # 38 MERN26DV objects granted to MERN26 (16 s)
bash _scratch/sqlrun.sh mig26-app   sql/26ai/04_relational_views.sql         # views + collection view recreated (16 s)
bash _scratch/sqlrun.sh mig26-dv    sql/26ai/06_import_duality_views.sql     # 12/12 MATCH (18 s)
bash _scratch/sqlrun.sh mig26-dv    sql/26ai/10_duality_catalog.sql          # manifest refreshed (15 s)
bash _scratch/sqlrun.sh mig26-app   sql/26ai/07_validity_views.sql           # 0 invalid (19 s)
bash _scratch/sqlrun.sh mig26-app   sql/26ai/08_ai_vector_store.sql          # 112 embeddings + a live search (15 s)
```

Then prove the dependents, one command each (about 15 s per SQL check):

```bash
bash _scratch/sqlrun.sh mig26-app _scratch/planning/dependent_health.sql     # views, validity, grants, vector join
bash _scratch/sqlrun.sh mig26-dv  _scratch/planning/dependent_health_dv.sql  # 12 duality views, manifest, counts
curl -s http://localhost:3000/api/admin-db/views | head -c 200               # PRODUCTS_ENRICHED back as a json-collection-view
curl -s http://localhost:3000/api/admin-db/duality-views                     # every view inSync=true, pending=0, stale=0
curl -s http://localhost:3000/api/admin-db/validity                          # invalidDocuments: []
curl -s -X POST -H 'Content-Type: application/json' -d '{"text":"warm blanket for camping"}' \
     http://localhost:3000/api/ai/similar | head -c 200                      # in-database vector search still answers
```

Measured after the restore: `product_catalog 112`, `order_summary 5`, `products_enriched 112`,
`document_validity 8/8 · 5/5 · 112/112 · 7/7`, `112/112` embeddings joined, `12/12` duality views
`inSync=true`, and `PRODUCTS_ENRICHED` readable through the MongoDB API with 112 documents. The grant
scripts print their own counts — `03` grants `22` collections to `MERN26DV`, `03b` grants `38`
`MERN26DV` objects back to `MERN26` — and `dependent_health.sql` counts `48` grant rows on
`MERN26DV` (reference capture: `_scratch/dryrun/dependent-after-restore.txt`).

### 5.4 Alternatives (mention, do not demo) — 30 s

* **MongoDB Compass** — pointed at the Oracle API URL, Compass shows the migrated collections and can
  run the same `$sql` aggregation (Compass ≥ 1.28.1 supports load-balanced connections).
* **GoldenGate for MongoDB Migrations 23ai** — the CDC option when the source cannot stop: bulk
  export/import first, change data capture afterwards. Not installed on this workstation.
* **Bulk export/import** (`mongoexport`/`mongoimport`) — same dump/restore story, JSON text instead
  of BSON; slower for large collections.

---

## 6. Slide 10 — Validation

### 6.1 Rule before you validate: no writers

**Stop the UAT suite and any manual clicking before validating.** While something writes, both sides
drift and the comparison fails for reasons that have nothing to do with the migration. Observed
today, with the UAT suite running: `verify_migration.py` reported extra/missing `_id`s that were gone
seconds later, and `02_verify_counts.sql` reported 4 mismatched collections (`addresses`, `carts`,
`orders`, `users` — exactly the collections the suite was writing). With a quiet system the reference
run gives `204/204` and `12/12 MATCH`.

Also make sure the planning step left no `system.profile` behind (§3.2).

### 6.2 Document-level verification — 2 min

```bash
URI=$(grep -m1 '^MONGO_URI=' mern-ecommerce/server/.env | cut -d= -f2-)
H:/Programs/miniconda/python.exe scripts/verify_migration.py \
  --source "mongodb://127.0.0.1:27017/mern_ecommerce" \
  --target "$URI" \
  --report _scratch/planning/out/migration-report.json
```

On a quiet system (UAT suite stopped) the same command gives the reference result — measured on
2026-09-30, after the live migration, in **7 s**:

```
C:\Users\user\AppData\Roaming\Python\Python312\site-packages\pymongo\uri_parser_shared.py:388: UserWarning: The value of tlsallowinvalidcertificates must be 'true' or 'false'
source: mern_ecommerce  (12 collections)
target: mern26  (12 collections, 1 views)  [views: PRODUCTS_ENRICHED]
------------------------------------------------------------------------------
[OK       ] addresses: source=4 target=4 missing=0 extra=0 differing=0
[OK       ] brands: source=16 target=16 missing=0 extra=0 differing=0
[OK       ] cartitems: source=15 target=15 missing=0 extra=0 differing=0
[OK       ] carts: source=8 target=8 missing=0 extra=0 differing=0
[OK       ] categories: source=13 target=13 missing=0 extra=0 differing=0
[OK       ] contacts: source=4 target=4 missing=0 extra=0 differing=0
[OK       ] merchants: source=4 target=4 missing=0 extra=0 differing=0
[OK       ] orders: source=5 target=5 missing=0 extra=0 differing=0
[OK       ] products: source=112 target=112 missing=0 extra=0 differing=0
[OK       ] reviews: source=10 target=10 missing=0 extra=0 differing=0
[OK       ] users: source=7 target=7 missing=0 extra=0 differing=0
[OK       ] wishlists: source=6 target=6 missing=0 extra=0 differing=0
------------------------------------------------------------------------------
RESULT: PASS - source and target documents match
report written: _scratch/planning/out/migration-report.json
```

The `204/204` total lives in the report, not on stdout — read it back, or quote it from the file:

```bash
node -e "const j=require('./_scratch/planning/out/migration-report.json');console.log(j.sourceDocuments+' -> '+j.targetDocuments+' verified='+j.verified+' over '+j.collections.length+' collections')"
# 204 -> 204 verified=true over 12 collections
```

The `tlsallowinvalidcertificates` line is pymongo warning about our `tlsAllowInvalidCertificates=true`
URI parameter — expected on the ADB private endpoint, and not an error. When the report is written to
`docs/26ai/migration-report.json` (a PASS run only!) the dashboard picks it up on the next refresh.

With writers running it fails for reasons that have nothing to do with the migration — the same
command during a UAT run:

```
source: mern_ecommerce  (12 collections)
target: mern26  (12 collections, 1 views)  [views: PRODUCTS_ENRICHED]
skipped: 1 MongoDB system collection(s): system.profile
-------------------------------------------------------------------------------
[MISMATCH ] addresses: source=7 target=6 missing=3 extra=2 differing=0
             - missing in target: {"$oid": "6abc81118f780d47e137ddcb"}
[MISMATCH ] products: source=112 target=112 missing=0 extra=0 differing=2
             - content diff for {"$oid": "6abc429865ad8983ff9e857b"}: $.quantity: 28 != 26
[MISMATCH ] users: source=12 target=9 missing=5 extra=2 differing=0
-------------------------------------------------------------------------------
RESULT: FAIL - differences found
report written: _scratch/planning/out/migration-report.json
```

and the committed reference run on the quiet system (`docs/26ai/migration-report.json`):

```
source: mern_ecommerce  (12 collections)
target: mern26  (12 collections, 1 views)  [views: PRODUCTS_ENRICHED]
[OK] addresses … [OK] wishlists
RESULT: PASS - source and target documents match           (204/204)
```

Write the report to `_scratch/` while rehearsing — `docs/26ai/migration-report.json` is the
*reference* artefact that the dashboard and README quote, so do not overwrite it with a drifted run.

### 6.3 SQL-level verification — 1 min

```bash
bash _scratch/sqlrun.sh mig26-admin sql/26ai/02_verify_counts.sql
```

Real output on a quiet system (2026-09-30):

```
COLLECTION_NAME       MONGODB_COUNT    ORACLE_COUNT STATUS
__________________ ________________ _______________ _________
addresses                         4               4 MATCH
brands                           16              16 MATCH
cartitems                        15              15 MATCH
carts                             8               8 MATCH
categories                       13              13 MATCH
contacts                          4               4 MATCH
merchants                         4               4 MATCH
orders                            5               5 MATCH
products                        112             112 MATCH
reviews                          10              10 MATCH
users                             7               7 MATCH
wishlists                         6               6 MATCH

   MISMATCHED_COLLECTIONS
_________________________
                        0
```

With writers running, the same script reports the drift instead — measured during a UAT run:

```
addresses                         4               5 MISMATCH
carts                             8               9 MISMATCH
orders                            5               6 MISMATCH
users                             7               8 MISMATCH

   MISMATCHED_COLLECTIONS
_________________________
                        4
```

(`ORA-28098 … password will expire within 29 days` is a profile warning on the ADMIN user, not a
migration problem.)

### 6.4 Update the application endpoint — 1 min

The only change: `mern-ecommerce/server/.env`.

```diff
- MONGO_URI=mongodb://127.0.0.1:27017/mern_ecommerce
+ MONGO_URI=mongodb://MERN26:<password>@<adb-host>:27017/mern26?loadBalanced=true&retryWrites=false&authMechanism=PLAIN&authSource=$external&tls=true&tlsAllowInvalidCertificates=true
```

`loadBalanced=true` is what also flips `server/utils/queries.js` onto the `$sql` branch.
Restart the API (`mern-server`) after the change: any in-flight request dies with it.

The masked before/after pair used on stage is captured verbatim in
`_scratch/dryrun/06-endpoint-switch.txt`:

```
== before (local MongoDB) ==
MONGO_URI=mongodb://127.0.0.1:27017/mern_ecommerce
== after (Oracle Database API for MongoDB) ==
MONGO_URI=mongodb://MERN26:<password>@<adb-host>:27017/mern26?loadBalanced=true&retryWrites=false&authMechanism=PLAIN&authSource=$external&tls=true&tlsAllowInvalidCertificates=true
```

The storefront never sees the password: the URI lives in `server/.env` (gitignored) and the app only
prints `:MONGO_URI` in its startup log with the schema name.

### 6.5 Side-by-side: identical pages, identical numbers — 3 min

```bash
node _scratch/planning/side-by-side.js http://localhost:3001/api http://localhost:3000/api
```

| Page | Left (MongoDB) | Right (Oracle) | What must match |
|---|---|---|---|
| `/` home | `:8090` | `:8080` | featured + premium product names and prices |
| `/shop` | `:8090` | `:8080` | result count, page count, first page of products |
| `/shop?q=mug` | `:8090` | `:8080` | the search box narrows the same page to the same products |
| `/product/<slug>` | `:8090` | `:8080` | name, SKU, price, stock |
| `/support/admin-db` | `:8090` | `:8080` | *Migration summary* tiles: source/target collections, source/target documents, mismatched |

Captured in a browser on 2026-09-30, both origins, same bundle:

```
:8090/shop           1–12 of 112 products   Enamel Mug · Tax free · Wool Blanket · Camp Lantern · Trail Backpack
:8080/shop           1–12 of 112 products   Enamel Mug · Tax free · Wool Blanket · Camp Lantern · Trail Backpack
:8090/shop?q=mug     1–12 of 112 products · filtered by name on this page
:8080/shop?q=mug     1–12 of 112 products · filtered by name on this page
:8090/               12 product links on the home page (same first six as :8080)
:8080/               12 product links on the home page
```

and the API-level diff (`_scratch/planning/side-by-side.js`, 12 probes): catalogue totals (112 / 11
with the rating filter), category list (13), brand list (16), search, product detail, migration
status, relational views (11), duality views (12), validity report and AI status all `MATCH` —
**11/12**:

```
MATCH   catalogue total        local {"count":11,"totalPages":2,"shown":9,"first":"Enamel Mug"}
                               oracle {"count":11,"totalPages":2,"shown":9,"first":"Enamel Mug"}
MATCH   catalogue, price desc  local {"count":112,"first":"Generic Steel Hat"}   oracle  {"count":112,…}
MATCH   search "mug"           local {"results":3}                               oracle  {"results":3}
MATCH   product detail         local {"name":"Enamel Mug","sku":"MS-MG-03","price":14.25,"quantity":120}
                               oracle {"name":"Enamel Mug","sku":"MS-MG-03","price":14.25,"quantity":120}
MATCH   migration-status       local {"verified":true,"source":204,"target":204}  oracle {"verified":true,…}
DIFFER  mongo collections visible to the API
                               local {"collections":12,…}
                               oracle {"collections":13,"names":"PRODUCTS_ENRICHED,…"}
```

One difference is expected and worth saying out loud:

| Row | Why |
|---|---|
| collections list (12 vs 13) | Oracle lists `PRODUCTS_ENRICHED`, the read-only JSON collection view, as a collection (§4 of the guide); it is not part of the source namespace |

The `quantity` row is *not* a difference any more: it used to differ (118 vs 117) because an older
harness reserved one unit per run through `POST /cart/add` and never released it. The harness now
cancels its order and the values were repaired on both backends (`_scratch/e2e/repair-stock.js`), so
product detail matches field for field — 120 / 120 in this capture.

The search row is green too: the `$options`/`$regex` defect it used to expose is analysed once, in
§2.3 — both backends now return 3 hits for `mug`.

The dashboard mixes sources and that is worth explaining on stage. On the quiet system, on both
origins, after the migration:

```
SOURCE COLLECTIONS 12 (mern_ecommerce)   TARGET COLLECTIONS 12 (mern26)
SOURCE DOCUMENTS 204                     TARGET DOCUMENTS 204      MISMATCHED 0
```

The *Migration summary* tiles take the source side from the last verification report
(`docs/26ai/migration-report.json`) and the target side **live** from the schema, so with writers
running they can read `204 / 214 / mismatched 8` while the quiet system reads `204 / 204 / 0`; the
per-collection table underneath shows the same drift, and the *Duality views* panel has the same
property (a duality view is a point-in-time copy — `pending > 0` means a document was written after
`IMPORT_ALL`).

Proof that the two origins render the same page, recorded 2026-09-30 on the same bundle:

| Route | `:8090` vs `:8080` |
|---|---|
| `/` | `document.body.innerText` identical — 3377 characters on both |
| `/shop` | identical — 3133 characters on both |
| `/shop?q=mug` | identical |
| `/support/admin-db` | identical except one row: Oracle's *Collections* panel also lists `PRODUCTS_ENRICHED` (the multiset diff of the whole page text is exactly `+PRODUCTS_ENRICHED`, `+112`, `12 collections → 13 collections`) |

Screenshots of all three pages on both origins: `_scratch/dryrun/{home,shop,admin-db}-{local,oracle}.png`,
with the extracted page text in `_scratch/dryrun/admin-db-{local,oracle}.txt`.

### 6.6 UAT — 5 min

```bash
node _scratch/e2e/api-e2e.js --base http://localhost:3001/api --label local \
  --db mongodb://127.0.0.1:27017/mern_ecommerce --json _scratch/e2e/local-final.json
node _scratch/e2e/api-e2e.js --base http://localhost:3000/api --label oracle \
  --db "$URI" --json _scratch/e2e/oracle-final.json
```

plus the page sweep (`ui-sweep.js`) and the interaction flows (`ui-flows.js`) from the same directory
(the origin that is *not* being tested is the second-origin pair `:8081`/`:8091`; §2 and §3 of
`_scratch/e2e/README.md` hold the exact invocations):

```
ui-sweep : base http://localhost:8080      apiBase http://localhost:3000/api   (Oracle side)
ui-flows : base http://localhost:8090      adminBase http://localhost:8081     apiBase http://localhost:3001/api
```
Both suites write and delete their own tagged data, and assert that collection counts are unchanged
afterwards, so run them with nothing else touching the databases (§6.1).

The page sweep is the one that leaves something behind: it registers a member through the UI and
cancels the order, but the user row and the checkout address stay in the target. Purge them before you
validate again:

```bash
node _scratch/e2e/db-helper.js purge "$URI"
# {"deleted":{"cartitems":0,"carts":0,"orders":0,"addresses":1,"wishlists":0,"reviews":0,
#             "products":0,"brands":0,"merchants":0,"users":1},
#  "emails":["e2e.sweep.<id>@example.com"]}
```

Measured on the Oracle suite: `users 8 → 7`, `addresses 5 → 4`, and `02_verify_counts.sql` back to
`12/12 MATCH` (the api-e2e suites clean themselves up fully — their drift guard proves it).

> **Use `localhost`, not `127.0.0.1`, for the API base.** On this workstation VS Code port-forwarding
> binds `127.0.0.1:3000/3001/8080/8090` itself once it detects the ports, and a request to
> `127.0.0.1:3001/api/ai/status` then answers `404`/`000` while `localhost:3001` answers `200` — an
> `api-e2e` run started on the `127.0.0.1` base simply hangs. The databases are unaffected
> (`mongod` owns `127.0.0.1:27017`), so the `--db` URI stays on `127.0.0.1`.

Results after the live migration, 2026-09-30 — **96/96 API assertions on both backends**, each ending
in `PASS  no data drift after cleanup`:

```
=== local:  96/96 passed in 20.9s ===
=== oracle: 96/96 passed in 68.6s ===
purged: users -2, wishlists -1, brands -1, contacts -1      (its own tagged rows, both runs)
db snapshot after: {"addresses":4,"brands":16,"cartitems":15,"carts":8,"categories":13,"contacts":4,
                    "merchants":4,"orders":5,"products":112,"reviews":10,"users":7,"wishlists":6}
PASS  no data drift after cleanup
```

(oracle's snapshot also lists `"PRODUCTS_ENRICHED":112`, the JSON collection view. Full logs:
`_scratch/e2e/{local,oracle}-final.json`, alongside the page sweep at **27/27** pages (plus its
**8/8** member-flow steps) and the interaction flows at **13/13** — `_scratch/e2e/README.md`.)

Measured in this runbook's own window, with another suite still cleaning up its leftovers, the same
harness scored **95/96 on both backends** — every behavioural assertion passed and the single failure
was the drift guard, because counts moved *down* mid-run while the other suite deleted its tagged rows:

```
=== local:  95/96 passed in 20.5s ===
=== oracle: 95/96 passed in 63.1s ===
FAIL  no data drift after cleanup  <-- counts went DOWN while the run was in flight
db snapshot after: {"addresses":4,"brands":16,"cartitems":15,"carts":8,"categories":13,"contacts":4,
                    "merchants":4,"orders":5,"products":112,"reviews":10,"users":7,"wishlists":6}
```

The snapshot afterwards is exactly the 204-document reference set — the guard was right to fire, and
the environment was wrong to be noisy. That is the §6.1 rule, measured.

---

## 7. Slide 11 — the live demo walk-through

Order that matches the deck (≈ 12 minutes of stage time):

1. **Slide 7 → terminal**: `ASSESS_MODE=status …` (30 s) — “here is the workload”.
2. **Slide 7 → terminal**: `ASSESS_MODE=start …`, then the read-only pass, then `ASSESS_MODE=report …`
   (2 min) — “here is every operator it uses, and here is Oracle's support for each”.
3. **Slide 8 → browser**: the Database Actions toggle, then `01_schemas.sql` (1 min).
4. **Slide 9 → terminal**: the `$sql` banner aggregation (1 min), then the same on MongoDB (20 s).
5. **Slide 9 → terminal**: `mongodump` (1 min); `mongorestore --drop` into `MERN26` (6 s live), then the
   post-restore block (§5.3, ~2 min) — grants, relational views, duality import, validity views.
   Do not skip §5.3: the target is *not* healthy for the next slide until it has run.
6. **Slide 10 → terminal**: `verify_migration.py` + `02_verify_counts.sql` (2 min).
7. **Slide 10 → browser**: `:8090` and `:8080` side by side, same page, same numbers (2 min).
8. **Slide 12 → browser**: `/support/admin-db` (1 min) — duality views, validity, vector search,
   Select AI in one screen — then `/support/llm-chat` with a question.
9. **Slide 12 → terminal** (optional but it lands the “more than JSON” claim): re-run Select AI end to
   end — `09b_select_ai_acl.sql` (ADMIN) then `09_select_ai.sql` (MERN26) — and ask for the SQL of
   *“How many products are in each category?”*:

```bash
bash _scratch/sqlrun.sh mig26-admin sql/26ai/09b_select_ai_acl.sql   # 15 s, one-time ACL (idempotent)
bash _scratch/sqlrun.sh mig26-app   sql/26ai/09_select_ai.sql        # 37 s, drops + re-creates the profile
```

   Both scripts are re-runnable (the credential and the profile are dropped first), so they can be
   re-run after every migration — that is also how `categories` was added to the profile's
   `object_list`. The profile answers `showsql` and `runsql` for the migrated catalogue:
   `SELECT JSON_VALUE(c."DATA", '$.name') … COUNT(*) … FROM "MERN26"."categories"`. Through the
   application the same question works once `SELECT_AI_PROFILE=MERN_LLM` is set in `server/.env`
   and the caller has an admin session (`POST /api/ai/ask`).

Fallbacks when a live step is slow:

| Step | If it is slow | Fallback |
|---|---|---|
| `mongosh` connect to the ADB | > 10 s | show `_scratch/planning/out/05-sql-operator-oracle.txt` (recorded output) |
| `mongorestore` | large restore | narrate over the slide; `_scratch/dryrun/05-restore.txt` is the recorded output |
| `verify_migration.py` | > 30 s | show `docs/26ai/migration-report.json` (reference 204/204) |
| Client cold start | first load compiles | pre-warm both origins before the talk (`curl -s :8090 >/dev/null`, `:8080`) |
| AI chat | provider key missing | `/api/ai/similar` needs no key (in-database ONNX model); Select AI/chat need `OCI_GENAI_API_KEY` (`/api/chat` answers `503 {error, hint}` until one is set). Rate limit: `/api/chat` and `/api/ai/*` share `RATE_LIMIT_AI` (30 per minute per IP) — a `429 {error}` during a scripted run means the budget is spent; wait a minute or start the API with `RATE_LIMIT_AI=0` |
| Any dashboard panel empty | API not restarted | `curl -s http://localhost:3000/api/admin-db/migration-status` to isolate; `curl -s http://localhost:3000/api/health` shows `{status, mongo, oracle}` |

---

## 8. Slide 12 — recap: what to say

| Recap claim | Where it is on screen |
|---|---|
| JSON collection tables with ACID transactions | `/support/admin-db` → *JSON collections*, counts on both sides |
| JSON relational duality | *Duality views* section (12 views, one per collection) |
| Native tools or GoldenGate | `mongodump` / `mongorestore` in §5; GoldenGate named as the CDC option |
| Minimal code changes | the `MONGO_URI` diff (§6.4) + one `$sql` join stage (§4.3) |
| More than JSON: analytics, ML, spatial, graph, text | relational views, `DBMS_JSON_SCHEMA` validity, `VECTOR_DISTANCE` search, Select AI — all on `/support/admin-db` and `/support/llm-chat` |
| The migration is repeatable, and the app keeps working | §5 runs `--drop` into the live target and §6 shows `verify_migration` PASS + 96/96 API assertions + 27/27 pages + 13/13 flows on the same session; the only artefact the two sides disagree on is the Oracle-only `PRODUCTS_ENRICHED` view (§6.5) |

## 9. Slide 15 — resources

* Landing page — <https://www.oracle.com/database/mongodb-migration/>
* Quick Start Guide — <https://docs.oracle.com/en/database/oracle/mdbqs/index.html>
* Reference architectures — <https://docs.oracle.com/en/solutions/mongodb-to-auto-json-db/index.html>
* GoldenGate for MongoDB Migrations — <https://blogs.oracle.com/dataintegration/goldengate-for-mongodb-migrations>
* Example tools — <https://github.com/oramatt/mongotools/wiki>
* This repo: `docs/26ai/migration-guide.md` (full guide), `docs/26ai/api-contract.md`,
  `docs/26ai/ui-inventory.md`, `_scratch/e2e/README.md`

---

## Appendix A — timings

Every number in the “dry run” column is wall-clock on this workstation on 2026-09-30, replayed from
a shell with no `ORACLE_*` exported; the per-step log is `_scratch/dryrun/timings.tsv`.

| Section | Dry run (measured) | With narration |
|---|---|---|
| Pre-flight + reset (`02_verify_counts` 15 s, `preflight.js` 1 s, source reset 3 s) | ~35 s | 3 min |
| §2 planning (`status` 0.8 s → `start` 0.1 s → traffic pass 2 s → `report` 1 s → pre-fix re-check 2 s) | 1 min | 6 min |
| §3 preparation (`01_schemas.sql` 15 s, drop `system.profile` 1 s) | 20 s | 3 min |
| §4 `$sql` (5 s Oracle + 1 s MongoDB) | 10 s | 3 min |
| §5 `mongodump` (0.2 s) / `mongorestore --drop` (6 s) | 10 s | 6 min |
| §5.3 post-restore (16 + 16 + 16 + 18 + 15 + 19 + 15 s, plus 2 × 15 s dependent checks) | 3 min | 4 min |
| §6 validation (`verify_migration` 7 s, counts 15 s, side-by-side 12 s, browser pass ~1 min) | 2 min | 10 min |
| §6.6 UAT (api-e2e 21 s + 69 s, ui-sweep ~4 min incl. the 8-step member flow) | 5 min | 10 min |
| §7 walk-through (incl. the Select AI re-run: 15 s + 37 s) | 2 min | 12 min |
| **Total, terminal only** | **≈ 13 min** | ≈ 45 min |

## Appendix B — troubleshooting seen while writing this runbook

| Symptom | Cause | Fix |
|---|---|---|
| `MongoServerError: cannot write to <db>.system.profile` | something wrote to (or truncated) `system.profile` — clients may only read it | turn profiling off, `drop()` the collection, re-enable |
| `cannot write to …` right after `setProfilingLevel(2)` | profiling was enabled on a database whose `system.profile` was left in a bad state by an earlier session | same as above; `assess_workload.js` now drops it first |
| `verify_migration.py` mentions a leftover collection | source still has `system.profile` from the planning step — the script skips `system.*` and reports it as `skipped: N MongoDB system collection(s)` | drop it before the demo (§3.2) |
| `02_verify_counts.sql` counts differ from the source for carts/orders/users/addresses | the UAT suite is writing right now | stop writers, re-run (§6.1) |
| `mongorestore` says `don't know what to do with subdirectory … skipping`, restores **0** documents and exits 0 | the target URI names a database (`…/mern26`), so `mongorestore` wants the **database directory**; the dump root is the right argument only for a URI without a database name | `mongorestore --drop --writeConcern '{w:1}' --uri "$MONGO_URI" _scratch/dump/mern_ecommerce` (§5.2). Drop `--nsFrom/--nsTo` in this form — they are ignored |
| `mongodump`/`mongorestore` install *old* product names (`Seed Wool Blanket 1790722649409`, `SEED-WB-…`) and `verify_migration.py` reports a handful of differing documents | the dump predates the catalogue rename — `_scratch/dump` is a snapshot, not a constant | re-dump the source while it is at the reference state (§5.1) and re-restore; never restore a dump you cannot date (§0.5) |
| Storefront search returns different hit counts on the two backends (0 vs 3 for `mug`) | the search endpoint used `{$regex: new RegExp(term), $options: 'is'}`; the Oracle API ignores the separate `$options` field | fixed (flags on the pattern, `routes/api/product.js`); see §2.3 — if it ever reappears, the workload assessment reports it as `UNSUPPORTED / INCOMPATIBLE constructs` |
| Every port refuses connections (`000` on 3000/3001/8080/8090/27017) | the API, client and database processes were stopped | restart them (§0.1); the source database `mern_ecommerce` lives in `.tools/mongo-data`, so a restart keeps the data — re-check the pre-flight list before presenting |
| `npm start` prints `x MongoDB connection failed: mongodb://***:***@<host>/…` and exits with code 1 | the API is **fail-fast**: it connects before it `listen`s (15 s bound), so an unreachable or wrong `MONGO_URI` stops the process instead of serving 500s | fix `MONGO_URI` in `server/.env` and restart (§0.1); the log line masks the credentials, so it is safe to show on screen |
| Dashboard “Migration summary” tiles differ from the live counts | the tiles read `docs/26ai/migration-report.json`, not the live databases | re-run `verify_migration.py` on a quiet system |
| `/api/admin-db/duality-views` shows `pending > 0` | duality views are a point-in-time copy — `IMPORT_ALL` ran before the last write | re-run `sql/26ai/06_import_duality_views.sql` |
| Web bundle looks stale on `:8080`/`:8090` (`vite preview` serves `dist/`) | the bundle was rebuilt by someone else mid-run | `npm run build` in `mern-ecommerce/web`, then reload |
| Local API returns `ORA-01017: invalid credential` for `/api/admin-db/*` | something in the environment overrode `server/.env`: dotenv never replaces an exported variable (a stale `ORACLE_APP_USER`/`ORACLE_APP_PASSWORD` in the shell wins over the file), and `node --env-file=server/.env` truncates an unquoted value at `#` (`abc#123` → `abc`) | fixed in `server/.env` — the `#` value is quoted and `ORACLE_CONNECT_STRING` is the full TLS descriptor. Start the API with **no** `ORACLE_*` exported: `cd mern-ecommerce/server && npm start`. Diagnose without printing the secret: `node -e "require('dotenv').config();console.log((process.env.ORACLE_APP_PASSWORD\|\|'').length)"`. The app pool never falls back to `ORACLE_USER`/`ORACLE_PASSWORD` (the ADMIN setup credentials), so a missing `ORACLE_APP_*` disables SQL access instead of connecting as ADMIN |
| `npm start` fails instantly: `exec: node: not found`, or `Could not read package.json … H:\github\package.json` | a runner that spawns commands from another directory with no `node` on `PATH` | wrap it as in §0.1 (`bash -c 'cd mern-ecommerce/server && export PATH="/c/Program Files/nodejs:$PATH" && exec npm start'`) — a presenter's own terminal needs none of that |
| `curl http://127.0.0.1:8080/` → `000` although the client is up | `vite preview` binds IPv6 `::1` only | probe `localhost`; the browser tabs are `localhost` too (§0.4) |
| `api-e2e` hangs with no output; `curl 127.0.0.1:3001/api/ai/status` → `404`/`000` while `localhost:3001` → `200` | VS Code port-forwarding bound `127.0.0.1:3000/3001/8080/8090` itself | run the harnesses on `--base http://localhost:<port>/api` (§6.6); the `--db` URI stays on `127.0.0.1:27017` |
| After the restore `MERN26DV` gets `ORA-00942: table or view "MERN26"."users" does not exist`, and `/api/admin-db/duality-views` has no rows | `--drop` recreated the collection tables, so the cross-schema grants are gone | re-run the §5.3 block, starting with `03_grants_after_restore.sql` and `03b_grants_duality_to_data.sql` |
| `user_objects` lists 11 views (and the `products_enriched` synonym) as `INVALID` right after the restore | the JSON collection tables were dropped and recreated under the views and the JSON collection view | `sql/26ai/04_relational_views.sql` (§5.3). The views still return correct rows, but re-create them so the dashboard is not reporting invalid objects |
| `/support/llm-chat` reports Select AI as unavailable, or Select AI answers from a schema without the new object (a category question planned as `FROM "MERN26"."products"`) | the `MERN_LLM` profile predates the current `object_list` — a profile is a stored attribute, so editing `09_select_ai.sql` does not change the live profile | re-run `09b_select_ai_acl.sql` + `09_select_ai.sql` (§7). Both are re-runnable; the key lives in the gitignored `sql/26ai/09_select_ai_key.sql` |
| After `ui-sweep` the target has one extra member + one extra address and `02_verify_counts.sql` reports MISMATCH | the page sweep registers a member through the UI and cancels its order, but the user row and the checkout address stay | `node _scratch/e2e/db-helper.js purge "$URI"` (removes the tagged `e2e.sweep.`/`walk.`/`diag.chat.` users and their rows), then re-run §6.2/§6.3 |
