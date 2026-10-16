# Clean Up

## Introduction

This lab removes what the workshop created. Because the database lives in your tenancy, terminate it to stop charges.

Estimated Time: 10 minutes

### Objectives

In this lab, you will:
* Stop the storefront and the source MongoDB
* Remove local dump files
* Undo the SQL changes and terminate the database

### Prerequisites

This lab assumes you completed the earlier labs, with `ORACLE_CONNECT_STRING` and `DB_PASSWORD` (the `ADMIN` password) set in a terminal at the **root of the cloned repository**.

## Task 1: Stop the app and the source MongoDB

1. Press **Ctrl+C** in the terminals running the API and the web client. The API must stop first, because it holds pooled `MERN26` sessions and the schemas cannot be dropped while they exist.

2. Remove the source MongoDB container and the dump directory, from the repository root. Also restore the reference migration report that Lab 7 overwrote.

    <if type="linux">

    ```bash
    <copy>
    bash scripts/workshop/start-source-mongo.sh stop
    rm -rf dump
    git checkout -- docs/26ai/migration-report.json
    </copy>
    ```

    </if>

    <if type="windows">

    ```powershell
    <copy>
    .\scripts\workshop\start-source-mongo.ps1 -Stop
    Remove-Item -Recurse -Force .\dump
    git checkout -- docs/26ai/migration-report.json
    </copy>
    ```

    </if>

## Task 2: Undo the SQL changes

`sql/26ai/99_cleanup.sql` runs as `ADMIN`. It removes the network ACL entry that Lab 10 created, then drops `MERN26DV` and `MERN26` with `CASCADE`. That deletes the collections, the views, the duality views, the vector store, the ONNX model and the Select AI credential and profile. It is safe to run again.

1. If you gave Lab 10 a region other than `us-phoenix-1`, set the same region first. Skip this command otherwise.

    <if type="linux">

    ```bash
    <copy>
    export MERN_LLM_REGION=<region you used in Lab 10>
    </copy>
    ```

    </if>

    <if type="windows">

    ```powershell
    <copy>
    $env:MERN_LLM_REGION = "<region you used in Lab 10>"
    </copy>
    ```

    </if>

2. Run the cleanup script.

    <if type="linux">

    ```bash
    <copy>
    bash scripts/workshop/run-sql.sh ADMIN sql/26ai/99_cleanup.sql
    </copy>
    ```

    </if>

    <if type="windows">

    ```powershell
    <copy>
    .\scripts\workshop\run-sql.ps1 -User ADMIN -File sql/26ai/99_cleanup.sql
    </copy>
    ```

    </if>

    The script ends with a query on `dba_users` that returns no rows. If `DROP USER` fails with `ORA-01940: cannot drop a user that is currently connected`, the API or another SQL session is still open: stop it and run the script again.

## Task 3: Terminate the database

1. In the Oracle Cloud Console open your Autonomous AI Database, click **More actions**, then **Terminate**, and confirm by entering the database name.


## Learn More

* [Terminating an Autonomous Database](https://docs.oracle.com/en/cloud/paas/autonomous-database/)

## Acknowledgements

* **Author** - Ignacio Martinez, Oracle
* **Last Updated By/Date** - Ignacio Martinez, October 2026
