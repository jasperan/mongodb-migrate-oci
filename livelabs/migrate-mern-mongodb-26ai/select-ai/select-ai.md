# Natural-Language Queries with Select AI (Optional)

## Introduction

Select AI lets the database turn a question written in plain language into SQL. Oracle sends the question and metadata about the objects you list in an AI profile to a language model, gets SQL back, and the application runs it. In this optional lab you create a Select AI profile named `MERN_LLM` over the migrated catalogue, test it in SQL, and then use it from the storefront's **Ask the database** panel.

The profile uses OCI Generative AI through its OpenAI-compatible endpoint, with the same kind of API key the AI assistant uses in Lab 9. Because the database itself calls the endpoint, a one-time network access rule is needed.

Estimated Time: 25 minutes

### Objectives

In this lab, you will:
* Pass your region and API key to the scripts through environment variables
* Allow the `MERN26` schema to reach the OCI Generative AI endpoint
* Create the Select AI credential and profile and test them in SQL
* Ask the database questions from the storefront

### Prerequisites

This lab assumes you have:
* Completed Labs 1 to 8. Lab 9 is not required for this lab, but its `server/.env` settings are reused if you did it.
* An OCI Generative AI API key (`sk-...`) and the region of its endpoint
* The SQL terminal from Lab 8: a terminal at the repository root with `ORACLE_CONNECT_STRING`, `DB_PASSWORD` (the `ADMIN` password) and `MERN26_PASSWORD` set

## Task 1: Set the region and the key

The scripts read two environment variables, so nothing is edited and the key never lands in a tracked file. `run-sql` writes the key to a temporary, git-ignored file for the run and deletes it afterwards.

1. In the **SQL terminal** (the one you used in Lab 8, not the API terminal), set the region of your OCI Generative AI endpoint and your API key. For the `us-phoenix-1` region you can skip `MERN_LLM_REGION`.

    <if type="linux">

    ```bash
    <copy>
    export MERN_LLM_REGION=<region>
    read -rs -p "OCI Generative AI API key: " MERN_LLM_KEY; echo; export MERN_LLM_KEY
    </copy>
    ```

    </if>

    <if type="windows">

    ```powershell
    <copy>
    $env:MERN_LLM_REGION = "<region>"
    $env:MERN_LLM_KEY = [System.Net.NetworkCredential]::new('', (Read-Host 'OCI Generative AI API key' -AsSecureString)).Password
    </copy>
    ```

    </if>

## Task 2: Allow access to the model endpoint (ADMIN)

Script `09b_select_ai_acl.sql` adds a network access control entry so `MERN26` can reach `inference.generativeai.<region>.oci.oraclecloud.com`, using `MERN_LLM_REGION`. It is run once per environment and can be re-run safely.

1. Run the ACL script as `ADMIN`.

    <if type="linux">

    ```bash
    <copy>
    bash scripts/workshop/run-sql.sh ADMIN sql/26ai/09b_select_ai_acl.sql
    </copy>
    ```

    </if>

    <if type="windows">

    ```powershell
    <copy>
    .\scripts\workshop\run-sql.ps1 -User ADMIN -File sql/26ai/09b_select_ai_acl.sql
    </copy>
    ```

    </if>

2. The script ends with a query on the host access entries. Confirm that the `inference.generativeai.<region>.oci.oraclecloud.com` host appears for the `MERN26` principal.

## Task 3: Create the credential and profile (MERN26)

Script `09_select_ai.sql` creates the credential `MERN_LLM_CRED` (your key as a bearer token) and the profile `MERN_LLM` with provider `openai`, model `xai.grok-4.3` and an object list that covers `PRODUCT_CATALOG`, `ORDER_SUMMARY`, `PRODUCT_REVIEW_STATS` and the `products`, `orders`, `reviews`, `users` and `categories` collections. It uses `MERN_LLM_REGION` for the `provider_endpoint` and refuses to run when no key is set. It drops and re-creates the credential and the profile, so you can re-run it after every migration or after you change `object_list`.

1. Run the script as `MERN26`.

    <if type="linux">

    ```
    <copy>
    bash scripts/workshop/run-sql.sh MERN26 sql/26ai/09_select_ai.sql
    </copy>
    ```

    </if>
    <if type="windows">

    ```
    <copy>
    .\scripts\workshop\run-sql.ps1 -User MERN26 -File sql/26ai/09_select_ai.sql
    </copy>
    ```

    </if>

2. The script lists the profile with status `ENABLED`, then runs three tests: the SQL generated for "Which five products are the most expensive?", the SQL generated for "How many products are in each category?", and the result of running that second question. Each test calls the model, so the script takes about a minute.

3. To try your own question in Database actions as `MERN26`, use `showsql` to see the SQL without running it.

    ```
    <copy>
    select dbms_cloud_ai.generate(
             prompt       => 'Which products have a price above 100?',
             profile_name => 'MERN_LLM',
             action       => 'showsql') as generated_sql
      from dual;
    </copy>
    ```

## Task 4: Ask the database from the storefront

1. Open `mern-ecommerce/server/.env` and set the profile name. The API reads it at startup.

    ```
    <copy>
    SELECT_AI_PROFILE=MERN_LLM
    </copy>
    ```

2. Stop the API (**Ctrl+C**) and start it again from `mern-ecommerce/server`.

    ```
    <copy>
    npm start
    </copy>
    ```

3. Start the web client if it is not running. Sign in to `http://localhost:8080` as the administrator, because the endpoint is restricted to admins, and open `http://localhost:8080/support/admin-db`.

4. Scroll to **Ask the database**, enter `How many products are in each category?` and submit it. The panel shows the generated SQL and the rows it returned. Only a single read-only `SELECT` is run; anything else is shown but not executed. Results are limited to 50 rows.

5. You can also call the endpoint directly: `POST /api/ai/ask` with `{"question": "..."}` and an administrator's sign-in token.

> **What leaves your machine:** Select AI sends schema metadata for the objects in the profile, together with your question, to the model provider to get SQL back.

## Task 5: Update the profile later

A Select AI profile is a stored object. Editing `09_select_ai.sql` does not change the live profile, and if the profile is older than the current `object_list` the model may answer from a schema without the object you expect. Re-run Task 3 to re-create it.

You have completed the migration path and the AI extensions. Continue to **Clean Up** to remove what you created.

## Learn More

* [Select AI for Autonomous AI Database](https://docs.oracle.com/en/cloud/paas/autonomous-database/serverless/adbsb/sql-generation-ai-autonomous.html)
* [Source repository demo runbook](https://github.com/oracle-devrel/mongodb-migrate-oci/blob/main/docs/26ai/demo-runbook.md)

## Acknowledgements

* **Author** - Ignacio Martinez, Oracle
* **Last Updated By/Date** - Ignacio Martinez, October 2026
