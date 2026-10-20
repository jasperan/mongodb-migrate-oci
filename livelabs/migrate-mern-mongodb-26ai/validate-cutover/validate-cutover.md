# Validate and Cut Over the App

## Introduction

A migration is finished only when you can prove that nothing was lost and the application works against the new database. In this lab you compare source and target document by document, check the counts in SQL, and then perform the cut-over: one line in `server/.env` points the unchanged storefront at Oracle.

Estimated Time: 25 minutes

### Objectives

In this lab, you will:

* Verify that every document in Oracle matches the MongoDB source with `verify_migration.py`
* Count the collections in SQL with `02_verify_counts.sql`
* Point the application at Autonomous AI Database and restart the API
* Browse the storefront and the migration dashboard running on Oracle

### Prerequisites

This lab assumes you have:

* Completed **Lab 6: Migrate the Data**
* Python 3.10+ installed
* The source MongoDB container still running, and `TARGET_URI`, `ORACLE_CONNECT_STRING` and `DB_PASSWORD` (the `ADMIN` password) set in the terminal you used in Lab 6 (the **SQL terminal**)
* A terminal open at the **root of the cloned repository**

> **Stop all writers before you validate.** Any activity on the storefront (orders, registrations, reviews) creates rows on one side that show up as `missing` or `extra` ids and count mismatches. Do not click through the storefront until Task 3.

## Task 1: Verify the documents

`scripts/verify_migration.py` compares, per collection, the sets of `_id` values, the document counts and a canonical hash of every document (numbers by exact value; dates, decimals, binary data and ObjectIds normalized). It needs `pymongo`.

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

2. Run the verification. `--source` and `--target` are both required and must name the database. The JSON report goes to `dump/`, which is git-ignored, so a failing run can never overwrite the report the dashboard reads.

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

3. Read the result. Every collection must show `[OK]` with `missing=0 extra=0 differing=0`, and the last line must be:

    ```
    RESULT: PASS - source and target documents match
    ```

    The exit code is `0` for PASS, `1` for a mismatch or nothing compared, and `2` for a setup error such as a URI without a database name. The header line shows how many collections each side has. If the output mentions `skipped: 1 MongoDB system collection(s)`, the `system.profile` collection from Lab 4 was not dropped; it does not affect the result.

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

2. Read the table. The script has no expected values: it counts the documents of every JSON collection table in the `MERN26` schema, live, and prints one line per collection and a `TOTAL`. Compare it with the **collections** table and the `TOTAL` line you noted in Lab 4: the names and the counts must be identical (12 collections for the seeded storefront).

    ```
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

    The numbers above are an example for a freshly seeded source. The document-level check in Task 1 is the authoritative proof; the SQL count confirms the same data is visible from SQL, not only through the MongoDB API. An `ORA-28098` password-expiry warning on `ADMIN` is a profile notice, not a migration problem.

## Task 3: Cut over the application

The cut-over is a configuration change. The Mongoose models, routes and driver stay as they are.

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

3. Replace the `MONGO_URI` line with the Oracle MongoDB API URI, and set the SQL access variables. The format is the same as `TARGET_URI`, but in `.env` the `$external` is written literally:

    ```
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

4. Restart the API from the `mern-ecommerce/server` directory, **in a terminal where no `ORACLE_*` variable is exported** (the API terminal from Lab 3, not the SQL terminal that you keep for Labs 8 to 10). A variable already present in the environment wins over `.env`, and a stale value gives `ORA-01017: invalid credential`. The first terminal from Lab 3 (already in that directory) is the right place; if you use another one, change to the directory and clear the variables first.

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

    A healthy answer reports `"mongo":"up"` and `"oracle":"up"`. The React client keeps running; it only talks to the API.

## Task 4: Use the storefront on Oracle

1. Open `http://localhost:8080` and browse **Shop**. The same products appear, now served by the Oracle Database API for MongoDB. The product list runs the single `$sql` pipeline that replaced the three `$lookup` stages.

2. Search for a product name in lowercase, then in uppercase. Both return the same hits, because the flags are on the pattern (Lab 4).

3. Sign in as `admin@example.com` with the password from Lab 3. The seeded admin account was migrated with the rest of the `users` collection.

4. Open `http://localhost:8080/support/admin-db`. This is the migration dashboard: source counts come from the report you copied in Task 1, target counts are read from the database, and each collection is marked `match` when they agree.

    ![The migration dashboard at /support/admin-db with source and target collection counts and a Verified chip](images/migration-dashboard.png " ")

    > **Note:** The screenshot was taken after Lab 9, with 133 documents in 12 collections. Panels about duality views, validity views and vector search stay empty (or show an error) until Labs 8 and 9. Your counts are those of your seeded dataset.

5. Optional: run the `$sql` stage yourself. Open a shell on the target, paste the aggregation, and exit.

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

    ```
    <copy>
    db.aggregate([{$sql: 'select banner from v$version'}])
    </copy>
    ```

    The result is a document with the Oracle AI Database 26ai banner. `$sql` is an Oracle extension: the same pipeline against your local MongoDB fails with `Unrecognized pipeline stage name: '$sql'`. Type `exit` to leave mongosh.

You have migrated a MongoDB application to Oracle AI Database 26ai and verified it. You may now **proceed to the next lab**.

## Learn More

* [Quick Start Guide for MongoDB Migrations](https://docs.oracle.com/en/database/oracle/mdbqs/index.html)
* [Aggregation pipelines (`$sql`)](https://docs.oracle.com/en/database/oracle/mongodb-api/mgapi/pipelines.html)
* [Source repository: oracle-devrel/mongodb-migrate-oci](https://github.com/oracle-devrel/mongodb-migrate-oci)

## Acknowledgements

* **Author** - Ignacio Martinez, Oracle
* **Last Updated By/Date** - Ignacio Martinez, October 2026
