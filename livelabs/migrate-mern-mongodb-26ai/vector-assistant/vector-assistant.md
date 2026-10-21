# Vector Search and the AI Assistant (Optional)

## Introduction

After migrating, your product data sits in a database that can also search by meaning. In this lab you add semantic search and an AI assistant to the storefront without moving the data to a separate vector database: the embeddings are created, stored and searched inside Oracle AI Database 26ai, next to the products they describe.

Two terms you will use:

* A **vector embedding** is a list of numbers (here 384) that represents the meaning of a piece of text. Texts with similar meaning have similar vectors, so "something warm to wear" can match a jacket that never contains those words.
* An **ONNX model** is a trained model in the portable ONNX format. Oracle can load one into the database and run it there to create embeddings, so no text leaves the database for that step.

You load an ONNX embedding model into the `MERN26` schema, store one vector per product, and rank products by similarity with `VECTOR_DISTANCE` in SQL. Then you connect a language model so the AI assistant at `/support/llm-chat` can answer questions about the catalogue. Embeddings and similarity search stay in the database. Only the assistant's chat requests go to a language model provider, as described in Task 6.

This lab is optional. If you skip it, the migrated application and Labs 8 and 10 are unaffected; you only miss semantic search and the AI assistant.

Estimated Time: 40 minutes

### Objectives

In this lab, you will:

* Grant `MERN26` the privileges to load an embedding model
* Load the all-MiniLM-L12-v2 ONNX model into the `MERN26` schema
* Create the vector store and embed the product catalogue
* Run a semantic search in SQL and through the API
* Configure an OCI Generative AI model and try the AI assistant

### Prerequisites

This lab assumes you have:

* Completed Labs 1 to 8
* Python 3.10 or later and Node.js from Lab 1
* The `server/.env` file from Lab 7, with `ORACLE_CONNECT_STRING`, `ORACLE_APP_USER`, `ORACLE_APP_PASSWORD` and `ORACLE_DV_USER` set, so the API can run SQL against the database
* An OCI Generative AI API key (`sk-...`) and the region of its endpoint, for Tasks 5 and 6. Tasks 1 to 4 need no key.

## Task 1: Grant the privileges (ADMIN)

Give `MERN26` the right to load and use an embedding model. In the **SQL terminal** from Lab 8 (not the API terminal), run `08a_vector_grants.sql` as `ADMIN`. It grants `MERN26` the `DBMS_VECTOR` package and the right to create a mining (ONNX) model.

1. Run the script.

    <if type="linux">

    ```bash
    <copy>
    bash scripts/workshop/run-sql.sh ADMIN sql/26ai/08a_vector_grants.sql
    </copy>
    ```

    </if>

    <if type="windows">

    ```powershell
    <copy>
    .\scripts\workshop\run-sql.ps1 -User ADMIN -File sql/26ai/08a_vector_grants.sql
    </copy>
    ```

    </if>

    The output shows `Grant succeeded.` twice.

## Task 2: Load the ONNX embedding model (MERN26)

Put the embedding model inside the database so Oracle can turn text into vectors itself. `mern-ecommerce/server/scripts/load_onnx_embedding.py` builds the all-MiniLM-L12-v2 model (384 dimensions) with the `onnx2oracle` package and uploads it into the `MERN26` schema with `DBMS_VECTOR.LOAD_ONNX_MODEL`. It connects through a `tcps://` address because the database is reached without a wallet. The model must be loaded into each schema that uses it.

1. Create a Python virtual environment for the loader and install `onnx2oracle`. The package pulls in `onnxruntime-extensions` and `transformers`, so this takes a few minutes.

    <if type="linux">

    ```
    <copy>
    python3 -m venv .tools/onnx2oracle-venv
    .tools/onnx2oracle-venv/bin/pip install onnx2oracle
    </copy>
    ```

    </if>
    <if type="windows">

    ```
    <copy>
    python -m venv .tools\onnx2oracle-venv
    .tools\onnx2oracle-venv\Scripts\pip install onnx2oracle
    </copy>
    ```

    </if>

2. Run the loader. It needs the `MERN26` password and a `tcps://<adb-host>:1522/<service_name>` address, which the commands below take from `MERN26_PASSWORD` and `ORACLE_CONNECT_STRING` (the `host=` and `service_name=` parts of the descriptor).

    <if type="linux">

    ```bash
    <copy>
    DB_HOST=$(echo "$ORACLE_CONNECT_STRING" | sed -nE 's/.*host=([^)]*)\).*/\1/p')
    DB_SERVICE=$(echo "$ORACLE_CONNECT_STRING" | sed -nE 's/.*service_name=([^)]*)\).*/\1/p')
    .tools/onnx2oracle-venv/bin/python mern-ecommerce/server/scripts/load_onnx_embedding.py MERN26 "$MERN26_PASSWORD" "tcps://$DB_HOST:1522/$DB_SERVICE"
    </copy>
    ```

    </if>
    <if type="windows">

    ```powershell
    <copy>
    $dbHost = [regex]::Match($env:ORACLE_CONNECT_STRING, 'host=([^)]*)\)').Groups[1].Value
    $dbService = [regex]::Match($env:ORACLE_CONNECT_STRING, 'service_name=([^)]*)\)').Groups[1].Value
    .tools\onnx2oracle-venv\Scripts\python mern-ecommerce\server\scripts\load_onnx_embedding.py MERN26 $env:MERN26_PASSWORD "tcps://${dbHost}:1522/${dbService}"
    </copy>
    ```

    </if>

3. You should see log lines that the model was uploaded into `ALL_MINILM_L12_V2` (or was already registered), followed by a `sanity:` line from a test embedding that reports `dims = 384`.

## Task 3: Create the vector store (MERN26)

Create the table that holds one vector per product. Script `08_ai_vector_store.sql` creates the `PRODUCT_EMBEDDINGS` table with a `VECTOR(384, FLOAT32)` column and a vector index, then runs a sample similarity query for "comfortable shoes for trails" using the in-database model.

1. Run the script as `MERN26`.

    <if type="linux">

    ```
    <copy>
    bash scripts/workshop/run-sql.sh MERN26 sql/26ai/08_ai_vector_store.sql
    </copy>
    ```

    </if>
    <if type="windows">

    ```
    <copy>
    .\scripts\workshop\run-sql.ps1 -User MERN26 -File sql/26ai/08_ai_vector_store.sql
    </copy>
    ```

    </if>

    The table is empty until Task 4, so the embeddings count is `0` and the sample query returns no rows.

## Task 4: Embed the product catalogue

Turn every product into a vector, then run your first semantic search. The embedding runs inside the database, so no API key is needed.

1. Open `mern-ecommerce/server/.env` in your editor and make sure these in-database embedding settings are present. `EMBEDDING_DIM` must be `384` to match the model.

    ```
    <copy>
    VECTOR_EMBEDDING_MODEL=ALL_MINILM_L12_V2
    EMBEDDING_DIM=384
    VECTOR_TABLE=PRODUCT_EMBEDDINGS
    </copy>
    ```

2. From `mern-ecommerce/server`, embed every product inside the database. The script reads the connection settings from `.env` and runs one `INSERT ... SELECT` that embeds each product's name, description, brand, category and price.

    <if type="linux">

    ```
    <copy>
    cd mern-ecommerce/server
    VECTOR_EMBEDDING_MODEL=ALL_MINILM_L12_V2 node scripts/embed_catalog.js
    cd ../..
    </copy>
    ```

    </if>
    <if type="windows">

    ```
    <copy>
    cd mern-ecommerce\server
    $env:VECTOR_EMBEDDING_MODEL = 'ALL_MINILM_L12_V2'
    node scripts/embed_catalog.js
    cd ..\..
    </copy>
    ```

    </if>

    The script ends with a line like `done in <n> ms (<n> rows)`, with one row per product.

3. Search by meaning. In Database actions as `MERN26`, run this query. It embeds the phrase with the same model, then orders products by `VECTOR_DISTANCE` (cosine). The `score` is `1` minus that distance, so a higher score means a closer match.

    ```sql
    <copy>
    select name,
           round(1 - vector_distance(embedding,
                     vector_embedding(ALL_MINILM_L12_V2 using 'something warm to wear' as data),
                     cosine), 4) as score
      from product_embeddings
     order by vector_distance(embedding,
                     vector_embedding(ALL_MINILM_L12_V2 using 'something warm to wear' as data),
                     cosine)
     fetch first 5 rows only;
    </copy>
    ```

    You should see five products ordered by descending score. They are ranked by meaning, not by matching keywords. Try another phrase to see how the ranking changes.

## Task 5: Configure the language model

Connect the assistant to a language model. The assistant retrieves products with the in-database vector search, then asks an OpenAI-compatible model to write the answer. The settings below use OCI Generative AI.

1. In `mern-ecommerce/server/.env`, set the following values. Replace `<region>` with your Generative AI region and `<your key>` with your API key. Do not commit the key.

    ```
    <copy>
    LLM_PROVIDER=oci
    OCI_GENAI_ENDPOINT=https://inference.generativeai.<region>.oci.oraclecloud.com
    OCI_GENAI_API_KEY=<your key>
    LLM_MODEL=xai.grok-4.3
    </copy>
    ```

    A bare region URL is converted to the OpenAI-compatible path automatically. To use another OpenAI-compatible provider instead, set `LLM_BASE_URL` and `LLM_API_KEY`; these override the OCI settings.

2. Stop the API if it is running (press **Ctrl+C** in its terminal) and start it again from `mern-ecommerce/server` so it reads the new settings.

    ```
    <copy>
    npm start
    </copy>
    ```

3. In another terminal, check the configuration report.

    <if type="linux">

    ```
    <copy>
    curl -s http://localhost:3000/api/ai/status
    </copy>
    ```

    </if>
    <if type="windows">

    ```
    <copy>
    Invoke-RestMethod http://localhost:3000/api/ai/status | ConvertTo-Json -Depth 5
    </copy>
    ```

    </if>

    In the `embeddings` section you should see `inDatabaseModel` set to `ALL_MINILM_L12_V2`, `dimension` `384` and `table` `PRODUCT_EMBEDDINGS`. In the `llm` section, `configured` is `true` once the key is set.

4. Test the vector search through the API. It needs no LLM key.

    <if type="linux">

    ```
    <copy>
    curl -s -X POST -H 'Content-Type: application/json' -d '{"text":"warm blanket for camping"}' http://localhost:3000/api/ai/similar
    </copy>
    ```

    </if>
    <if type="windows">

    ```
    <copy>
    Invoke-RestMethod -Method Post -ContentType 'application/json' -Body '{"text":"warm blanket for camping"}' http://localhost:3000/api/ai/similar | ConvertTo-Json -Depth 5
    </copy>
    ```

    </if>

    You should see JSON with `source` set to `in-database:ALL_MINILM_L12_V2` and a `results` list of the closest products with their scores.

## Task 6: Try the AI assistant

Ask the storefront a question in natural language and see Oracle retrieve the products the answer is based on.

1. Start the web client if it is not running, and open `http://localhost:8080/support/llm-chat`. Ask a question such as `What are the cheapest products under $25?` or pick one of the suggested questions.

    ![The AI assistant answering a question about cheap products](images/ai-assistant.png " ")

2. The answer lists the products it retrieved. The retrieval runs inside Oracle; the answer is written by the configured model.

> **What leaves your machine:** each `/api/chat` request sends the LLM provider your question, up to the last six turns of the conversation, the retrieved product snippets, store-wide catalogue facts and excerpts of recent approved reviews. The route needs no sign-in and is rate limited (`RATE_LIMIT_AI`, 30 requests per minute per IP by default). Embeddings and vector search stay in the database while `VECTOR_EMBEDDING_MODEL` is set. If no key is configured, `/api/chat` answers `503` with a hint until you set one.

You may now **proceed to the next lab**.

## Learn More

* [Oracle AI Vector Search](https://docs.oracle.com/en/database/oracle/oracle-database/26/vecse/)
* [onnx2oracle](https://github.com/jasperan/onnx2oracle)
* [Source repository migration guide, section 8](https://github.com/oracle-devrel/mongodb-migrate-oci/blob/main/docs/26ai/migration-guide.md)

## Acknowledgements

* **Author** - Ignacio Martinez, Oracle
* **Last Updated By/Date** - Ignacio Martinez, October 2026
