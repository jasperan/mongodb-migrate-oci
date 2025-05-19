# MERN Ecommerce with Oracle AI/Analytics & LLM Chat (Ollama)

[![License: UPL](https://img.shields.io/badge/license-UPL-green)](https://img.shields.io/badge/license-UPL-green) [![Quality gate](https://sonarcloud.io/api/project_badges/quality_gate?project=oracle-devrel_test)](https://sonarcloud.io/dashboard?id=oracle-devrel_test)

## Introduction

MERN (MongoDB, Express.js, React, Node.js) is a popular full-stack JavaScript framework that has gained widespread adoption in modern web development. This architecture is particularly favored for its ability to use JavaScript throughout the entire application stack, from frontend to backend, creating a seamless development experience.

The popularity of MERN stems from several key factors:
- **JavaScript**: Using JavaScript across the entire stack eliminates context switching between different programming languages, making development more efficient and reducing the learning curve for developers.
- **Component-Based Architecture** (modularity): React's component-based approach enables reusable UI elements and efficient state management, leading to more maintainable and scalable applications.
- **Flexible Data Storage**: MongoDB's document-based structure provides flexibility in data modeling, making it ideal for rapidly evolving applications and agile development practices.
- **Robust Backend**: Express.js and Node.js provide a powerful, `event`-driven backend that can handle high concurrency and real-time features effectively.

Therefore, developing an application using the MERN architecture is beneficial, as development cycles are shorter (highly scalable, because each component can be developed and tested independently), and this architecture naturally supports real-time features through WebSocket integration and event-driven programming, which makes the architecture comfortable to work with.

## Overview
This project is a full-featured MERN ecommerce application, enhanced with:
- **Oracle Autonomous JSON Database** for all data storage and vector search
- **Retrieval-Augmented Generation (RAG) LLM Chat** powered by [Ollama](https://ollama.com/) (OpenAPI-compatible)
- Modern React/Redux frontend and Express backend, conforming to the MERN architecture

## Architecture

```bash
[User]
  |
[React Chat UI] <--> [Express API] <--> [Oracle 23ai Vector Search]
                                                    |
                                                [Ollama LLM API]
```
- All product, review, and user data is initially stored in a `mongodb` database, while we provide easy migration steps to transition to Oracle Autonomous JSON Database 23ai. This way, users will benefit from all 23ai features, including self maintenance and integrated in-database LLMs.
- Vector search is performed in-database with `vector_distance` and `text_embedding` functions.
- The LLM chat endpoint retrieves relevant context from Oracle, then calls the Ollama API for a response.

## Key Features
- **Ecommerce flows:** Buyer, seller, and admin roles
- **Product, order, review, wishlist, and more** (see [docs/ai-analytics/collections-and-schemas.md](docs/ai-analytics/collections-and-schemas.md))
- **LLM Chat with RAG:**
  - Accessible at `/support/llm-chat` in the frontend through the Express API
  - Uses Oracle vector search for context retrieval and RAG-based generations
  - Calls Ollama LLM API to retrieve answers.
- **Modern, modular MERN codebase**

## Prerequisites
- `node.js` 18+ and `npm`
- A `mongodb` database running
- `mongodump` and `mongorestore` utilities installed where you're planning to run the migration from
- Oracle Autonomous JSON Database 23ai, with the MongoDB API plugin/tool enabled
- Ollama API deployed and accessible (set `OLLAMA_API_URL`)
- Python environment with Anaconda or `venv` to run provided scripts (which will automate most of the troubles)

## Local Development Setup

First, we will install the requirements needed to run the `MERN` application.

### 1. Backend Setup

First, install `npm` dependencies:

```bash
cd mern-ecommerce/server
npm install
```

![db connection](./img/db_connection.png)

Then, create a `.env` file in the `server/` directory with at least the following environment variables. Make sure to specify these ones as best you can, considering these notes:
- `ORACLE_CONNECT_STRING` variables can be obtained from the Autonomous Database `Database Connections` tab
- `OLLAMA_API_URL`: this will be used to communicate with an `ollama` inferencing server, so if you're planning to run the AI part of this solution, specify your ollama endpoint.
- `MONGO_URI`: URI for your initial `mongodb` database, from where you want to perform the migration from.
- `CLIENT_URL`: set to `http://localhost:8080` as constant.

```bash
ORACLE_USER=your_oracle_user
ORACLE_PASSWORD=your_oracle_password
ORACLE_CONNECT_STRING=your_oracle_connect_string
JWT_SECRET=your_jwt_secret
OLLAMA_API_URL=http://localhost:11434 # (or your Ollama endpoint), where the Large Language Model will be hosted
MONGO_URI=mongodb://mongo:27017/mern_ecommerce
PORT=3000
BASE_API_URL=api
CLIENT_URL=http://localhost:8080
```

> You can generate your own JWT_SECRET or invent your own using a random string. This will be used for authentication purposes within the MERN app.

Finally, once our MongoDB instance is running, we can seed it with new data. The following command will add an administrator account which will let us login through the front-end:

```bash
npm run seed:db admin@example.com admin123 && npm start
# this creates an admin account so you can use it to manage the app.
# format: email password
```

### 2. Frontend Setup

1. Install npm dependencies:

  ```bash
  cd mern-ecommerce/client
  npm install
  ```

2. Create a `.env` file in the `client/` directory with the following content:

  ```bash
  API_URL=http://localhost:3000/api
  ```

Now, we're ready to run the MERN app, which will be connected to the MongoDB API URI we specified in `./server/.env`.

### 3. Run the MERN app

Run the following command to start a development environment (what we need):

```bash
npm run dev
```

The frontend will be available at port 8080, [here](http://localhost:8080) by default (or as configured).

## End-to-End Migration: MongoDB to Oracle Autonomous JSON DB

This section describes the recommended workflow to migrate your MERN app data from MongoDB to Oracle Autonomous JSON Database (with MongoDB API compatibility).

### 1. Create Oracle DB Users/Schemas

Run the following SQL as an admin user (see `sql/1.sql`). This will create two new users. The first one will be used to perform the migration, and the other one will be used to create the JSON Duality Views of these collections, which will essentially allow us to have a relational schema compatible and updated with the JSON collections that were migrated:

```sql
-- as admin
GRANT DB_DEVELOPER_ROLE, DWROLE, UNLIMITED TABLESPACE, SODA_APP to ecommerce identified by "password";
GRANT DB_DEVELOPER_ROLE, DWROLE, UNLIMITED TABLESPACE, SODA_APP to ecommercedv identified by "password";
```

### 2. Export Data from MongoDB (mongodump)

From your MongoDB container or host, run:

```sh
mongodump --uri "mongodb://localhost:27017/mern_ecommerce?ssl=false&authSource=admin" -u <user> -p <password>
```
- This will create a `dump/mern_ecommerce` directory with your data.

### 3. Run SQL Script to setup schema and collections

- Run the scripts in the `sql/` directory as the appropriate user:
  - `1.sql`: Grants and privileges (run as admin). This will create `ecommerce` and `ecommercedv` database users and give them permissions to access their schemas and connect to the database.

### 4. Import Data to Oracle Autonomous (mongorestore)

Use the MongoDB API endpoint for your Oracle Autonomous DB. Example (see `dump_restore.sh`):

```sh
mongorestore -u admin -p '<oracle_password>' --drop \
  --uri "mongodb://<oracle_host>:27017/ecommerce?loadBalanced=true&retryWrites=false&authMechanism=PLAIN&authSource=%24external&ssl=true" \
  --nsInclude=mern_ecommerce \
  --writeConcern '{w:0}' \
  --ssl \
  --tlsInsecure \
  ./dump/mern_ecommerce
```

### 5. Run SQL scripts to create tables, views, collections, and JSON duality views

  - `2.sql`: this script needs to run after you've performed `mongorestore`, as it requires the JSON collections to have been created beforehand. This script will grant the `select` permission to the `ecommercedv`, where we'll do our JSON Duality Views configuration.
  - `script_fixed.sql`: Creates tables, views, and collections (run as `ecommerce`)
  - `3.sql` and `4.sql`: Additional schema setup and error logging (see comments in scripts). Run as `ecommercedv`

### 6. Start the MERN App with Oracle MongoDB API URI

![tool configuration](./img/tool_configuration.png)

Through the OCI Console, (if you haven't already) enable the MongoDB API tool/plugin within your Autonomous 23ai instance. Then, once enabled, you will be given a MongoDB URI, which will enable clients and drivers to connect [directly to Autonomous Database](https://docs.oracle.com/en-us/iaas/autonomous-database-serverless/doc/mongo-using-oracle-database-api-mongodb.html):

![mongodb api](./img/mongodb_api.png)

![db connection](./img/db_connection.png)

- Copy this URI and put it into your `.env` file, with the URI you extracted. Make sure to also change your USER, PASSWORD and CONNECT_STRING from the `Connections` tab.
  ```env
  MONGO_URI=mongodb://<oracle_host>:27017/ecommerce?authMechanism=PLAIN&authSource=$external&ssl=true&retryWrites=false&loadBalanced=true
  ORACLE_USER=ecommerce
  ORACLE_PASSWORD=<oracle_password>
  ORACLE_CONNECT_STRING=<oracle_connect_string>
  ```

- Start the backend and frontend as usual:

  ```bash
  cd mern-ecommerce
  npm run dev
  ```

Now, the application will be running against your Autonomous 23ai instance, through the MongoDB API plugin we enabled! Your app is ready to use with all the features available on Autonomous 23ai!

### 6. Handle Missing Collections

If you are missing any collections before `mongodump` (e.g. `addresses`, `cartitems`, `contacts`, `merchants`, `wishlists`):
- **In MongoDB:** Create them with at least one dummy document before running `mongodump`.
- **In Oracle:** After `mongorestore`, you can manually create empty collections using the following SQL (see end of `script_fixed.sql`):

```sql
create json collection table "cartitems" with etag;
create json collection table "contacts" with etag;
```

Repeat for any other missing collections.

## Annex

See `dump_restore.sh` for example commands and `sql/` for schema scripts.


## MongoDB Container Admin Utility (Podman)

You can use the `scripts/mongoContainerUtils.sh` script to interact with your MongoDB container (list databases, collections, stats) via Podman.

**Usage:**
```sh
./scripts/mongoContainerUtils.sh [container_name]
```
- If you do not specify a container name, it defaults to `mongodb`.
- Example for a custom container name:
  ```sh
  ./scripts/mongoContainerUtils.sh exciting_rubin
  ```

## Annex: Data Model

- See [docs/ai-analytics/collections-and-schemas.md](docs/ai-analytics/collections-and-schemas.md) for all collections and document structures (now stored in Oracle JSON DB).

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
