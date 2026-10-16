# Assess the MongoDB Workload

## Introduction

Oracle's migration process is **plan, prepare, execute, validate**. Planning means profiling what the application actually sends to MongoDB and checking every operator against the support matrix of the Oracle Database API for MongoDB. The repository includes `assess_workload.js`, a mongosh script with no dependencies that does this against the source database.

Estimated Time: 20 minutes

### Objectives

In this lab, you will:

* Capture the state of the source MongoDB with `db.serverStatus()`
* Profile a real browsing session with the MongoDB profiler
* Read the compatibility report and understand the four code patterns the application had to change

### Prerequisites

This lab assumes you have:

* Completed **Lab 3: Run the Storefront on MongoDB**, with the MongoDB container, the API (`npm start`) and the client (`npm run dev`) still running
* A new terminal open at the **root of the cloned repository**

## Task 1: Capture the source status

The `status` mode prints `db.serverStatus()` (version, uptime, connections, operation counters) and the document count of every collection.

1. Run the assessment in `status` mode.

    <if type="linux">

    ```bash
    <copy>
    ASSESS_MODE=status mongosh "mongodb://127.0.0.1:27017/mern_ecommerce" \
      --file mern-ecommerce/server/scripts/assess_workload.js
    </copy>
    ```

    </if>

    <if type="windows">

    ```powershell
    <copy>
    $env:ASSESS_MODE = "status"
    mongosh "mongodb://127.0.0.1:27017/mern_ecommerce" --file mern-ecommerce/server/scripts/assess_workload.js
    </copy>
    ```

    </if>

2. Note the **collections** table and its `TOTAL` line. You compare these counts with the target after the migration. For the seeded storefront with the sample activity from Lab 3 it shows 12 collections and a `TOTAL` of 133 documents (100 products, 10 brands, 10 categories and a few documents in the other collections). The random catalogue can make your counts differ slightly.

## Task 2: Start the profiler and generate traffic

The `start` mode drops any earlier `system.profile` collection and then calls `db.setProfilingLevel(2)`, so every operation is recorded.

1. Start profiling.

    <if type="linux">

    ```bash
    <copy>
    ASSESS_MODE=start mongosh "mongodb://127.0.0.1:27017/mern_ecommerce" \
      --file mern-ecommerce/server/scripts/assess_workload.js
    </copy>
    ```

    </if>

    <if type="windows">

    ```powershell
    <copy>
    $env:ASSESS_MODE = "start"
    mongosh "mongodb://127.0.0.1:27017/mern_ecommerce" --file mern-ecommerce/server/scripts/assess_workload.js
    </copy>
    ```

    </if>

    The output ends with `profiling level now : 2`.

2. In your browser, use the storefront at `http://localhost:8080` the way a shopper would, **read-only**:

    * Open the home page and **Shop**
    * Change the sort order and page
    * Filter by a category and by a brand
    * Type a word from a product name into the search box (for example, part of a product name you saw earlier)
    * Open a few product pages

    Do not place orders or register users during the profiling window; the point is to record the read paths.

## Task 3: Report and read the findings

The `report` mode switches profiling **off first** and only then summarizes `system.profile`, so the run can never leave profiling enabled.

1. Print the report.

    <if type="linux">

    ```bash
    <copy>
    ASSESS_MODE=report mongosh "mongodb://127.0.0.1:27017/mern_ecommerce" \
      --file mern-ecommerce/server/scripts/assess_workload.js
    </copy>
    ```

    </if>

    <if type="windows">

    ```powershell
    <copy>
    $env:ASSESS_MODE = "report"
    mongosh "mongodb://127.0.0.1:27017/mern_ecommerce" --file mern-ecommerce/server/scripts/assess_workload.js
    </copy>
    ```

    </if>

2. Read the sections of the report:

    * **operations by type and collection**: what the application ran against which collection.
    * **shapes observed**: the number of `find` and `aggregate` operations, and how many pipelines use `$lookup`.
    * **aggregation stages**, **query operators** and **expressions**: each line is marked `[ok]` with the first Oracle release that supports it (for example `$match` since 19c, `$lookup` since 26ai), or `[!!]` if it is not supported.
    * **targeted compatibility check: $regex with a separate $options**: reports any `{$regex: ..., $options: ...}` filter, which the Oracle API handles differently (see Task 5).
    * **verdict**: whether every construct observed is supported.

    For reference, the repository's own run (125 profile entries) found 71 `find` and 50 `aggregate` operations, with `$lookup` as the one construct that has real restrictions on Oracle.

3. Clean up after planning: profiling is already off, so drop the profile collection. The source database should not keep this artifact, and the verification script in Lab 7 reports it as a skipped system collection if you leave it.

    ```
    <copy>
    mongosh "mongodb://127.0.0.1:27017/mern_ecommerce" --quiet --eval "db.getCollection('system.profile').drop()"
    </copy>
    ```

## Task 4: Review the supported client versions

The Oracle Database API for MongoDB requires clients that support **load-balanced connections**. These are the minimum versions from the migration guide.

| Client | Minimum version |
|---|---|
| mongosh | 0.15.6 |
| Database Tools (`mongodump`, `mongorestore`) | 100.5.0 |
| Node.js driver (through Mongoose 6.10.0) | 4.1.0 |
| PyMongo (`scripts/verify_migration.py`) | 3.12.0 |
| Compass | 1.28.1 |

1. Check the versions on your workstation.

    ```
    <copy>
    mongosh --version
    mongodump --version
    </copy>
    ```

## Task 5: Understand the code changes the assessment justifies

Running the same storefront on both backends needed four code changes and one tooling difference. They are the reason the assessment matters: each one returns a wrong or empty answer, not always a loud error.

| Pattern | What the Oracle API does | What the application does |
|---|---|---|
| `$lookup` | No `let`; an error if `localField` is an array, is missing from any input document, or occurs more than once in one | `GET /api/product/list` joins brands, approved reviews and the wishlist flag with **one `$sql` stage** on Oracle (`server/utils/queries.js`). `loadBalanced=true` in `MONGO_URI` selects that branch |
| `$elemMatch` in an update filter | Rejected (`Invalid query opcode:$elemMatch`); reads accept it | Order-line updates address the array element by index with a conditional filter (`setLineStatus` in `server/utils/store.js`) |
| `$regex` with a separate `$options` | `$options` is ignored, so search becomes case-sensitive | The flags live on the pattern: `new RegExp(term, 'i')` (`server/routes/api/product.js`) |
| Numeric limits | `skip` must fit in int32; `NUMBER` tops out near 1e126 | The API clamps paging and numeric filters so both backends answer the same |
| `profiler` command (tooling) | Not available | Profile the source; use SQL Monitor on the target |

1. Open `mern-ecommerce/server/utils/queries.js` and find the line that selects the branch. It runs once at start-up: `ORACLE_API = /loadBalanced/i.test(process.env.MONGO_URI)`. The MongoDB branch (`mongoJoinStages`) keeps the three `$lookup` stages; the Oracle branch (`oracleJoinStage`) replaces them with one `$sql` stage.

2. Note what that means for the cut-over in Lab 7: the connection string is both the endpoint and the feature flag. Nothing else in the application changes.

> **Why does the search case matter?** On the reference data, the search for `mug` returned 3 products on MongoDB and 0 on Oracle when the flags were in a separate `$options` field. The response was still `200` with an empty array, so nothing looked broken until the search box came up empty.

You may now **proceed to the next lab**.

## Learn More

* [Feature support of the Oracle Database API for MongoDB](https://docs.oracle.com/en/database/oracle/mongodb-api/mgapi/support-mongodb-apis-operations-and-data-types-reference.html)
* [Aggregation pipelines (`$sql`, `$external`, `$lookup`)](https://docs.oracle.com/en/database/oracle/mongodb-api/mgapi/pipelines.html)
* [Quick Start Guide for MongoDB Migrations](https://docs.oracle.com/en/database/oracle/mdbqs/index.html)

## Acknowledgements

* **Author** - Ignacio Martinez, Oracle
* **Last Updated By/Date** - Ignacio Martinez, October 2026
