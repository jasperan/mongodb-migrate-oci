# Prepare the Target Schemas

## Introduction

This lab is the **prepare** stage of the migration. Autonomous AI Database needs a place to receive the MongoDB data before you restore it. In Oracle Database, a MongoDB *database* is a schema that is enabled for **Oracle REST Data Services (ORDS)**, the service that exposes the Oracle Database API for MongoDB. You create two schemas now:

* `MERN26` receives the MongoDB collections.
* `MERN26DV` owns the JSON Relational Duality Views you build in Lab 8.

One repository script, `sql/26ai/01_schemas.sql`, creates both schemas and enables them for ORDS. You run it as `ADMIN`, and you can safely run it again.

Estimated Time: 10 minutes

### Objectives

In this lab, you will:

* Choose passwords for the two target schemas, `MERN26` and `MERN26DV`
* Run `sql/26ai/01_schemas.sql` as `ADMIN` with the workshop SQL runner
* Verify that both schemas exist and understand what the script created

### Prerequisites

This lab assumes you have:

* Completed **Lab 2: Provision Autonomous AI Database 26ai**, so you have the `ADMIN` password, the `ORACLE_CONNECT_STRING` (the TLS connect string, no wallet) and the MongoDB API enabled on the database
* SQLcl 25.2+ installed (Lab 1)
* A terminal open at the **root of the cloned repository**

## Task 1: Set the connection and password variables

The SQL runner reads its connection details and passwords from environment variables, so nothing secret is stored in a script. In this task you check the connection variables and set three passwords.

The runner (`scripts/workshop/run-sql.sh` on Linux, `scripts/workshop/run-sql.ps1` on Windows) connects with SQLcl using `ORACLE_CONNECT_STRING`. It picks the password by user:

| User | Environment variable |
| --- | --- |
| `ADMIN` | `DB_PASSWORD` |
| `MERN26` | `MERN26_PASSWORD` |
| `MERN26DV` | `MERN26DV_PASSWORD` |

If the matching variable is not set, the runner prompts with the input hidden. `01_schemas.sql` takes the schema passwords from the SQL variables `mern26_password` and `mern26dv_password`, which the runner fills from `MERN26_PASSWORD` and `MERN26DV_PASSWORD`.

1. Choose two different passwords, one for each schema, and write them down. You use the same two values again in Labs 6 to 10. Each password must:

    * Be 12 to 30 characters long, with at least one upper-case letter, one lower-case letter and one digit (the Autonomous AI Database default rules)
    * Not contain a user name
    * Use only letters, digits and underscores, so it needs no URL-encoding in the MongoDB API connection string later

2. Check that `ORACLE_CONNECT_STRING` and `MONGO_API_HOST` are set in this terminal. If either is empty, set it again as in Lab 2.

    <if type="linux">

    ```bash
    <copy>
    echo "$ORACLE_CONNECT_STRING"
    echo "$MONGO_API_HOST"
    </copy>
    ```

    </if>

    <if type="windows">

    ```powershell
    <copy>
    $env:ORACLE_CONNECT_STRING
    $env:MONGO_API_HOST
    </copy>
    ```

    </if>

3. Set the `ADMIN` password and the two schema passwords for this terminal session.

    <if type="linux">

    ```bash
    <copy>
    printf 'ADMIN password: '; read -rs DB_PASSWORD; echo; export DB_PASSWORD
    printf 'MERN26 password: '; read -rs MERN26_PASSWORD; echo; export MERN26_PASSWORD
    printf 'MERN26DV password: '; read -rs MERN26DV_PASSWORD; echo; export MERN26DV_PASSWORD
    </copy>
    ```

    </if>

    <if type="windows">

    ```powershell
    <copy>
    $env:DB_PASSWORD = "<ADMIN password>"
    $env:MERN26_PASSWORD = "<MERN26 password>"
    $env:MERN26DV_PASSWORD = "<MERN26DV password>"
    </copy>
    ```

    </if>

    > **Note:** New terminals do not inherit these variables. If you open another terminal in a later lab, set them again. Keep this terminal as your **SQL terminal** for Labs 6 to 10, separate from the API terminal that runs `npm start`.

## Task 2: Run the schema script as ADMIN

Running the script creates the two schemas, grants them the privileges they need and exposes them to MongoDB clients.

1. Run `01_schemas.sql` as `ADMIN`.

    <if type="linux">

    ```bash
    <copy>
    bash scripts/workshop/run-sql.sh ADMIN sql/26ai/01_schemas.sql
    </copy>
    ```

    </if>

    <if type="windows">

    ```powershell
    <copy>
    .\scripts\workshop\run-sql.ps1 -User ADMIN -File sql/26ai/01_schemas.sql
    </copy>
    ```

    </if>

2. Check the last query in the output, which reads `dba_users`. You should see both rows with `ACCOUNT_STATUS` `OPEN`.

    ```text
    USERNAME    ACCOUNT_STATUS
    MERN26      OPEN
    MERN26DV    OPEN
    ```

    > **Note:** The script stops at the start if either password variable is undefined or empty. It checks `dba_users` before creating each user, so running it again is safe.

## Task 3: Understand what the script created

Review what `01_schemas.sql` set up, so you know what each object is for in the next labs.

| Object | What it is for |
| --- | --- |
| `MERN26` | The schema that receives the MongoDB collections through `mongorestore`. A MongoDB database named `mern26` maps to this schema |
| `MERN26DV` | The schema that later owns the JSON Relational Duality Views built on top of `MERN26` (Lab 8) |
| Grants `DB_DEVELOPER_ROLE`, `DWROLE`, `UNLIMITED TABLESPACE`, `SODA_APP`, `CONNECT` | Issued to both users. `SODA_APP` and the unlimited quota let the MongoDB API create and store collections |
| `ORDS.ENABLE_SCHEMA` for both schemas | Enables ORDS for the schema with `p_url_mapping_type => 'BASE_PATH'` and the patterns `mern26` and `mern26dv`. The MongoDB API is served by ORDS, so this call exposes each schema to MongoDB clients |

1. Note that `ORDS.ENABLE_SCHEMA` is the SQL equivalent of the Database Actions toggle **Administration > Database Users > (user) > REST, GraphQL, MongoDB API, and Web access**. Either way, the schema is now addressable as a MongoDB database. The MongoDB API itself ships with the database; the ORDS call only exposes it to a schema.

2. Note that `MERN26DV` cannot read `MERN26` yet. The collections do not exist until the restore, so Lab 6 runs `03_grants_after_restore.sql` right after it.

You may now **proceed to the next lab**.

## Learn More

* [Enabling and configuring the Oracle Database API for MongoDB (ORDS)](https://docs.oracle.com/en/database/oracle/oracle-rest-data-services/26.3/ordig/enabling-and-configuring-oracle-database-api-mongodb.html)
* [Oracle Database API for MongoDB](https://docs.oracle.com/en/database/oracle/mongodb-api/index.html)
* [Quick Start Guide for MongoDB Migrations](https://docs.oracle.com/en/database/oracle/mdbqs/index.html)

## Acknowledgements

* **Author** - Ignacio Martinez, Oracle
* **Last Updated By/Date** - Ignacio Martinez, October 2026
