# Query the Migrated Data with SQL

## Introduction

The migration is done. The storefront runs unchanged against Oracle AI Database 26ai through the MongoDB API, and nothing in this lab changes that. The same documents can also be read with plain SQL, which is what reporting and BI tools, and DBAs who do not write MongoDB queries, expect. This lab adds simple relational views over the `MERN26` collections, written in dot notation, so those users see tables with typed columns instead of JSON documents. No data is copied or exported.

You run the scripts in `sql/26ai/` with the runner script `scripts/workshop/run-sql.sh` (Linux) or `scripts/workshop/run-sql.ps1` (Windows). It connects with SQLcl through the TLS connect string in `ORACLE_CONNECT_STRING` and signs in as the account you name for each step.

Estimated Time: 20 minutes for Tasks 1 to 5. The optional Task 6 takes about 20 more minutes.

### Objectives

In this lab, you will:

* Create simple relational views over the JSON collections with dot notation
* Query and join the migrated collections with SQL
* Learn which scripts to re-run after a repeat restore
* Optional: add duality views and validity views

### Prerequisites

This lab assumes you have:

* Completed Labs 1 to 7, so the `MERN26` schema exists and the data is restored
* Your **SQL terminal** open at the repository root, with `ORACLE_CONNECT_STRING` set as in Lab 2 and `MERN26_PASSWORD` set as in Lab 5. This is the terminal you used in Labs 5 and 6, not the API terminal from Lab 7.
* Only for the optional Task 6: `DB_PASSWORD` (the `ADMIN` password) and `MERN26DV_PASSWORD` set as in Lab 5, and the grants script `03_grants_after_restore.sql` run in Lab 6

> **Note:** The runner script picks the password from the user you name: `MERN26_PASSWORD` for `MERN26`, `MERN26DV_PASSWORD` for `MERN26DV` and `DB_PASSWORD` for `ADMIN`. If the matching variable is not set, it asks for the password without echoing it.

## Task 1: Understand how dot notation reads a document

Each MongoDB collection is stored in a table with one column, `data`, that holds the whole document. Oracle's simple dot notation reads a field of that document as if it were a column: `alias.data.field.method()`.

* The table alias is required. `data.name` does not work; `p.data.name` does, where `p` is the alias of the table in the `from` clause.
* The field name follows the dots. A name that is not a plain identifier, such as `_id`, or that is a reserved word, such as `user`, goes in double quotes: `p.data."_id"`, `o.data."user"`.
* The item method at the end gives the value a SQL type: `.string()` returns text, `.number()` returns a number.
* `p.data` on its own returns the original document, which the views keep in a `rawjson` column so that no field is lost.

This is the view that exposes the `products` collection. The other five simple views follow the same pattern.

```sql
create or replace view products_v as
select p.data."_id".string()        as product_id,
       p.data.sku.string()          as sku,
       p.data.name.string()         as name,
       p.data.slug.string()         as slug,
       p.data.description.string()  as description,
       p.data.price.number()        as price,
       p.data.quantity.number()     as quantity,
       p.data.taxable.string()      as taxable,
       p.data.isActive.string()     as is_active,
       p.data.brand.string()        as brand_id,
       p.data.created.string()      as created,
       p.data                       as rawjson
  from products p;
```

Two conventions apply to every view. Ids are the same 24-character hexadecimal strings the application sees, and booleans come back as the text `'true'` or `'false'`, so filters read `where is_active = 'true'`.

## Task 2: Create the views (MERN26)

Script `04_relational_views.sql` creates the simple views and the reporting views built on them. Views do not count against the Autonomous JSON Database non-JSON storage limit.

| Object | Kind | Purpose |
| --- | --- | --- |
| `BRANDS_V`, `CATEGORIES_V`, `PRODUCTS_V`, `ORDERS_V`, `REVIEWS_V` | relational views | one view per collection, one typed column per top-level field, plus `rawjson` with the original document |
| `USERS_V` | relational view | the same for `users`, without `rawjson`, because the user document holds the password hash |
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

2. You should see the script list the 12 objects from the table above, followed by the JSON collections of the schema. Confirm that all 12 objects appear.

## Task 3: Query the migrated data with SQL

Run queries that a MongoDB application would need an aggregation pipeline, or several round trips, to answer. Open **Database actions**, then **SQL**, from your Autonomous AI Database page and sign in as `MERN26`. You can also run the queries in SQLcl.

1. Look at the products as rows. The `rawjson` column holds the original document.

    ```sql
    <copy>
    select * from products_v fetch first 5 rows only;
    </copy>
    ```

    You should see five products with `product_id`, `sku`, `name`, `price`, `quantity` and the other columns as separate values.

2. Join products to their brands. In MongoDB this takes a `$lookup`; here it is an ordinary join on the two views.

    ```sql
    <copy>
    select p.name, b.name as brand_name, p.price
      from products_v p
      join brands_v b on b.brand_id = p.brand_id
     where p.is_active = 'true'
     order by p.price desc
     fetch first 10 rows only;
    </copy>
    ```

3. Find the most expensive active products with their brand, using the catalog view that already does the join.

    ```sql
    <copy>
    select name, brand_name, price, quantity
      from product_catalog
     where is_active = 'true'
     order by price desc
     fetch first 10 rows only;
    </copy>
    ```

4. List active products priced over 50 with the monitoring view. A DBA can query this view as a plain table, without knowing the document layout.

    ```sql
    <copy>
    select name, price, brand_name
      from active_products_over_50
     order by price desc;
    </copy>
    ```

5. Show review statistics next to the product names. The view has already grouped the reviews, so this is a single join instead of a `$group` pipeline.

    ```sql
    <copy>
    select c.name, s.review_count, s.average_rating
      from product_review_stats s
      join product_catalog c on c.product_id = s.product_ref
     order by s.review_count desc, s.average_rating desc;
    </copy>
    ```

6. Show orders with the customer and the totals the application reports. The view sums the cart lines, the same amounts the storefront shows.

    ```sql
    <copy>
    select order_id, customer, order_total, order_subtotal, order_tax, order_total_with_tax
      from order_summary
     order by created desc;
    </copy>
    ```

    Orders whose cart no longer exists (cancelling an order deletes its cart) show `NULL` in the three derived columns, `order_subtotal`, `order_tax` and `order_total_with_tax`.

## Task 4: Look at the results in the storefront

The storefront keeps running against the same data. The application's migration dashboard shows the views you created.

1. Make sure the API and the web client from Lab 7 are running (start them again as in Lab 7 if they stopped), sign in as the administrator and open `http://localhost:8080/support/admin-db`. The page shows the migration summary and panels for the views, duality views and validity report.

    ![The migration dashboard at /support/admin-db](images/migration-dashboard.png " ")

    The duality and validity panels stay empty until you do the optional Task 6.

## Task 5: Rebuild after a repeat restore

Know what to re-run if you restore the data again. `mongorestore --drop` replaces the 12 JSON collection tables, so the grants and the views built on them come back stale or invalid.

1. If you restore again, re-run these scripts in this order. Use the same commands as in the previous tasks.

    | Order | Account | Script |
    | --- | --- | --- |
    | 1 | `ADMIN` | `03_grants_after_restore.sql` (only if you did the optional Task 6) |
    | 2 | `MERN26` | `04_relational_views.sql` |

    If you did the optional Task 6, re-run its scripts after step 2, in this order:

    | Order | Account | Script |
    | --- | --- | --- |
    | 1 | `ADMIN` | `03b_grants_duality_to_data.sql` |
    | 2 | `MERN26DV` | `06_import_duality_views.sql` |
    | 3 | `MERN26DV` | `10_duality_catalog.sql` |
    | 4 | `MERN26` | `07_validity_views.sql` |

    `08_ai_vector_store.sql` (Lab 9) does not need to be re-run because the `PRODUCT_EMBEDDINGS` table is not a MongoDB collection and the restore leaves it alone.

## Task 6 (Optional): Add duality views and validity views

> **Note:** Duality views and validity views are a nice to have. You do not need them to migrate the application or to run it, and the storefront does not use them. Skip this task to finish the migration path, and go on to the next lab.

A duality view stores data in relational tables, builds JSON documents from them on demand, and accepts updates through either form. A validity view checks every document against a JSON schema that Oracle infers, and reports documents that drift from it. This task uses the `MERN26DV` schema from Lab 5 and the grants from Lab 6.

1. Generate the duality-view DDL. Ask Oracle to infer a duality view for each of the 12 collections. Script `05_generate_duality_ddl.sql` calls the JSON-to-duality converter for each collection and stores the generated DDL in the `dv_generated_ddl` table. It runs as `MERN26` because the converter must see the source collections.

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

    This is the saved DDL for `brands` (`brands.sql`, without its comment header). Your generated DDL has the same shape. In the view, `isActive: is_active` maps a column to a document field that has another name:

    ```sql
    CREATE TABLE "MERN26DV".brands_dv_root(
       "_id"  raw(64)  DEFAULT ON NULL SYS_GUID(),
       name  varchar2(64)  /* UNIQUE */,
       slug  varchar2(64)  /* UNIQUE */,
       created  timestamp with time zone,
       merchant  raw(64),
       is_active  boolean,
       description  varchar2(128),
       "__v"  number,
       ora$brands_dv_flex  JSON(Object),
       PRIMARY KEY("_id")
    );


    CREATE OR REPLACE JSON RELATIONAL DUALITY VIEW "MERN26DV".BRANDS_DV AS
    "MERN26DV".brands_dv_root @insert @update @delete
    {
      "__v"
      "_id" @cast(as: id)
      name
      slug
      created
      isActive: is_active
      merchant @cast(as: id)
      description
      ora$brands_dv_flex @flex
    };
    ```

3. Run the 12 reviewed DDL files as `MERN26DV`. This creates the 12 duality views in the `MERN26DV` schema.

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

4. Import the migrated documents into the duality views. Script `06_import_duality_views.sql` creates an error log per view, calls `DBMS_JSON_DUALITY.IMPORT_ALL`, then compares the document counts of each source collection and its view.

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

5. Publish the list of duality views to `MERN26`, which is where the application reads it. The dictionary view that lists duality views shows only the ones you own, so script `10_duality_catalog.sql` copies that list into a small manifest table and grants it to `MERN26`.

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

6. See the duality in action: read the same product as a JSON document and as relational rows. In Database actions as `MERN26DV`, run both queries. The first returns the product as the JSON document an application would expect. The second returns the rows of the root table that store it.

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

7. Find out whether any document deviates from the structure of its collection, without changing the documents. A schemaless store accepts any shape, so over time documents can drift. Validity views infer a JSON schema for each collection from its duality view and validate every document against it. As `ADMIN`, run `03b_grants_duality_to_data.sql`. It grants the duality views and tables of `MERN26DV` to `MERN26`, so `MERN26` can infer schemas from them.

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

8. As `MERN26`, run `07_validity_views.sql`. It stores the inferred schemas in `JSON_SCHEMAS` and creates validity views for users, products, orders and carts.

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

9. In Database actions as `MERN26`, check the roll-up and look for documents that do not match their schema.

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

10. Open `http://localhost:8080/support/admin-db` again. The duality panel shows each view as in sync or with pending documents, and the validity panel shows the report.

You may now **proceed to the next lab**.

## Learn More

* [Oracle Database API for MongoDB](https://docs.oracle.com/en/database/oracle/mongodb-api/)
* [Simple Dot-Notation Access to JSON Data](https://docs.oracle.com/en/database/oracle/oracle-database/23/adjsn/simple-dot-notation-access-to-json-data.html)
* [JSON-Relational Duality Developer's Guide](https://docs.oracle.com/en/database/oracle/oracle-database/26/jsnvu/) (optional Task 6)
* [Source repository migration guide](https://github.com/jasperan/mongodb-migrate-oci/blob/main/docs/26ai/migration-guide.md)

## Acknowledgements

* **Author** - Ignacio Martinez, Oracle
* **Last Updated By/Date** - Ignacio Martinez, October 2026
