# Query the Migrated Data with SQL and Duality Views

## Introduction

The migrated collections are JSON documents, and the application keeps reading them through the MongoDB API. The same data can also be read with SQL, without copying it. In this lab you add three layers on top of the `MERN26` collections: relational views for BI and reporting, JSON-relational duality views that expose the same data as documents and as rows, and JSON validity views that report documents that drift from an inferred JSON schema.

You run the scripts in `sql/26ai/` with the runner script `scripts/workshop/run-sql.sh` (Linux) or `scripts/workshop/run-sql.ps1` (Windows), which connects with SQLcl through the TLS connect string in `ORACLE_CONNECT_STRING` and uses the account you name for each step.

Estimated Time: 40 minutes

### Objectives

In this lab, you will:

* Create relational views over the JSON collections and query them with SQL
* Generate, review and run the duality-view DDL, then import the documents into the duality views
* Publish the duality-view list and create validity views
* Learn that duality views are a point-in-time copy and which scripts to re-run after a repeat restore

### Prerequisites

This lab assumes you have:

* Completed Labs 1 to 7, so the `MERN26` and `MERN26DV` schemas exist, the data is restored and the grants script `03_grants_after_restore.sql` has run
* Opened your terminal at the repository root, with `ORACLE_CONNECT_STRING` set as in Lab 2 (a terminal where you ran Lab 5, not the API terminal from Lab 7)
* `DB_PASSWORD` (the `ADMIN` password), `MERN26_PASSWORD` and `MERN26DV_PASSWORD` set, as in Lab 5

> **Note:** The runner script connects as the user you name. For `MERN26` and `MERN26DV` it uses `MERN26_PASSWORD` and `MERN26DV_PASSWORD`; for `ADMIN` it uses `DB_PASSWORD`. If the matching variable is not set, the script asks for the password without echoing it.

## Task 1: Create the relational views (MERN26)

Script `04_relational_views.sql` creates typed SQL views over the JSON documents. Views do not count against the Autonomous JSON Database non-JSON storage limit.

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

2. The script ends by listing the six objects it created. Confirm that all six appear.

## Task 2: Try SQL over the views

Open **Database actions**, then **SQL**, from your Autonomous AI Database page and sign in as `MERN26`. You can also run the queries in SQLcl.

1. Find the most expensive active products with their brand.

    ```sql
    <copy>
    select name, brand_name, price, quantity
      from product_catalog
     where is_active = 'true'
     order by price desc
     fetch first 10 rows only;
    </copy>
    ```

2. List products priced over 50 that are active, using the monitoring view.

    ```sql
    <copy>
    select name, price, brand_name
      from active_products_over_50
     order by price desc;
    </copy>
    ```

3. Show review statistics next to the product names.

    ```sql
    <copy>
    select c.name, s.review_count, s.average_rating
      from product_review_stats s
      join product_catalog c on c.product_id = s.product_ref
     order by s.review_count desc, s.average_rating desc;
    </copy>
    ```

4. Show orders with the customer and the totals the application reports.

    ```sql
    <copy>
    select order_id, customer, order_total, order_subtotal, order_tax, order_total_with_tax
      from order_summary
     order by created desc;
    </copy>
    ```

    Orders whose cart no longer exists (cancelled orders delete the cart) report `NULL` for the derived columns.

## Task 3: Generate and review the duality-view DDL (MERN26)

A duality view exposes one set of data as an updatable JSON document and as rows. Script `05_generate_duality_ddl.sql` calls the JSON-to-duality converter for each of the 12 collections and stores the generated DDL in the `dv_generated_ddl` table. It runs as `MERN26` because the converter must see the source collections.

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

2. Review the DDL. In Database actions as `MERN26`, read the DDL for one collection.

    ```sql
    <copy>
    select ddl from dv_generated_ddl where collection_name = 'brands';
    </copy>
    ```

    The output creates a root table `brands_dv_root` in the `MERN26DV` schema and the view `BRANDS_DV` over it, with `@insert @update @delete` so the view is updatable. The reviewed output is also saved in the repository, one file per collection, in `sql/26ai/generated/duality_ddl/`.

## Task 4: Create the duality views and import the documents (MERN26DV)

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

2. Import the migrated documents into the duality views. Script `06_import_duality_views.sql` creates an error log per view, calls `DBMS_JSON_DUALITY.IMPORT_ALL`, then compares source and view document counts.

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

    Every collection must report `MATCH`.

3. Publish the list of duality views to `MERN26`. The catalogue view of duality views only lists views you own, so script `10_duality_catalog.sql` writes a small manifest table and grants it to `MERN26`, which is what the application reads.

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

4. In Database actions as `MERN26DV`, read the same product as a document and as rows.

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

> **Note:** A duality view is a point-in-time copy. `IMPORT_ALL` fills the views when it runs, so documents written through the MongoDB API afterwards (for example a new order placed in the storefront) appear in the views only after you run `06_import_duality_views.sql` again. A `DIFF` in the comparison after new writes is drift, not a migration error.

## Task 5: Create the validity views (ADMIN, then MERN26)

Validity views infer a JSON schema for each collection from its duality view and validate every document against it, so you can see structural drift in the schemaless store without changing the documents.

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

    Right after a migration the second query returns no rows. Rows appear as the application evolves and writes documents that differ from the inferred schema.

## Task 6: Look at the results in the storefront

1. Make sure the API and the web client from Lab 7 are running (start them again as in Lab 7 if they stopped), sign in as the administrator and open `http://localhost:8080/support/admin-db`. The page shows the migration summary and panels for the views, duality views and validity report. The duality panel shows each view as in sync or with pending documents.

    ![The migration dashboard at /support/admin-db](images/migration-dashboard.png " ")

## Task 7: Rebuild after a repeat restore

`mongorestore --drop` replaces the 12 JSON collection tables. The grants, the views and the duality-view contents built on them come back stale or invalid.

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
* [Source repository migration guide](https://github.com/oracle-devrel/mongodb-migrate-oci/blob/main/docs/26ai/migration-guide.md)

## Acknowledgements

* **Author** - Ignacio Martinez, Oracle
* **Last Updated By/Date** - Ignacio Martinez, October 2026
