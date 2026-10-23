# Validate and Cut Over the App

## Introduction

A migration is finished only when you can prove that nothing was lost and the application works against the new database. This lab is the **validate** stage, and it ends with the cut-over: you change one line in `server/.env` and the unchanged storefront runs on Autonomous AI Database.

You prove the data is complete in two independent ways: a document-by-document comparison through the Oracle Database API for MongoDB, and a count in SQL. Then you switch the application and browse it.

Estimated Time: 25 minutes

### Objectives

In this lab, you will:

* Verify that every document in Autonomous AI Database matches the MongoDB source with `verify_migration.py`
* Count the collections in SQL with `02_verify_counts.sql`
* Point the storefront at Autonomous AI Database and restart the API
* Browse the storefront and the migration dashboard running on Oracle

### Prerequisites

This lab assumes you have:

* Completed **Lab 6: Migrate the Data**
* Python 3.10+ installed
* The source MongoDB container still running, and `TARGET_URI`, `ORACLE_CONNECT_STRING` and `DB_PASSWORD` (the `ADMIN` password) set in the terminal you used in Lab 6 (the **SQL terminal**)
* A terminal open at the **root of the cloned repository**

> **Note:** Stop all writers before you validate. Any activity on the storefront (orders, registrations, reviews) creates rows on one side only. They show up as `missing` or `extra` ids and count mismatches. Do not click through the storefront until Task 3.

## Task 1: Verify the documents

This is the authoritative proof of the migration. `scripts/verify_migration.py` compares, per collection, the sets of `_id` values, the document counts and a canonical hash of every document. Numbers are compared by exact value, and dates, decimals, binary data and ObjectIds are normalized first. It needs `pymongo`.

1. Create a Python virtual environment and install the dependencies.

    <if type="linux">

    ```bash
    <copy>
    python3 -m venv .venv
    source .venv/bin/activate
    pip install -r scripts/requirements.txt
    </copy>
    ```

    </if>

    <if type="windows">

    ```powershell
    <copy>
    py -m venv .venv
    .\.venv\Scripts\Activate.ps1
    pip install -r scripts/requirements.txt
    </copy>
    ```

    </if>

2. Run the verification. `--source` and `--target` are both required, and both must name the database. The JSON report goes to `dump/`, which is git-ignored, so a failing run can never overwrite the report the dashboard reads.

    <if type="linux">

    ```bash
    <copy>
    python scripts/verify_migration.py \
      --source "mongodb://127.0.0.1:27017/mern_ecommerce" \
      --target "$TARGET_URI" \
      --report dump/migration-report.json
    </copy>
    ```

    </if>

    <if type="windows">

    ```powershell
    <copy>
    python scripts/verify_migration.py `
      --source "mongodb://127.0.0.1:27017/mern_ecommerce" `
      --target $env:TARGET_URI `
      --report dump/migration-report.json
    </copy>
    ```

    </if>

3. Read the result. You should see `[OK]` with `missing=0 extra=0 differing=0` for every collection, and this last line:

    ```text
    RESULT: PASS - source and target documents match
    ```

    The header lines show how many collections each side has. The exit code is `0` for PASS, `1` for a mismatch or nothing compared, and `2` for a setup error such as a URI without a database name.

    > **Note:** If the output mentions `skipped: 1 MongoDB system collection(s)`, you did not drop the `system.profile` collection in Lab 4. It does not affect the result.

4. Copy the PASS report to where the dashboard looks for it. The dashboard's source counts come from `docs/26ai/migration-report.json`. Copy only a PASS report.

    <if type="linux">

    ```bash
    <copy>
    cp dump/migration-report.json docs/26ai/migration-report.json
    </copy>
    ```

    </if>

    <if type="windows">

    ```powershell
    <copy>
    Copy-Item dump/migration-report.json docs/26ai/migration-report.json
    </copy>
    ```

    </if>

## Task 2: Verify the counts in SQL

This second check confirms the same data is visible from SQL, not only through the MongoDB API. The script counts the documents of every JSON collection table in the `MERN26` schema, live, and has no expected values of its own.

1. Run the SQL count check as `ADMIN`.

    <if type="linux">

    ```bash
    <copy>
    bash scripts/workshop/run-sql.sh ADMIN sql/26ai/02_verify_counts.sql
    </copy>
    ```

    </if>

    <if type="windows">

    ```powershell
    <copy>
    .\scripts\workshop\run-sql.ps1 -User ADMIN -File sql/26ai/02_verify_counts.sql
    </copy>
    ```

    </if>

2. Compare the table with the **collections** table and the `TOTAL` line you noted in Lab 4. The names and the counts must be identical: 12 collections for the seeded storefront. The numbers below are an example for a freshly seeded source.

    ```text
    COLLECTION               DOCUMENTS
    ----------------------------------
    addresses                        1
    brands                          10
    cartitems                        4
    ...
    users                            1
    wishlists                        1
    ----------------------------------
    TOTAL                          133  (12 collections)
    ```

    > **Note:** An `ORA-28098` password-expiry warning on `ADMIN` is a profile notice, not a migration problem.

## Task 3: Cut over the application

The cut-over is a configuration change: the Mongoose models, routes and driver stay as they are. In this task you replace the source `MONGO_URI` with the target one and add the settings the SQL endpoints need.

The table shows what changes in `mern-ecommerce/server/.env`:

| | Before (Lab 3, MongoDB) | After (Oracle) |
| --- | --- | --- |
| `MONGO_URI` | `mongodb://127.0.0.1:27017/mern_ecommerce` | `mongodb://MERN26:<MERN26 password>@<adb-host>:27017/mern26?loadBalanced=true&...` |
| Database | `mern_ecommerce` in the MongoDB container | `mern26`, the `MERN26` schema in Autonomous AI Database |
| Product list query | Three `$lookup` stages (`mongoJoinStages`) | One `$sql` stage (`oracleJoinStage`), selected because the URI contains `loadBalanced` |
| SQL access (`ORACLE_*`) | Not set | Connect string, `MERN26` user and password |

1. Stop the API: in the terminal where `npm start` is running (Lab 3), press `Ctrl+C`.

2. Open `mern-ecommerce/server/.env` in an editor.

    <if type="linux">

    ```bash
    <copy>
    nano mern-ecommerce/server/.env
    </copy>
    ```

    </if>

    <if type="windows">

    ```powershell
    <copy>
    notepad mern-ecommerce\server\.env
    </copy>
    ```

    </if>

3. Replace the `MONGO_URI` line with the Oracle MongoDB API URI, and add the SQL access variables. The URI has the same format as `TARGET_URI`, but in `.env` the `$external` is written literally.

    ```text
    <copy>
    MONGO_URI=mongodb://MERN26:<MERN26 password>@<adb-host>:27017/mern26?loadBalanced=true&retryWrites=false&authMechanism=PLAIN&authSource=$external&tls=true
    ORACLE_CONNECT_STRING='<your TLS connect string from Lab 2>'
    ORACLE_APP_USER=MERN26
    ORACLE_APP_PASSWORD='<MERN26 password>'
    </copy>
    ```

    * `loadBalanced=true` is also the switch that moves `server/utils/queries.js` onto its `$sql` branch (Lab 4), so the connection string is both the endpoint and the feature flag.
    * `ORACLE_CONNECT_STRING` must be the full TLS descriptor (`(description= ... )`) or the EZConnect form `tcps://<adb-host>:1522/<service_name>?ssl_server_dn_match=yes`. A bare service name does not resolve (`NJS-516`). Keep the quotes.
    * `ORACLE_APP_USER` and `ORACLE_APP_PASSWORD` are the account the application uses for SQL endpoints such as the migration dashboard. `ORACLE_DV_USER` defaults to `MERN26DV`. Quote any password that contains `#`.

4. Restart the API from the `mern-ecommerce/server` directory, **in a terminal where no `ORACLE_*` variable is exported**. Use the API terminal from Lab 3, which is already in that directory, and not the SQL terminal you keep for Labs 8 to 10. A variable already in the environment wins over `.env`, and a stale value gives `ORA-01017: invalid credential`. If you use another terminal, change to the directory first. The commands below clear the variables.

    <if type="linux">

    ```bash
    <copy>
    unset ORACLE_CONNECT_STRING ORACLE_APP_USER ORACLE_APP_PASSWORD
    npm start
    </copy>
    ```

    </if>

    <if type="windows">

    ```powershell
    <copy>
    Remove-Item Env:ORACLE_CONNECT_STRING, Env:ORACLE_APP_USER, Env:ORACLE_APP_PASSWORD -ErrorAction SilentlyContinue
    npm start
    </copy>
    ```

    </if>

    The API connects before it listens, so an unreachable or wrong `MONGO_URI` stops it with `MongoDB connection failed` (the credentials in that message are masked). Fix `.env` and start again.

5. In another terminal, check the health endpoint.

    <if type="linux">

    ```bash
    <copy>
    curl -s http://localhost:3000/api/health
    </copy>
    ```

    </if>

    <if type="windows">

    ```powershell
    <copy>
    Invoke-RestMethod http://localhost:3000/api/health
    </copy>
    ```

    </if>

    You should see `"mongo":"up"` and `"oracle":"up"`. Here `mongo` means the MongoDB API connection, which is now served by Autonomous AI Database. The React client keeps running; it only talks to the API.

## Task 4: Use the storefront on Oracle

Confirm the application behaves the same on the new database. Every step below runs against Autonomous AI Database.

1. Open `http://localhost:8080` and browse **Shop**. You should see the same products as before. The product list now runs the single `$sql` stage in place of the three `$lookup` stages.

2. Search for a product name in lowercase, then in uppercase. You should see the same hits both times, because the case-insensitive flag is on the pattern (Lab 4).

3. Sign in as `admin@example.com` with the password from Lab 3. The seeded admin account was migrated with the rest of the `users` collection.

4. Open `http://localhost:8080/support/admin-db`. This is the migration dashboard: source counts come from the report you copied in Task 1, target counts are read from the database, and each collection is marked `match` when they agree.

    When the API is up, these are the last two lines of its start-up output. `MongoDB Connected!` now means that the Oracle Database API for MongoDB answered:

    ```text
    ✓ MongoDB Connected!
    ✓ API listening on port 3000. Start the web client and open http://localhost:8080/ for the storefront.
    ```

    ![The migration dashboard at /support/admin-db with source and target collection counts and a Verified chip](images/migration-dashboard.png " ")

    > **Note:** The screenshot was taken after Lab 9, with 133 documents in 12 collections. Panels about duality views, validity views and vector search stay empty (or show an error) until Labs 8 and 9. Your counts are those of your seeded dataset.

5. Optional: run a `$sql` stage yourself. `$sql` is an Oracle extension of the aggregation pipeline that runs a SQL statement and returns each row as a document. It is the same mechanism the storefront uses for the product list. Open a shell on the target.

    <if type="linux">

    ```bash
    <copy>
    mongosh "$TARGET_URI"
    </copy>
    ```

    </if>

    <if type="windows">

    ```powershell
    <copy>
    mongosh $env:TARGET_URI
    </copy>
    ```

    </if>

6. Paste the aggregation at the `mongosh` prompt.

    ```javascript
    <copy>
    db.aggregate([{$sql: 'select banner from v$version'}])
    </copy>
    ```

    You should see a document with the Oracle AI Database 26ai banner. The same pipeline against your local MongoDB fails with `Unrecognized pipeline stage name: '$sql'`, because MongoDB has no `$sql` stage. That difference is why the storefront needs the `loadBalanced` switch.

7. Type `exit` to leave `mongosh`.

You have migrated a MongoDB application to Autonomous AI Database and verified it. You may now **proceed to the next lab**.

## Learn More

* [Quick Start Guide for MongoDB Migrations](https://docs.oracle.com/en/database/oracle/mdbqs/index.html)
* [Aggregation pipelines (`$sql`)](https://docs.oracle.com/en/database/oracle/mongodb-api/mgapi/pipelines.html)
* [Source repository: jasperan/mongodb-migrate-oci](https://github.com/jasperan/mongodb-migrate-oci)

## Acknowledgements

* **Author** - Ignacio Martinez, Oracle
* **Last Updated By/Date** - Ignacio Martinez, October 2026
