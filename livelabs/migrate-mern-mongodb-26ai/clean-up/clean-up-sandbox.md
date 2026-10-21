# Clean Up

## Introduction

This lab removes what the workshop created on your workstation and in the database. Your reservation, and the database in it, end automatically, so the database cleanup is optional. Do it if you want to leave the database as you found it, or to run the workshop again.

> **Warning:** The steps below permanently delete data and cannot be undone. They remove:
>
> * the local source MongoDB container, with the storefront data you seeded in Lab 3
> * the `dump` directory with your `mongodump` output
> * your local edit of `docs/26ai/migration-report.json`, which is reset to the version in the repository
> * the `MERN26` and `MERN26DV` schemas and everything in them: the migrated collections, the views, the duality views, the vector store, the ONNX model and the Select AI credential and profile

Estimated Time: 10 minutes

### Objectives

In this lab, you will:

* Stop the storefront and remove the source MongoDB
* Remove the local dump files
* Remove the schemas and other objects the SQL scripts created

### Prerequisites

This lab assumes you completed the earlier labs, with `ORACLE_CONNECT_STRING` and `DB_PASSWORD` (the `ADMIN` password) set in a terminal at the **root of the cloned repository**.

## Task 1: Stop the app and the source MongoDB

Stop everything that is running locally, then delete the source data. The API must stop first, because it holds pooled `MERN26` sessions and the schemas cannot be dropped while they exist.

1. Press **Ctrl+C** in the terminals running the API and the web client.

2. From the repository root, remove the source MongoDB container and the dump directory. The last command restores the reference migration report that Lab 7 overwrote.

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

## Task 2: Remove the database objects (optional)

Drop the schemas and the network access entry that the workshop created. `sql/26ai/99_cleanup.sql` runs as `ADMIN`. It removes the network ACL entry that Lab 10 created, then drops `MERN26DV` and `MERN26` with `CASCADE`, which deletes everything in them (listed at the start of this lab). It is safe to run again.

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

    The script prints that it dropped `MERN26DV` and `MERN26`, and ends with a query on `dba_users` that returns no rows. If `DROP USER` fails with `ORA-01940: cannot drop a user that is currently connected`, the API or another SQL session is still open: stop it and run the script again.

You do not need to delete the database. The reservation and its database are removed automatically when the reservation ends.

## Learn More

* [Autonomous AI Database documentation](https://docs.oracle.com/en/cloud/paas/autonomous-database/)

## Acknowledgements

* **Author** - Ignacio Martinez, Oracle
* **Last Updated By/Date** - Ignacio Martinez, October 2026
