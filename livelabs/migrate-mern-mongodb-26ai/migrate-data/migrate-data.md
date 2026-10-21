# Migrate the Data

## Introduction

This lab is the **execute** stage, where the data moves. You dump the MongoDB source with `mongodump` and restore it into the `MERN26` schema of Autonomous AI Database with `mongorestore`, through the Oracle Database API for MongoDB. These are the standard MongoDB tools, so no custom migration code is involved.

The workshop script `migrate-data` runs both tools in the right order with the right arguments. One of those arguments is easy to get wrong without any error message (Task 3 explains it).

This is an **offline** migration: the dump is a snapshot, so writes to the source must stop while you run it. Online migration (continuous replication) is out of scope for this workshop.

Estimated Time: 15 minutes

### Objectives

In this lab, you will:

* Build the MongoDB API connection string (`TARGET_URI`) for the `MERN26` schema
* Dump the source and restore it into Autonomous AI Database with the workshop script
* Understand why the dump directory must match the target URI
* Grant the restored collections to `MERN26DV` and verify the data with `mongosh`

### Prerequisites

This lab assumes you have:

* Completed **Lab 5: Prepare the Target Schemas** (the `MERN26` and `MERN26DV` schemas exist and are ORDS-enabled)
* `MONGO_API_HOST` from Lab 2 (the host name in the MongoDB API URL on the database's **Tool configuration** tab)
* MongoDB Database Tools (`mongodump`, `mongorestore`) and `mongosh` installed
* The source MongoDB container from Lab 3 still running
* A terminal open at the **root of the cloned repository**, with `ORACLE_CONNECT_STRING`, `MONGO_API_HOST`, `DB_PASSWORD` (the `ADMIN` password) and the Lab 5 variables set. If you opened a new terminal, set them again as in Lab 5

> **Note:** Do not use the storefront while the migration runs. Orders or registrations written to MongoDB after the dump are not copied, and they show up as differences in Lab 7.

## Task 1: Build the target URI

The restore needs the MongoDB API URL of the **target schema**. It signs in as `MERN26`, names the database `mern26`, and carries the options the API requires: `loadBalanced=true`, `authMechanism=PLAIN` and TLS. The `$external` in `authSource` is written as `%24external` so that no shell expands it.

1. Build `TARGET_URI` from `MONGO_API_HOST` (Lab 2) and `MERN26_PASSWORD` (Lab 5). Nothing needs replacing.

    <if type="linux">

    ```bash
    <copy>
    export TARGET_URI="mongodb://MERN26:${MERN26_PASSWORD}@${MONGO_API_HOST}:27017/mern26?loadBalanced=true&retryWrites=false&authMechanism=PLAIN&authSource=%24external&tls=true"
    </copy>
    ```

    </if>

    <if type="windows">

    ```powershell
    <copy>
    $env:TARGET_URI = "mongodb://MERN26:$($env:MERN26_PASSWORD)@$($env:MONGO_API_HOST):27017/mern26?loadBalanced=true&retryWrites=false&authMechanism=PLAIN&authSource=%24external&tls=true"
    </copy>
    ```

    </if>

    > **Note:** A password that uses only letters, digits and underscores (as recommended in Lab 5) needs no URL-encoding. If yours contains other characters, encode them (for example `#` becomes `%23`).

2. Test the connection by listing the collections of `mern26`.

    <if type="linux">

    ```bash
    <copy>
    mongosh "$TARGET_URI" --quiet --eval "db.getCollectionNames()"
    </copy>
    ```

    </if>

    <if type="windows">

    ```powershell
    <copy>
    mongosh $env:TARGET_URI --quiet --eval "db.getCollectionNames()"
    </copy>
    ```

    </if>

    You should see an empty list, `[]`, because nothing is restored yet. If you get an authentication or connection error, check that:

    * Your IP address is in the database access control list (Lab 2)
    * The `MERN26` password is the one you used in Lab 5
    * Mutual TLS is not required on the database

## Task 2: Dump and restore

One script copies the data: it dumps the source with `mongodump`, then restores the dump into the target with `mongorestore`. It reads three settings, and only `TARGET_URI` is required.

| Setting | Default | Meaning |
| --- | --- | --- |
| `SOURCE_URI` | `mongodb://127.0.0.1:27017/mern_ecommerce` | The source MongoDB, including the database name |
| `TARGET_URI` | none | The Oracle MongoDB API URI naming `mern26` |
| `DUMP_DIR` | `./dump` | Where `mongodump` writes the dump |

1. Run the migration.

    <if type="linux">

    ```bash
    <copy>
    bash scripts/workshop/migrate-data.sh
    </copy>
    ```

    </if>

    <if type="windows">

    ```powershell
    <copy>
    .\scripts\workshop\migrate-data.ps1
    </copy>
    ```

    </if>

    The script runs `mongodump` against the source and then `mongorestore --drop --writeConcern '{w:1}'` against `TARGET_URI`, reading from `<DUMP_DIR>/<source database>` (here `dump/mern_ecommerce`). It never prints the password, and it exits with a non-zero code if zero documents were restored.

2. Read the end of the output. `mongorestore` reports the totals, and the script finishes with an `OK` line.

    ```text
    N document(s) restored successfully. 0 document(s) failed to restore.
    OK: N document(s) restored into mern26.
    ```

    You should see `N` equal to the `TOTAL` you noted in Lab 4, and `0` documents failed.

## Task 3: Understand the dump directory pitfall

Why does the script derive the dump directory instead of using the dump root? Because the correct directory **depends on the URI**, and the wrong one fails silently.

1. Compare the two layouts:

    | Target URI | Directory argument for `mongorestore` |
    | --- | --- |
    | **Names a database** (this one ends in `/mern26`) | The **database directory**, `dump/mern_ecommerce`. The target database name comes from the URI |
    | **Has no database name** | The dump **root**, `dump` |

2. Note what happens with the wrong directory. With the dump root and this URI, `mongorestore` prints `don't know what to do with subdirectory "...mern_ecommerce", skipping...`, restores **0 documents** and still exits with code `0`. Adding `--nsFrom` and `--nsTo` on top of a URI that names a database changes nothing.

    That is why the workshop script derives the directory from the source database name and fails when nothing was restored. If you run the two tools by hand later, follow this rule and make sure the dump is fresh.

3. Note that the restore uses `--drop`, which replaces the collection tables in `MERN26`. After a repeated restore, rebuild everything built on top of them (grants, views). You rebuild the grants in the next task.

## Task 4: Grant the collections to MERN26DV

The restore just created the collections, and `MERN26DV` needs access to them to host duality views in Lab 8. The script `03_grants_after_restore.sql` grants `select`, `insert`, `update` and `delete` on every `MERN26` collection table to `MERN26DV`.

1. Run the grants script as `ADMIN`.

    <if type="linux">

    ```bash
    <copy>
    bash scripts/workshop/run-sql.sh ADMIN sql/26ai/03_grants_after_restore.sql
    </copy>
    ```

    </if>

    <if type="windows">

    ```powershell
    <copy>
    .\scripts\workshop\run-sql.ps1 -User ADMIN -File sql/26ai/03_grants_after_restore.sql
    </copy>
    ```

    </if>

2. Check the output. You should see `12 collections granted to MERN26DV` for the seeded storefront (the script counts every JSON collection table in the `MERN26` schema), followed by the list of grants: 4 privileges per collection, 48 rows.

    > **Note:** Do not skip this step. Without it, `MERN26DV` answers `ORA-00942: table or view "MERN26"."users" does not exist` when it tries to read the collections later.

## Task 5: Verify the data in Oracle

Check that the collections arrived, using the same MongoDB API the application uses.

1. Count the documents of every collection through the MongoDB API.

    <if type="linux">

    ```bash
    <copy>
    mongosh "$TARGET_URI" --quiet --eval "db.getCollectionNames().forEach(c => print(c, db.getCollection(c).countDocuments({})))"
    </copy>
    ```

    </if>

    <if type="windows">

    ```powershell
    <copy>
    mongosh $env:TARGET_URI --quiet --eval "db.getCollectionNames().forEach(c => print(c, db.getCollection(c).countDocuments({})))"
    </copy>
    ```

    </if>

    You should see the 12 collections (`addresses`, `brands`, `cartitems`, `carts`, `categories`, `contacts`, `merchants`, `orders`, `products`, `reviews`, `users`, `wishlists`), with counts that match the source collections table from Lab 4.

2. Optional: look at the same collections in the database. Open **Database actions > JSON** for the `MERN26` user, or sign in to Database Actions as `MERN26`. Each MongoDB collection is a JSON collection in the schema.

    ![The migrated MongoDB collections shown as JSON collections in Database Actions, with the products collection open](images/json-collections.png " ")

    > **Note:** The screenshot is from an earlier migration of the same application; your product documents differ.

The data is now in Autonomous AI Database. Lab 7 proves it is identical to the source. You may now **proceed to the next lab**.

## Learn More

* [Quick Start Guide for MongoDB Migrations](https://docs.oracle.com/en/database/oracle/mdbqs/index.html)
* [mongorestore documentation](https://www.mongodb.com/docs/database-tools/mongorestore/)
* [Oracle Database API for MongoDB](https://docs.oracle.com/en/database/oracle/mongodb-api/index.html)

## Acknowledgements

* **Author** - Ignacio Martinez, Oracle
* **Last Updated By/Date** - Ignacio Martinez, October 2026
