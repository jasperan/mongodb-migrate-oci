# Provision Autonomous AI Database 26ai

## Introduction

The migration target is an Autonomous AI Database 26ai (Transaction Processing workload). The Oracle Database API for MongoDB needs the database to accept TLS connections from your workstation's IP address, without requiring a client wallet. In this lab you get such a database, collect its two connection strings and store them in environment variables used by later labs.

Estimated Time: 20 minutes

### Objectives

In this lab, you will:

* Create an Autonomous AI Database 26ai
* Allow your public IP and set mutual TLS (mTLS) to not required
* Copy the TLS connect string and the MongoDB API URL
* Store the connect string and the MongoDB API host name as environment variables

### Prerequisites

This lab assumes you have:

* An Oracle Cloud tenancy with permission to create Autonomous Databases
* Completed Lab 1

## Task 1: Get the database

1. Sign in to the Oracle Cloud Console, open the navigation menu and select **Oracle AI Database**, then **Autonomous AI Database**. Choose your compartment and click **Create Autonomous AI Database**.

2. Enter the following settings.

    * Display name and database name: `MERN26ADB`
    * Workload type: **Transaction Processing**
    * Database version: **26ai**
    * Compute: **ECPU**, with the default count and auto scaling as you prefer
    * Administrator password: choose a strong password for `ADMIN` and remember it

3. Under **Network access** select **Secure access from allowed IPs and VCNs only**. Add your workstation's public IP address (find it by searching "what is my IP" in a browser) to the access control list.

4. Make sure **Require mutual TLS (mTLS) authentication** is **not required** (clear the option if it is selected). The MongoDB API needs the IP access list plus TLS only. Click **Create** and wait until the state is **Available**.

## Task 2: Copy the connection strings

1. On the database details page click **Database connection**, set **TLS authentication** to **TLS**, and copy the **High** (or Low) connection string of type TLS. This is the long connect string used without a wallet.

2. On the database details page open the **Tool configuration** tab and find **MongoDB API**. The Oracle Database API for MongoDB is **not enabled by default**: if its status is not enabled, enable it and wait for the database to return to **Available**. Then copy the **public access URL**.

    ![The Tool configuration tab](images/tool-configuration.png " ")

    ![The MongoDB API URL](images/mongodb-api.png " ")

    The URL has this shape: `mongodb://[user:password@]<adb-host>:27017/[user]?authMechanism=PLAIN&authSource=$external&ssl=true&retryWrites=false&loadBalanced=true`.

## Task 3: Set environment variables

1. Set `ORACLE_CONNECT_STRING` to the TLS connect string from Task 2, and `MONGO_API_HOST` to the host name from the MongoDB API URL (the part between `@` or `//` and `:27017`, for example `abc123-mydb.adb.us-phoenix-1.oraclecloudapps.com`). Do not include a user name, password or port. Replace the placeholders and run the block for your shell. Later labs build the MongoDB connection string from `MONGO_API_HOST`, so run them in the same terminal or set these two variables again.

    <if type="linux">

    ```bash
    <copy>
    export ORACLE_CONNECT_STRING='<TLS connect string from Task 2>'
    export MONGO_API_HOST='<adb-host from the MongoDB API URL>'
    </copy>
    ```

    </if>

    <if type="windows">

    ```powershell
    <copy>
    $env:ORACLE_CONNECT_STRING = '<TLS connect string from Task 2>'
    $env:MONGO_API_HOST = '<adb-host from the MongoDB API URL>'
    </copy>
    ```

    </if>

    The `MERN26` password does not exist yet: you choose it in Lab 5, and Lab 6 builds the full connection string.

You may now **proceed to the next lab**.

## Learn More

* [Autonomous AI Database documentation](https://docs.oracle.com/en/cloud/paas/autonomous-database/)
* [Oracle Database API for MongoDB](https://docs.oracle.com/en/database/oracle/mongodb-api/)

## Acknowledgements

* **Author** - Ignacio Martinez, Oracle
* **Last Updated By/Date** - Ignacio Martinez, October 2026
