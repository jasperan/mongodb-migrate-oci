# Natural-Language Queries with Select AI (Optional)

## Introduction

Once your data is in Oracle AI Database 26ai, people who do not write SQL or MongoDB queries can still ask it questions. Select AI lets the database turn a question in plain language into SQL. In this lab you set it up over the migrated catalogue and use it from the storefront's **Ask the database** panel.

A **Select AI profile** is a stored database object that names the language model provider, the credential to reach it and the list of tables and views the model is allowed to see. When you ask a question, Oracle sends the question and metadata about those objects (names, columns and comments) to the model, gets SQL back, and the application runs it.

The profile you create is named `MERN_LLM`. It uses OCI Generative AI through its OpenAI-compatible endpoint, with the same kind of API key the AI assistant uses in Lab 9. Because the database itself calls that endpoint, a one-time network access rule is needed.

This lab is optional. If you skip it, nothing else depends on it; you only miss the natural-language panel. Lab 9 is not required for this lab.

Estimated Time: 25 minutes

### Objectives

In this lab, you will:

* Pass your region and API key to the scripts through environment variables
* Allow the `MERN26` schema to reach the OCI Generative AI endpoint
* Create the Select AI credential and profile and test them in SQL
* Ask the database questions from the storefront

### Prerequisites

This lab assumes you have:

* Completed Labs 1 to 8. If you did Lab 9, its `server/.env` settings are reused.
* An OCI Generative AI API key (`sk-...`) and the region of its endpoint
* Your **SQL terminal** from Lab 8: a terminal at the repository root with `ORACLE_CONNECT_STRING`, `DB_PASSWORD` (the `ADMIN` password) and `MERN26_PASSWORD` set

## Task 1: Set the region and the key

Give the scripts your region and API key without writing the key into a tracked file. The scripts read two environment variables. The runner script (`run-sql.sh` or `run-sql.ps1`) writes the key to a temporary, git-ignored file for the run and deletes it afterwards.

1. In the **SQL terminal** (the one you used in Lab 8, not the API terminal), set the region of your OCI Generative AI endpoint and your API key. For the `us-phoenix-1` region you can skip `MERN_LLM_REGION`.

    <if type="linux">

    ```bash
    <copy>
    export MERN_LLM_REGION=<region>
    printf 'OCI Generative AI API key: '; read -rs MERN_LLM_KEY; echo; export MERN_LLM_KEY
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

Let the `MERN26` schema call the model endpoint, because the database blocks outbound network calls by default. Script `09b_select_ai_acl.sql` adds a network access control entry for `inference.generativeai.<region>.oci.oraclecloud.com`, using `MERN_LLM_REGION`. It is run once per environment and can be re-run safely.

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

Create the credential that holds your key and the `MERN_LLM` profile, then test them with real questions. Script `09_select_ai.sql` creates:

* the credential `MERN_LLM_CRED`, which stores your key as a bearer token
* the profile `MERN_LLM`, with provider `openai`, model `xai.grok-4.3` and `MERN_LLM_REGION` as the region of its `provider_endpoint`
* the profile's object list: `PRODUCT_CATALOG`, `ORDER_SUMMARY`, `PRODUCT_REVIEW_STATS` and the `products`, `orders`, `reviews`, `users` and `categories` collections

The script refuses to run when no key is set, and it drops and re-creates the credential and the profile each time.

> **Note:** A Select AI profile is a stored object, so editing the script does not change it. Re-run the script after every migration or after you change `object_list`, or the model may answer from a schema without the object you expect.

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

2. You should see the profile listed with status `ENABLED`, then three tests: the SQL generated for "Which five products are the most expensive?", the SQL generated for "How many products are in each category?", and the result of running that second question. Each test calls the model, so the script takes about a minute.

3. Try your own question. In Database actions as `MERN26`, use `showsql` to see the SQL the model generates without running it.

    ```sql
    <copy>
    select dbms_cloud_ai.generate(
             prompt       => 'Which products have a price above 100?',
             profile_name => 'MERN_LLM',
             action       => 'showsql') as generated_sql
      from dual;
    </copy>
    ```

    You should see one `SELECT` statement over the catalogue objects. Because a language model writes it, the exact SQL can differ from one run to the next.

## Task 4: Ask the database from the storefront

Use the profile from the application, as a business user would. The storefront's **Ask the database** panel sends the question to the profile, shows the SQL it returned and runs it.

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

5. Optional: call the endpoint directly with `POST /api/ai/ask`, a body of `{"question": "..."}` and an administrator's sign-in token.

> **What leaves your machine:** Select AI sends schema metadata for the objects in the profile, together with your question, to the model provider to get SQL back.

You have completed the migration path and the AI extensions. The next lab, Clean Up, removes what you created.

You may now **proceed to the next lab**.

## Learn More

* [Use Select AI for Natural Language Interaction with your Database](https://docs.oracle.com/en/cloud/paas/autonomous-database/serverless/adbsb/select-ai.html)
* [Source repository demo runbook](https://github.com/jasperan/mongodb-migrate-oci/blob/main/docs/26ai/demo-runbook.md)

## Acknowledgements

* **Author** - Ignacio Martinez, Oracle
* **Last Updated By/Date** - Ignacio Martinez, October 2026
