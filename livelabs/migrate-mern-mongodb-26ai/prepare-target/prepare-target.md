# Prepare the Target Schemas

## Introduction

In Oracle Database, a MongoDB *database* is an **ORDS-enabled schema**. Before you can restore MongoDB data into Autonomous AI Database, you need the schemas that will receive it and you must expose them through the MongoDB API. The repository script `sql/26ai/01_schemas.sql` does all of it in one idempotent run as `ADMIN`.

Estimated Time: 10 minutes

### Objectives

In this lab, you will:

* Choose passwords for the two target schemas, `MERN26` and `MERN26DV`
* Run `sql/26ai/01_schemas.sql` as `ADMIN` with the workshop SQL runner
* Verify that both schemas exist and understand what the script created

### Prerequisites

This lab assumes you have:

* Completed **Lab 2: Provision Autonomous AI Database 26ai**, so you have the `ADMIN` password and the `ORACLE_CONNECT_STRING` (the TLS connect string, no wallet) and the MongoDB API enabled on the database
* SQLcl 25.2+ installed (Lab 1)
* A terminal open at the **root of the cloned repository**

## Task 1: Set the connection and password variables

The runner script (`scripts/workshop/run-sql.sh` on Linux, `scripts/workshop/run-sql.ps1` on Windows) connects with SQLcl using `ORACLE_CONNECT_STRING`. It picks the password by user: `DB_PASSWORD` for `ADMIN`, `MERN26_PASSWORD` for `MERN26` and `MERN26DV_PASSWORD` for `MERN26DV`. It prompts, with the input hidden, if the matching variable is not set. `01_schemas.sql` takes the schema passwords from the SQL variables `mern26_password` and `mern26dv_password`; the runner fills them from the environment variables `MERN26_PASSWORD` and `MERN26DV_PASSWORD`. Nothing is stored in the script.

Choose two different passwords now, one for each schema. Each must be 12 to 30 characters long and include at least one upper-case letter, one lower-case letter and one digit (the Autonomous AI Database default password rules), and it must not contain a user name. Use only letters, digits and underscores so that the password needs no URL-encoding later in the MongoDB API connection string. You use the same two values again in Labs 6 to 10, so write them down.

1. Confirm `ORACLE_CONNECT_STRING` and `MONGO_API_HOST` are set in this terminal. If they are empty, set them again as in Lab 2.

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

2. Set the `ADMIN` password and the two schema passwords for this terminal session.

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

2. The script ends with a query on `dba_users`. Both rows must be present with `ACCOUNT_STATUS` `OPEN`.

    ```
    USERNAME    ACCOUNT_STATUS
    MERN26      OPEN
    MERN26DV    OPEN
    ```

    The script stops at the start if either password variable is undefined or empty. It is safe to run again: it checks `dba_users` before creating each user.

## Task 3: Understand what the script created

1. Review the objects that `01_schemas.sql` creates and configures.

    | Object | What it is for |
    | --- | --- |
    | `MERN26` | The schema that receives the MongoDB collections through `mongorestore`. A MongoDB database named `mern26` maps to this schema |
    | `MERN26DV` | The schema that later owns the JSON-relational duality views built on top of `MERN26` (Lab 8) |
    | Grants `DB_DEVELOPER_ROLE`, `DWROLE`, `UNLIMITED TABLESPACE`, `SODA_APP`, `CONNECT` | Issued to both users. `SODA_APP` and the unlimited quota let the MongoDB API create and store collections |
    | `ORDS.ENABLE_SCHEMA` for both schemas | Enables Oracle REST Data Services for the schema with `p_url_mapping_type => 'BASE_PATH'` and the patterns `mern26` and `mern26dv`. The MongoDB API is served by ORDS, so this call is what exposes each schema to MongoDB clients |

2. `ORDS.ENABLE_SCHEMA` is the SQL equivalent of the Database Actions toggle **Administration > Database Users > (user) > REST, GraphQL, MongoDB API, and Web access**. Either way, the schema is now addressable as a MongoDB database. The MongoDB API itself ships with the database; the ORDS call only exposes it to a schema.

    > **Why is `MERN26DV` not allowed to read `MERN26` yet?** The collections do not exist until the restore. Lab 6 runs `03_grants_after_restore.sql` right after the restore for that reason.

You may now **proceed to the next lab**.

## Learn More

* [Enabling and configuring the Oracle Database API for MongoDB (ORDS)](https://docs.oracle.com/en/database/oracle/oracle-rest-data-services/26.3/ordig/enabling-and-configuring-oracle-database-api-mongodb.html)
* [Oracle Database API for MongoDB](https://docs.oracle.com/en/database/oracle/mongodb-api/index.html)
* [Quick Start Guide for MongoDB Migrations](https://docs.oracle.com/en/database/oracle/mdbqs/index.html)

## Acknowledgements

* **Author** - Ignacio Martinez, Oracle
* **Last Updated By/Date** - Ignacio Martinez, October 2026
