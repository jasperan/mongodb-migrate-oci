# Complex App Migration

## Introduction

This solution demonstrates the migration of a MERN (MongoDB, Express, React, Node.js) application with complex MongoDB features to Oracle Database.

We will talk about three different types of ways to store data:
- **MongoDB Collection**: The original data in your MongoDB database.
- **Oracle MongoDB API (JSON native collection)**: The collection as seen by Oracle's MongoDB API, compatible with MongoDB drivers and tools; this is a non-relational collection
- **Oracle JSON Duality View**: An advanced Oracle feature that provides a relational/JSON dual view of your data, enabling powerful SQL analytics and integration. This creates relational views for non-relational JSON collections! This is the main interface for data access and manipulation that we will follow in this solution.

> **Note**: while the MongoDB API collections allow for MongoDB-style access, the Duality Views are the recommended way to leverage Oracle's full power for analytics, SQL, and integration.

## Overview

The migration process involves:
1. Setting up the MERN ecommerce application
2. Identifying complex MongoDB features
3. Migrating data using either:
   - mongo2ora Java-based tool
   - Python-based direct migration utility
4. Optimizing performance
5. Verifying the migration

## Prerequisites

- Docker or Podman to run containers
- Oracle Database 23ai
- Python 3.10+ (for Python migration utility) with Anaconda or `venv` to run provided scripts (which will automate most of the troubles)
- `node.js` 18+ and `npm`
- A `mongodb` database running
- Oracle Autonomous JSON Database 23ai, with the MongoDB API plugin/tool enabled, and users `ecommerce` and `ecommercedv` created with proper permissions

This solution assumes you have previously completed the [simple migration process](../simple-migration/README.md), and have successfully imported all JSON native collections in the MERN app into your Autonomous db instance.
If you haven't performed all the steps in this previous solution, then you will certainly run into errors here.

## Recap

In the [simple migration solution](../simple-migration/README.md), we had successfully imported all MongoDB collections as native JSON data into the ecommerce schema of Oracle Autonomous Database using `mongorestore`.

At this point, our data is fully available in JSON format, and thanks to Autonomous Database’s unique capabilities, we can now query this data flexibly using dot notation or SQL/JSON functions.

Most importantly, we can build relational or duality views directly on top of these JSON collections — closing the gap between non-relational and relational.

If you recall, we finally created some JSON query data with dot notation, to track:
- All actively sold products over 50 dollars
- All non-taxable products in the shop

But, in this complex migration, we will take a look at performing a complex migration, where we'll not only work with JSON native collections, but also with **JSON Duality Views**.

But wait, since we already created some views to visualize the non-relational data in these collections, **why do we need JSON Duality Views? (JSON DVs)**

First, making queries in dot notation lets us query and filter JSON data, but:
- We're still interacting with JSON native collections, as blobs
- Therefore, we don't get a relational schema: no columns, constraints, foreign keys, updatable views... Integration with other tools that expect relational tables becomes otherwise very *time-consuming*.
- With JSON DVs, we present the data as **fully relational**, with tables and views, columns, types, etc.
- We can integrate with all SQL operations (join, insert, delete...) and BI tools that lack custom JSON native logic / support.
- JSON DVs are used in **MongoDB aggregation pipelines**, which are used to implement some parts of the MERN app, like the `search products` function. Therefore, without having JSON DVs, we can't expect the MERN app to work 100% like it did in mongodb.

Therefore, we'll focus on how to **perform a migration from non-relational JSON native collections, to JSON Duality Views**, our last focus topic during the migration.

## JSON DVs creation & migration

At the moment, we should have three different database users:
- `ADMIN`, which sets up permissions for the other users and has 2 dot product notation views against the `ecommerce` user, holding the data for the app
- `ecommerce`, which is the user that will hold the data export from `mongorestore` after switching from a mongodb instance to Autonomous
- `ecommercedv`, which will be responsible for creating and owning the JSON Duality Views corresponding to the JSON native collections in user `ecommerce`

Knowing this, we will use the `ecommercedv` user for most of these things, as we used the `ecommerce` user for most things during the simple app migration.

### Step 1: Generate JSON DVs and root tables

With the script [`3.sql`](../../sql/3.sql), we will automate the generation of JSON DVs and their corresponding root tables (used for querying). With the function `dbms_json_duality.infer_and_generate_schema`,  we will automatically infer and generate the duality view schema for that specific table. We will repeat this process for all collections in the MERN app (more concretely, those tables that got migrated into Autonomous under user `ecommerce`), to facilitate the creation of all their JSON DVs.

Run the following script:

```sql
-- run as ecommercedv
-- this will perform the migration from `ecommerce` to `ecommercedv`
-- output of this procedure: run script_fixed with your output but put drop tables so you
-- can run it again and again without errors
create or replace procedure print_clob_to_output (
  p_clob in clob
) is
  l_offset int := 1;
begin
  loop
    exit when l_offset > dbms_lob.getlength(p_clob);
    dbms_output.put_line(dbms_lob.substr(
      p_clob,
      255,
      l_offset
    ));
    l_offset := l_offset + 255;
  end loop;
end print_clob_to_output;
/

declare
  schema_sql clob;
begin
  for c in (
    select table_name
      from all_tables
      -- here, I take out this table present in autonomous automatically - we only want our collections.
     where owner = 'ECOMMERCE' and table_name in ('addresses', 'brands', 'carts', 'categories', 'contacts', 'merchants', 'orders', 'products', 'reviews', 'users', 'wishlists')
     order by 1
  ) loop
    begin
      schema_sql := dbms_json_duality.infer_and_generate_schema(
        json(
          '{
                        "sourceSchema": "ECOMMERCE",
                        "tableNames" : ["'
          || lower(c.table_name)
          || '"],
                        "viewNames" : ["'
          || lower(c.table_name)
        || '"],
                        "useFlexFields" : true,
                        "updatability" : true,
                        "outputFormat" : "standalone",
                        "normalize": false,
                        "enableUnnestedAttributes": false,
                        "enableNestedAttributes": false,
                        "hints": [{"type" : "normalize", "table" : "' || c.table_name || '",  "path" : "$", "value" : false}]
                }'
        )
      );
      print_clob_to_output(schema_sql);
           -- execute immediate schema_sql;
    exception
      when others then
        dbms_output.put_line('Error raised for '
                             || c.table_name
                             || ': '
                             || dbms_utility.format_error_backtrace
                             || ' - '
                             || sqlerrm);
    end;
  end loop;
exception
  when others then
    dbms_output.put_line('Error raised: '
                         || dbms_utility.format_error_backtrace
                         || ' - '
                         || sqlerrm);
    raise;
end;
/
```

### Step 2: Run DVs generation schema in ecommercedv

After executing the script in Step 1, you will get a SQL script output. However, you will probably need to fix syntax errors, as the generations may contain unescaped characters that may break the SQL interpreter when running these queries.

However, you will probably need to fix syntax errors, as the generations may contain unescaped characters that may break the SQL interpreter when running these queries. For the output:
- Include `DROP` statements (take my script as an example) at the beginning of the script, so you can run the script multiple times without errors / conflicts
- Fix indentation every ~40/50 lines
- Ensure table and view names are in **lowercase** (e.g., "products" instead of "PRODUCTS")
- Validate the syntax before execution

> **Note**: Make sure to run the script with the `ecommercedv` user. Then, you will have successfully created your JSON DVs!

### Step 3: Import into JSON Duality Views

Now that we have the root tables and JSON DVs created, we need to perform an import with the preset function `dbms_json_duality.import()`.

For that, you can take [this script (`4.sql`)](../../sql/4.sql) as reference. In this script:

```sql
begin
	for c in (
		select table_name
		  from all_tables
		 where owner = 'ECOMMERCE'
	) loop
		begin
			dbms_errlog.create_error_log(
			                            dml_table_name => c.table_name,
			                            err_log_table_name => c.table_name || '_ERR_LOG',
			                            skip_unsupported => true
			);
		exception
			when others then
				null;
		end;
		begin
			dbms_json_duality.import(
			                        table_owner_name => 'ECOMMERCE',
			                        table_name => c.table_name,
			                        view_owner_name => 'ECOMMERCEDV',
			                        view_name => lower(
					      c.table_name
				      ),
			                        err_log_name => c.table_name || '_ERR_LOG'
			);
		exception
			when others then
				null;
		end;
	end loop;
end;
/
```

> **Note**: execute with `ecommercedv` user (or alternatively with ADMIN.)

We iterate through all tables where the owner is the `ecommerce` user, and import the data into the JSON Duality Views respectively owned by the `ecommercedv` user for each one of these tables. 

After you run this script, you should see your non-relational data being displayed by these Duality Views:

![views ecommercedv](../../img/views_ecommercedv.png)

![views ecommercedv data](../../img/views_ecommerce_dv_data.png)

> **Note**: This query runs against the view "products" in schema `ECOMMERCEDV`, NOT against table "products" in schema `ECOMMERCE`

### Step 4: Start the MERN App with Oracle MongoDB API URI

Edit the `./mern-ecommerce/server/.env` file and swap the MongoDB original URI we had with the one from Autonomous - more specifically, for user and schema `ecommercedv` (the one we will use from now on).

In my case, I had to modify:

```bash
# original mongodb uri - comment
#MONGO_URI=mongodb://127.0.0.1:27017/mern_ecommerce
# autonomous uri with ecommercedv user
MONGO_URI=mongodb://ecommercedv:mypw@mydburi.adb.us-phoenix-1.oraclecloudapps.com:27017/ecommercedv?loadBalanced=true&retryWrites=false&authMechanism=PLAIN&authSource=$external&tls=true&tlsAllowInvalidCertificates=true
```

This `ecommercedv` user, from now on:
- Will use its own JSON native collections to store CRUD-based operations (like insertOne, etc.)
- Will use JSON DVs for complex things like aggregation pipelines, meaning these queries will run against user `ecommerce`.

Finally, start the backend and frontend as usual:

  ```bash
  cd mern-ecommerce
  npm run dev
  ```

Now, the application will be running against your Autonomous 23ai instance, through the MongoDB API plugin we enabled! Your app is ready to use with all features of the app (all CRUD operations + product searches!), and we've finished the migration process.

### Step 5: Handle Missing Collections

If you are missing any collections (e.g. `addresses`, `cartitems`, `contacts`, `merchants`, `wishlists`):
- **In MongoDB:** Create them with at least one dummy document before running `mongorestore`. You can compare if you have all collections by taking a look at the `dump/` directory generated by `mongodump`, and inspecting if all the files you have match with [my list of collections in the MERN app here.](../../docs/mern_collection_examples.json)
- **In Oracle:** After `mongorestore`, you can manually create empty collections using the following SQL (see end of `script_fixed.sql`). However, this should not happen if you've performed all steps. If you have errors with missing JSON native collections or duality views in Autonomous, you can open an issue in this repository and we'll be able to help.

  ```sql
  create json collection table "cartitems" with etag;
  create json collection table "contacts" with etag;
  ```

Repeat for any other missing collections.

## MongoDB Aggregation Framework & OracleDB Compatibility

MongoDB introduced its own query language (MQL) for basic document queries (e.g., `db.collection.find`). However, for more advanced analytics and data processing, MongoDB created the **Aggregation Framework**, which allows users to build complex data transformations using **aggregation pipelines** (e.g., `db.collection.aggregate([...])`).

Aggregation pipelines are widely used in real-world MongoDB applications for grouping, filtering, sorting, and transforming large sets of documents. Each pipeline consists of a sequence of stages (commands) such as `$match`, `$group`, `$sort`, `$lookup`, etc. This framework is unique to MongoDB and is not a database industry standard.

**Migration Challenge:**
- Many companies rely heavily on aggregation pipelines in their MongoDB workloads.
- To support these workloads, Oracle's MongoDB API must be compatible with the aggregation framework
- However, MongoDB's aggregation framework is large and evolving, with many operators and features. Oracle's implementation covers the most common operators, but not all (due to resource, priority, or technical reasons).

**Oracle's Approach:**
- The MongoDB API in Oracle Autonomous Database (implemented in ORDS, a Java application) translates incoming aggregation pipelines into equivalent SQL queries.
- These SQL queries are executed by Oracle's SQL engine, and the results are returned as JSON documents to the application.
- This approach leverages Oracle's powerful SQL engine rather than building a new aggregation engine from scratch.

**Limitations and Workarounds:**
- Not all MongoDB aggregation operators are supported yet. Some may be buggy, unsupported, or not yet implemented (especially new or rarely used ones).
- To help bridge this gap, Oracle provides a special `$sql` operator in the aggregation pipeline. This allows users to write custom SQL for cases where the MongoDB aggregation framework is not fully supported.
- The `$sql` operator is not part of the MongoDB standard, but is provided by Oracle to help with migration and compatibility

**Summary:**
- Most common aggregation pipelines will work out of the box, but some advanced or new operators may not be supported.
- For unsupported cases, use the `$sql` operator to write custom SQL as part of your aggregation pipeline.
- This hybrid approach enables most MongoDB workloads to migrate with minimal changes, while still allowing full power and flexibility of Oracle SQL when needed.

## Contributing

This project welcomes contributions from the community. Before submitting a pull
request, please [review our contribution guide](./CONTRIBUTING.md).

## Security

Please consult the [security guide](./SECURITY.md) for our responsible security
vulnerability disclosure process.

## License
Copyright (c) 2024 Oracle and/or its affiliates.

Licensed under the Universal Permissive License (UPL), Version 1.0.

See [LICENSE](LICENSE.txt) for more details.

ORACLE AND ITS AFFILIATES DO NOT PROVIDE ANY WARRANTY WHATSOEVER, EXPRESS OR IMPLIED, FOR ANY SOFTWARE, MATERIAL OR CONTENT OF ANY KIND CONTAINED OR PRODUCED WITHIN THIS REPOSITORY, AND IN PARTICULAR SPECIFICALLY DISCLAIM ANY AND ALL IMPLIED WARRANTIES OF TITLE, NON-INFRINGEMENT, MERCHANTABILITY, AND FITNESS FOR A PARTICULAR PURPOSE.  FURTHERMORE, ORACLE AND ITS AFFILIATES DO NOT REPRESENT THAT ANY CUSTOMARY SECURITY REVIEW HAS BEEN PERFORMED WITH RESPECT TO ANY SOFTWARE, MATERIAL OR CONTENT CONTAINED OR PRODUCED WITHIN THIS REPOSITORY. IN ADDITION, AND WITHOUT LIMITING THE FOREGOING, THIRD PARTIES MAY HAVE POSTED SOFTWARE, MATERIAL OR CONTENT TO THIS REPOSITORY WITHOUT ANY REVIEW. USE AT YOUR OWN RISK. 
