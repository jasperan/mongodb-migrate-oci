# Query the Migrated Data with SQL and Duality Views

## Introduction

Your storefront still reads its data through the MongoDB API. This lab shows what you gained by moving that data into Oracle AI Database 26ai: the same data can now also be queried with SQL, joined across collections, and exposed as relational rows, without exporting or copying it into a separate warehouse. BI tools, SQL-skilled DBAs and reporting jobs can use your data directly, while the application is untouched.

You add three layers on top of the `MERN26` collections:

* **Relational views** give BI and reporting tools typed columns and joins over the JSON documents.
* **JSON-relational duality views** present the same data as documents and as rows. A duality view stores data in relational tables, builds JSON documents from them on demand, and accepts updates through either form.
* **Validity views** check every document against a JSON schema that Oracle infers, and report documents that drift from it.

You run the scripts in `sql/26ai/` with the runner script `scripts/workshop/run-sql.sh` (Linux) or `scripts/workshop/run-sql.ps1` (Windows). It connects with SQLcl through the TLS connect string in `ORACLE_CONNECT_STRING` and signs in as the account you name for each step.

Estimated Time: 40 minutes

### Objectives

In this lab, you will:

* Query the JSON collections with plain SQL through relational views
* Generate, review and run the duality-view DDL, then load the migrated documents into the duality views
* Detect documents that drift from the inferred schema with validity views
* Learn which scripts to re-run after a repeat restore

### Prerequisites

This lab assumes you have:

* Completed Labs 1 to 7, so the `MERN26` and `MERN26DV` schemas exist, the data is restored and the grants script `03_grants_after_restore.sql` has run
* Your **SQL terminal** open at the repository root, with `ORACLE_CONNECT_STRING` set as in Lab 2 and `DB_PASSWORD` (the `ADMIN` password), `MERN26_PASSWORD` and `MERN26DV_PASSWORD` set as in Lab 5. This is the terminal you used in Labs 5 and 6, not the API terminal from Lab 7.

> **Note:** The runner script picks the password from the user you name: `MERN26_PASSWORD` for `MERN26`, `MERN26DV_PASSWORD` for `MERN26DV` and `DB_PASSWORD` for `ADMIN`. If the matching variable is not set, it asks for the password without echoing it.

## Task 1: Create the relational views (MERN26)

Create typed SQL views over the JSON documents, so that SQL tools see tables with columns instead of documents. Script `04_relational_views.sql` creates them. Views do not count against the Autonomous JSON Database non-JSON storage limit.

| Object | Kind | Purpose |
| --- | --- | --- |
| `PRODUCT_CATALOG` | relational view | products joined to brands and categories, typed columns |
| `ACTIVE_PRODUCTS_OVER_50` and `ACTIVE_NONTAXABLE_PRODUCTS` | relational views | inventory monitoring |
| `PRODUCT_REVIEW_STATS` | relational view | review count and average rating per product |
| `ORDER_SUMMARY` | relational view | orders joined to customers, with subtotal, tax and total summed from the cart lines |
| `PRODUCTS_ENRICHED` | JSON collection view | read-only documents with brand and rating, also readable through the MongoDB API |

1. Run the script as `MERN26`.

    <if type="linux">

    ```
    <copy>
    bash scripts/workshop/run-sql.sh MERN26 sql/26ai/04_relational_views.sql
    </copy>
    ```

    </if>
    <if type="windows">

    ```
    <copy>
    .\scripts\workshop\run-sql.ps1 -User MERN26 -File sql/26ai/04_relational_views.sql
    </copy>
    ```

    </if>

2. You should see the script list the six objects from the table above, followed by the JSON collections of the schema. Confirm that all six objects appear.

## Task 2: Try SQL over the views

Run four queries that a MongoDB application would need an aggregation pipeline, or several round trips, to answer. Open **Database actions**, then **SQL**, from your Autonomous AI Database page and sign in as `MERN26`. You can also run the queries in SQLcl.

1. Find the most expensive active products with their brand. This joins the `products` and `brands` collections, which in MongoDB takes a `$lookup`.

    ```sql
    <copy>
    select name, brand_name, price, quantity
      from product_catalog
     where is_active = 'true'
     order by price desc
     fetch first 10 rows only;
    </copy>
    ```

2. List active products priced over 50 with the monitoring view. A DBA can query this view as a plain table, without knowing the document layout.

    ```sql
    <copy>
    select name, price, brand_name
      from active_products_over_50
     order by price desc;
    </copy>
    ```

3. Show review statistics next to the product names. The view has already grouped the reviews, so this is a single join instead of a `$group` pipeline.

    ```sql
    <copy>
    select c.name, s.review_count, s.average_rating
      from product_review_stats s
      join product_catalog c on c.product_id = s.product_ref
     order by s.review_count desc, s.average_rating desc;
    </copy>
    ```

4. Show orders with the customer and the totals the application reports. The view sums the cart lines, the same amounts the storefront shows.

    ```sql
    <copy>
    select order_id, customer, order_total, order_subtotal, order_tax, order_total_with_tax
      from order_summary
     order by created desc;
    </copy>
    ```

    Orders whose cart no longer exists (cancelling an order deletes its cart) show `NULL` in the three derived columns, `order_subtotal`, `order_tax` and `order_total_with_tax`.

## Task 3: Generate and review the duality-view DDL (MERN26)

Ask Oracle to infer a duality view for each of the 12 collections. A duality view exposes one set of data as an updatable JSON document and as rows. Script `05_generate_duality_ddl.sql` calls the JSON-to-duality converter for each collection and stores the generated DDL in the `dv_generated_ddl` table. It runs as `MERN26` because the converter must see the source collections.

1. Generate the DDL.

    <if type="linux">

    ```
    <copy>
    bash scripts/workshop/run-sql.sh MERN26 sql/26ai/05_generate_duality_ddl.sql
    </copy>
    ```

    </if>
    <if type="windows">

    ```
    <copy>
    .\scripts\workshop\run-sql.ps1 -User MERN26 -File sql/26ai/05_generate_duality_ddl.sql
    </copy>
    ```

    </if>

    The last query lists each collection with its DDL size and an `OK` or `ERROR` status. All 12 must be `OK`.

2. Review the DDL for one collection. In Database actions as `MERN26`, read the DDL generated for `brands`.

    ```sql
    <copy>
    select ddl from dv_generated_ddl where collection_name = 'brands';
    </copy>
    ```

    You should see a `CREATE TABLE` for the root table `brands_dv_root` in the `MERN26DV` schema, and a `CREATE ... JSON RELATIONAL DUALITY VIEW` for `BRANDS_DV` over it. The `@insert @update @delete` annotations make the view updatable. The reviewed output is also saved in the repository, one file per collection, in `sql/26ai/generated/duality_ddl/`.

## Task 4: Create the duality views and import the documents (MERN26DV)

Create the 12 duality views in the `MERN26DV` schema, load the migrated documents into them, and compare the counts with the source.

1. Run the 12 reviewed DDL files as `MERN26DV`.

    <if type="linux">

    ```
    <copy>
    bash scripts/workshop/run-sql.sh MERN26DV sql/26ai/generated/duality_ddl/*.sql
    </copy>
    ```

    </if>
    <if type="windows">

    ```
    <copy>
    .\scripts\workshop\run-sql.ps1 -User MERN26DV -File (Get-ChildItem sql/26ai/generated/duality_ddl/*.sql | ForEach-Object FullName)
    </copy>
    ```

    </if>

2. Import the migrated documents into the duality views. Script `06_import_duality_views.sql` creates an error log per view, calls `DBMS_JSON_DUALITY.IMPORT_ALL`, then compares the document counts of each source collection and its view.

    <if type="linux">

    ```
    <copy>
    bash scripts/workshop/run-sql.sh MERN26DV sql/26ai/06_import_duality_views.sql
    </copy>
    ```

    </if>
    <if type="windows">

    ```
    <copy>
    .\scripts\workshop\run-sql.ps1 -User MERN26DV -File sql/26ai/06_import_duality_views.sql
    </copy>
    ```

    </if>

    Every one of the 12 collections must report `MATCH`.

3. Publish the list of duality views to `MERN26`, which is where the application reads it. The dictionary view that lists duality views shows only the ones you own, so script `10_duality_catalog.sql` copies that list into a small manifest table and grants it to `MERN26`.

    <if type="linux">

    ```
    <copy>
    bash scripts/workshop/run-sql.sh MERN26DV sql/26ai/10_duality_catalog.sql
    </copy>
    ```

    </if>
    <if type="windows">

    ```
    <copy>
    .\scripts\workshop\run-sql.ps1 -User MERN26DV -File sql/26ai/10_duality_catalog.sql
    </copy>
    ```

    </if>

    You should see the 12 duality views listed, each with `YES` for insert, update and delete.

4. See the duality in action: read the same product as a JSON document and as relational rows. In Database actions as `MERN26DV`, run both queries. The first returns the product as the JSON document an application would expect. The second returns the rows of the root table that store it.

    ```sql
    <copy>
    select json_serialize(data pretty) from products_dv fetch first 1 row only;
    </copy>
    ```

    ```sql
    <copy>
    select * from products_dv_root fetch first 5 rows only;
    </copy>
    ```

> **Note:** A duality view in this lab is a point-in-time copy. `IMPORT_ALL` fills the views when it runs, so documents written through the MongoDB API afterwards (for example a new order placed in the storefront) appear in the views only after you run `06_import_duality_views.sql` again. A `DIFF` in the comparison after new writes is drift, not a migration error.

## Task 5: Create the validity views (ADMIN, then MERN26)

Find out whether any document deviates from the structure of its collection, without changing the documents. A schemaless store accepts any shape, so over time documents can drift. Validity views infer a JSON schema for each collection from its duality view and validate every document against it.

1. As `ADMIN`, run `03b_grants_duality_to_data.sql`. It grants the duality views and tables of `MERN26DV` to `MERN26`, so `MERN26` can infer schemas from them.

    <if type="linux">

    ```
    <copy>
    bash scripts/workshop/run-sql.sh ADMIN sql/26ai/03b_grants_duality_to_data.sql
    </copy>
    ```

    </if>
    <if type="windows">

    ```
    <copy>
    .\scripts\workshop\run-sql.ps1 -User ADMIN -File sql/26ai/03b_grants_duality_to_data.sql
    </copy>
    ```

    </if>

    The script prints how many `MERN26DV` objects it granted to `MERN26`.

2. As `MERN26`, run `07_validity_views.sql`. It stores the inferred schemas in `JSON_SCHEMAS` and creates validity views for users, products, orders and carts.

    <if type="linux">

    ```
    <copy>
    bash scripts/workshop/run-sql.sh MERN26 sql/26ai/07_validity_views.sql
    </copy>
    ```

    </if>
    <if type="windows">

    ```
    <copy>
    .\scripts\workshop\run-sql.ps1 -User MERN26 -File sql/26ai/07_validity_views.sql
    </copy>
    ```

    </if>

3. In Database actions as `MERN26`, check the roll-up and look for documents that do not match their schema.

    ```sql
    <copy>
    select collection_name, documents, valid_documents from document_validity order by 1;
    </copy>
    ```

    ```sql
    <copy>
    select doc_id, report from products_validity where is_valid = 0;
    </copy>
    ```

    Right after a migration, `valid_documents` equals `documents` for every collection, and the second query returns no rows. Rows appear later, as the application evolves and writes documents that differ from the inferred schema.

## Task 6: Look at the results in the storefront

See the same layers in the application's migration dashboard.

1. Make sure the API and the web client from Lab 7 are running (start them again as in Lab 7 if they stopped), sign in as the administrator and open `http://localhost:8080/support/admin-db`. The page shows the migration summary and panels for the views, duality views and validity report. The duality panel shows each view as in sync or with pending documents.

    ![The migration dashboard at /support/admin-db](images/migration-dashboard.png " ")

## Task 7: Rebuild after a repeat restore

Know what to re-run if you restore the data again. `mongorestore --drop` replaces the 12 JSON collection tables, so the grants, the views and the duality-view contents built on them come back stale or invalid.

1. If you restore again, re-run these scripts in this order. Use the same commands as in the previous tasks.

    | Order | Account | Script |
    | --- | --- | --- |
    | 1 | `ADMIN` | `03_grants_after_restore.sql` |
    | 2 | `ADMIN` | `03b_grants_duality_to_data.sql` |
    | 3 | `MERN26` | `04_relational_views.sql` |
    | 4 | `MERN26DV` | `06_import_duality_views.sql` |
    | 5 | `MERN26DV` | `10_duality_catalog.sql` |
    | 6 | `MERN26` | `07_validity_views.sql` |

    `08_ai_vector_store.sql` (Lab 9) does not need to be re-run because the `PRODUCT_EMBEDDINGS` table is not a MongoDB collection and the restore leaves it alone.

You may now **proceed to the next lab**.

## Learn More

* [Oracle Database API for MongoDB](https://docs.oracle.com/en/database/oracle/mongodb-api/)
* [JSON-Relational Duality Developer's Guide](https://docs.oracle.com/en/database/oracle/oracle-database/26/jsnvu/)
* [Source repository migration guide](https://github.com/jasperan/mongodb-migrate-oci/blob/main/docs/26ai/migration-guide.md)

## Acknowledgements

* **Author** - Ignacio Martinez, Oracle
* **Last Updated By/Date** - Ignacio Martinez, October 2026
