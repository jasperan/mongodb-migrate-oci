# Introduction

## About this Workshop

Moving a MongoDB application to another database usually means rewriting its data layer. In this workshop you do not. You take a working MERN storefront (React, Express, Mongoose) and move its data to Oracle Autonomous AI Database 26ai through the Oracle Database API for MongoDB. The application keeps its MongoDB driver, its Mongoose models and its routes. Only the connection string changes, plus four query patterns that behave differently on the Oracle API:

| Pattern | What the Oracle API does | What the app does |
|---|---|---|
| `$lookup` | No `let`; errors for some `localField` shapes | The product list uses one `$sql` stage on Oracle |
| `$elemMatch` in an update filter | Rejected | Order-line updates address the array element by index |
| `$regex` with a separate `$options` | `$options` is ignored | The flags live on the RegExp: `new RegExp(term, 'i')` |
| Numeric limits | `skip` must fit in int32; `NUMBER` tops out near 1e126 | The API clamps paging and numeric filters |

The profiler command is also unavailable on Oracle, so you profile the workload on the source and use SQL Monitor on the target.

![The MERN Store home page served from Oracle AI Database 26ai](images/storefront.png " ")

### Architecture

The React client talks over HTTP and socket.io to the Express API. The API uses Mongoose, which speaks the MongoDB wire protocol. On the source side that protocol is answered by a MongoDB container on your workstation. On the target side it is answered by the Oracle Database API for MongoDB, served by Oracle REST Data Services in Autonomous AI Database 26ai. The same data is then readable with SQL: relational views, JSON-relational duality views, validity views, a vector store, and Select AI.

You use three database accounts: `ADMIN` (creates schemas and grants), `MERN26` (JSON collections and SQL views) and `MERN26DV` (duality views).

![The migration dashboard comparing source and target](images/migration-dashboard.png " ")

Estimated Workshop Time: 4 hours 15 minutes (3 hours for Labs 1 to 8; Labs 9 and 10 are optional and add 1 hour 5 minutes)

### Objectives

In this workshop you will:
* Prepare a Linux, macOS or Windows workstation with the required tools (Lab 1)
* Provision an Autonomous AI Database 26ai or locate the one in your reservation (Lab 2)
* Run the storefront on a local MongoDB (Lab 3)
* Assess the MongoDB workload before moving it (Lab 4)
* Create and prepare the `MERN26` and `MERN26DV` schemas (Lab 5)
* Migrate the data with `mongodump` and `mongorestore` through the MongoDB API (Lab 6)
* Validate the migration and cut the app over to Oracle (Lab 7)
* Query the migrated data with SQL, relational views and duality views (Lab 8)
* Optional: add vector search and the AI assistant (Lab 9)
* Optional: ask questions in natural language with Select AI (Lab 10)

![The AI assistant in the storefront](images/ai-assistant.png " ")

### Prerequisites

This workshop assumes you have:
* An Oracle Cloud tenancy where you can create an Autonomous AI Database, or a LiveLabs reservation that includes one
* A Linux, macOS or Windows 10/11 laptop where you have administrator rights
* Basic familiarity with a command line and with MongoDB or SQL

## Learn More

* [Oracle Database API for MongoDB](https://docs.oracle.com/en/database/oracle/mongodb-api/)
* [Autonomous AI Database documentation](https://docs.oracle.com/en/cloud/paas/autonomous-database/)
* [Source repository](https://github.com/oracle-devrel/mongodb-migrate-oci)

## Acknowledgements

* **Author** - Ignacio Martinez, Oracle
* **Last Updated By/Date** - Ignacio Martinez, October 2026
