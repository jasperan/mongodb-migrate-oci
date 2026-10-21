# Assess the MongoDB Workload

## Introduction

Oracle's migration process has four stages: **plan, prepare, execute, validate**. This lab is the **plan** stage. Before you move any data, you find out what the storefront actually sends to MongoDB and check every operator against the support matrix of the Oracle Database API for MongoDB. That check tells you which parts of the application need attention, instead of letting you discover them in production.

You use `assess_workload.js`, a dependency-free `mongosh` script in the repository. It runs against the source MongoDB only; nothing in this lab touches Autonomous AI Database.

Estimated Time: 20 minutes

### Objectives

In this lab, you will:

* Record the size of the source database (the numbers you compare with after the migration)
* Profile a real browsing session with the MongoDB profiler
* Read the compatibility report and understand the four code patterns the storefront had to change

### Prerequisites

This lab assumes you have:

* Completed **Lab 3: Run the Storefront on MongoDB**, with the MongoDB container, the API (`npm start`) and the client (`npm run dev`) still running
* A new terminal open at the **root of the cloned repository**

## Task 1: Capture the source status

Record what the source contains now, so you can prove later that nothing was lost. The `status` mode prints `db.serverStatus()` (version, uptime, connections, operation counters) and the document count of every collection.

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

2. Find the **collections** table and its `TOTAL` line, and write the numbers down. You compare them with the target in Labs 6 and 7.

    You should see 12 collections and a `TOTAL` of 133 documents for the seeded storefront with the sample activity from Lab 3 (100 products, 10 brands, 10 categories and 13 documents in the other nine collections).

## Task 2: Start the profiler and generate traffic

The MongoDB profiler records every operation the database receives. Profiling shows what the application really runs, which is more reliable than reading the code. The `start` mode drops any earlier `system.profile` collection (where the profiler stores its records) and then calls `db.setProfilingLevel(2)`, so every operation is recorded.

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

    You should see `profiling level now` set to `2`.

2. Open the storefront at `http://localhost:8080` and use it the way a shopper would:

    * Open the home page and **Shop**
    * Change the sort order and page
    * Filter by a category and by a brand
    * Type a word from a product name into the search box
    * Open a few product pages

    > **Note:** Keep this session **read-only**. Do not place orders or register users while profiling, so the report shows the read paths.

## Task 3: Report and read the findings

The `report` mode summarizes what the profiler recorded and judges each operator against the support matrix. It switches profiling **off first**, so a run can never leave profiling enabled.

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

    | Section | What it tells you |
    | --- | --- |
    | **operations by type and collection** | What the application ran against which collection |
    | **shapes observed** | The number of `find` and `aggregate` operations, and how many pipelines use `$lookup` |
    | **aggregation stages**, **query operators**, **expressions** | One line per construct, marked `[ok]` with the first Oracle release that supports it (for example `$match` since 19c, `$lookup` since 26ai), or `[!!]` if it is not supported |
    | **targeted compatibility check: `$regex` with a separate `$options`** | Any `{$regex: ..., $options: ...}` filter, which the Oracle Database API for MongoDB handles differently (see Task 5) |
    | **verdict** | Whether every construct observed is supported |

    For reference, the repository's own run (125 profile entries) found 71 `find` and 50 `aggregate` operations. `$lookup` is the one construct with real restrictions on Oracle. Your counts differ with your browsing, but the pattern is the same.

3. Drop the profile collection. Profiling is already off, and the source database should not keep this artifact. If you leave it, the verification script in Lab 7 reports it as a skipped system collection.

    ```bash
    <copy>
    mongosh "mongodb://127.0.0.1:27017/mern_ecommerce" --quiet --eval "db.getCollection('system.profile').drop()"
    </copy>
    ```

## Task 4: Review the supported client versions

The Oracle Database API for MongoDB requires clients that support **load-balanced connections** (a connection option, `loadBalanced=true`, that you use in every connection string from Lab 6 on). These are the minimum versions from the migration guide.

| Client | Minimum version |
| --- | --- |
| mongosh | 0.15.6 |
| Database Tools (`mongodump`, `mongorestore`) | 100.5.0 |
| Node.js driver (through Mongoose 6.10.0) | 4.1.0 |
| PyMongo (`scripts/verify_migration.py`) | 3.12.0 |
| Compass | 1.28.1 |

1. Check the versions on your workstation.

    ```bash
    <copy>
    mongosh --version
    mongodump --version
    </copy>
    ```

    You should see versions at or above the minimums in the table.

## Task 5: Understand the code changes the assessment justifies

The assessment matters because each difference between the two backends returns a wrong or empty answer, not always a loud error. Running the same storefront on both backends needed four code changes and one tooling difference:

| Pattern | What the Oracle Database API for MongoDB does | What the storefront does |
| --- | --- | --- |
| `$lookup` | No `let`; an error if `localField` is an array, is missing from any input document, or occurs more than once in one | `GET /api/product/list` joins brands, approved reviews and the wishlist flag with **one `$sql` stage** on Oracle (`server/utils/queries.js`). `loadBalanced=true` in `MONGO_URI` selects that branch |
| `$elemMatch` in an update filter | Rejected (`Invalid query opcode:$elemMatch`); reads accept it | Order-line updates address the array element by index with a conditional filter (`setLineStatus` in `server/utils/store.js`) |
| `$regex` with a separate `$options` | `$options` is ignored, so search becomes case-sensitive | The flags live on the pattern: `new RegExp(term, 'i')` (`server/routes/api/product.js`) |
| Numeric limits | `skip` must fit in int32; `NUMBER` tops out near 1e126 | The API clamps paging and numeric filters so both backends answer the same |
| `profiler` command (tooling) | Not available | Profile the source; use SQL Monitor on the target |

1. Open `mern-ecommerce/server/utils/queries.js` and find the line that selects the branch. It runs once at start-up: `ORACLE_API = /loadBalanced/i.test(process.env.MONGO_URI)`.

2. Compare the two branches. The MongoDB branch (`mongoJoinStages`) keeps the three `$lookup` stages. The Oracle branch (`oracleJoinStage`) replaces them with one `$sql` stage, which runs a SQL join inside the aggregation pipeline.

    This is the key to the cut-over in Lab 7: the connection string is both the endpoint and the feature flag. Nothing else in the application changes.

> **Why does the search case matter?** On the reference data, the search for `mug` returned 3 products on MongoDB and 0 on Oracle when the flags were in a separate `$options` field. The response was still `200` with an empty array, so nothing looked broken until the search box came up empty.

You may now **proceed to the next lab**.

## Learn More

* [Feature support of the Oracle Database API for MongoDB](https://docs.oracle.com/en/database/oracle/mongodb-api/mgapi/support-mongodb-apis-operations-and-data-types-reference.html)
* [Aggregation pipelines (`$sql`, `$external`, `$lookup`)](https://docs.oracle.com/en/database/oracle/mongodb-api/mgapi/pipelines.html)
* [Quick Start Guide for MongoDB Migrations](https://docs.oracle.com/en/database/oracle/mdbqs/index.html)

## Acknowledgements

* **Author** - Ignacio Martinez, Oracle
* **Last Updated By/Date** - Ignacio Martinez, October 2026
