# MERN Ecommerce with Oracle AI/Analytics & LLM Chat (Ollama)

[![License: UPL](https://img.shields.io/badge/license-UPL-green)](https://img.shields.io/badge/license-UPL-green) [![Quality gate](https://sonarcloud.io/api/project_badges/quality_gate?project=oracle-devrel_test)](https://sonarcloud.io/dashboard?id=oracle-devrel_test)

## Overview
This project is a full-featured MERN ecommerce application, enhanced with:
- **Oracle Autonomous JSON Database** for all data storage and vector search
- **Retrieval-Augmented Generation (RAG) LLM Chat** powered by [Ollama](https://ollama.com/) (OpenAPI-compatible)
- Modern React/Redux frontend and Express backend, conforming to the MERN architecture

## Architecture

```
[User]
  |
[React Chat UI] <--> [Express API: /api/llm-chat] <--> [Oracle 23ai Vector Search]
                                                    |
                                                [Ollama LLM API]
```
- All product, review, and user data is stored in Oracle Autonomous JSON Database 23ai.
- Vector search is performed in Oracle using SQL with `vector_distance` and `text_embedding`.
- The LLM chat endpoint retrieves relevant context from Oracle, then calls the Ollama API for a response.

## Key Features
- **Ecommerce flows:** Buyer, seller, and admin roles
- **Product, order, review, wishlist, and more** (see [docs/ai-analytics/collections-and-schemas.md](docs/ai-analytics/collections-and-schemas.md))
- **LLM Chat with RAG:**
  - Accessible at `/support/llm-chat` in the frontend
  - Uses Oracle vector search for context
  - Calls Ollama LLM API for answers
- **Modern, modular MERN codebase**

## Prerequisites
- Node.js 18+
- Oracle Autonomous JSON Database 23ai (with required collections)
- Ollama API deployed and accessible (set `OLLAMA_API_URL`)

## Local Development Setup (No Docker Compose)


### 1. Backend Setup

First, install npm dependencies:

```sh
cd mern-ecommerce/server
npm install
```

Then, create a `.env` file in the `server/` directory with at least the following environment variables:

```sh
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

> You can generate your own JWT_SECRET or invent your own using a random string. This will be used for authentication purposes within the MERN app

Finally, once our MongoDB instance is running, we can seed it with new data:

```sh
npm run seed:db admin@example.com admin123 && npm start
# this creates an admin account so you can use it to manage the app.
# format: email password
```

### 2. Frontend Setup

First, install dependencies:

```sh
cd mern-ecommerce/client
npm install
```

The frontend will be available at port 8080, [here](http://localhost:8080) by default (or as configured).

### 3. Run the MERN app

Run the following command to start a development environment (what we need):

```bash
npm run dev
```

### 3. LLM Chat Feature
- The LLM chat UI is available at `/support/llm-chat` in the frontend.
- Ensure your Ollama API is running and accessible at the URL specified in `OLLAMA_API_URL`.
- The backend will call the Ollama API for chat completions using the context retrieved from your Oracle JSON collections.

## LLM Chat API (Backend)
- **POST `/api/llm-chat/message`**
  - Request: `{ "message": "How do I find shoes similar to these?" }`
  - Response: `{ "response": "...", "context": [ ... ] }`
- See [docs/ai-analytics/llm-chat.md](docs/ai-analytics/llm-chat.md) for architecture and details.

## Data Model
- See [docs/ai-analytics/collections-and-schemas.md](docs/ai-analytics/collections-and-schemas.md) for all collections and document structures (now stored in Oracle JSON DB).

## Data Migration: MongoDB to Oracle Autonomous JSON Database 23ai

After installing and running the MERN app, you can migrate your data from MongoDB to Oracle using the provided migration script.

### Migration Script: `scripts/orclMongoMigration.sh`

This script automates the process of moving your MongoDB data into Oracle. It uses Podman to manage containers and provides a menu-driven interface for various migration and database management tasks.

#### What the script does (step by step):
1. **Checks Podman installation** and starts a Podman machine if needed.
2. **Creates or starts an Oracle Database container** (with MongoDB API support if required).
3. **Provides menu options** for:
   - Starting/stopping/removing the Oracle container
   - Bash/root/SQL access to the container
   - Installing utilities and tools
   - Managing MongoDB and Oracle services
   - Running the migration process
4. **Runs the migration process**:
   - Connects to your MongoDB instance
   - Exports collections from MongoDB
   - Imports collections into Oracle Autonomous JSON Database
   - Offers verification and post-migration checks

#### How to use the migration script:

1. **Make the script executable:**
   ```sh
   chmod +x scripts/orclMongoMigration.sh
   ```
2. **Run the script:**
   ```sh
   ./scripts/orclMongoMigration.sh
   ```
3. **Follow the interactive menu:**
   - Choose the options to start the Oracle container and utilities as needed
   - Select the migration option to begin the data transfer
   - Follow prompts for verification and post-migration steps

> **Tip:** The script can also be run with command-line arguments for automation. Run `./scripts/orclMongoMigration.sh help` for details.

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
