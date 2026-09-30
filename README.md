# MERN Ecommerce on Oracle AI Database 26ai

[![License: UPL](https://img.shields.io/badge/license-UPL-green)](https://img.shields.io/badge/license-UPL-green) [![Quality gate](https://sonarcloud.io/api/project_badges/quality_gate?project=oracle-devrel_test)](https://sonarcloud.io/dashboard?id=oracle-devrel_test)

A full-featured MERN ecommerce application that was migrated from MongoDB to **Oracle AI Database
26ai** through the **Oracle Database API for MongoDB** — and then extended with JSON-relational
duality views, JSON schema validity checks and in-database AI.

## Introduction

MERN (MongoDB, Express.js, React, Node.js) became popular because one language covers the whole
stack. This repository keeps that developer experience and moves the data layer to Oracle:

* **No application rewrite** — the Express/Mongoose backend keeps speaking the MongoDB wire
  protocol through the Oracle Database API for MongoDB; only the connection string changes.
* **One copy of the data** — the same documents are exposed as JSON collections, as relational
  views, and as updatable JSON-relational duality views.
* **More than JSON** — SQL analytics, JSON schema validation, vector search and natural-language
  SQL (Select AI) work on the migrated documents without ETL.

## Architecture

```text
[React 19 client]  ──HTTP──►  [Express API]  ──MongoDB wire protocol──►  Oracle AI Database 26ai
     (web/)                      (server/)         (Database API for MongoDB)      ├─ JSON collections (MERN26)
                                                                                    ├─ relational + JSON collection views
                                                ──SQL (node-oracledb)──►            ├─ duality views (MERN26DV)
                                                                                    ├─ JSON validity views
                                                ──OpenAI-compatible / Select AI ──► └─ vector search + AI
```

## Key features

* **Ecommerce flows:** buyer, merchant and admin roles — catalogue, cart, checkout, orders,
  wishlists, reviews, addresses, support chat.
* **Migration showcase:** a dashboard (`/support/admin-db`) that reports, live from the database:
  source vs target document counts, the JSON collections, relational views, duality views and the
  JSON validity report.
* **AI assistant** (`/support/llm-chat`): retrieval runs in-database (`VECTOR_DISTANCE` over
  embeddings stored in Oracle), generation runs on an OpenAI-compatible model (xAI/OpenAI/OCI
  Generative AI/vLLM). `POST /api/ai/ask` additionally exposes Oracle Select AI
  (natural language → SQL) when a profile is configured.
* **In-database embeddings, no API key:** all-MiniLM-L12-v2 is loaded into the application schema
  as an ONNX graph with [`onnx2oracle`](https://github.com/jasperan/onnx2oracle)
  (`server/scripts/load_onnx_embedding.py`), so `POST /api/ai/similar` and the retrieval half of the
  chat run entirely inside Oracle — the text never leaves the database. Only generation needs a
  provider key.
* **Support chat** (`/support`): socket.io conversations between customers and staff.

## Repository layout

| Path | What it is |
|---|---|
| `mern-ecommerce/server` | Express + Mongoose API (MongoDB API for Oracle, SQL showcase endpoints, AI) |
| `mern-ecommerce/web` | React 19 + Vite + Tailwind client |
| `sql/26ai` | Migration setup, validation, view, duality and AI scripts (this release) |
| `sql/23ai` | The previous 23ai-era scripts, kept for reference |
| `scripts/verify_migration.py` | Document-level source↔target verification (counts, ids, content hashes) |
| `docs/26ai/migration-guide.md` | Step-by-step migration + verification runbook |
| `docs/26ai/api-contract.md` | Every Express endpoint, payload and side effect |
| `solutions/` | Simple migration, complex migration and AI/analytics narratives |
| `livelabs/` | Oracle LiveLabs workshop content on JSON + MongoDB duality |

## Quick start

```bash
# 1. API ---------------------------------------------------------------
cd mern-ecommerce/server
npm install
cp .env.example .env      # fill in MONGO_URI, ORACLE_* and the LLM settings (OCI Generative AI by default)
npm start                 # http://localhost:3000

# 2. Client ------------------------------------------------------------
cd ../web
npm install
npm run dev               # http://localhost:8080 (proxies /api to :3000)
```

Seed an administrator on the source database with
`npm run seed:db admin@example.com admin123`.

## Migration in one page

1. **Plan** — profile the workload and review the MongoDB operators used by the application
   (`server/utils/queries.js` contains the aggregation pipelines).
2. **Prepare** — enable the MongoDB API on the Autonomous Database, create the target schemas
   (`sql/26ai/01_schemas.sql`).
3. **Execute** — `mongodump` the source, `mongorestore` it into the target schema through the
   MongoDB API (no application changes beyond `MONGO_URI`).
4. **Validate** — `python scripts/verify_migration.py` compares every document (ids, counts,
   content hashes) and `sql/26ai/02_verify_counts.sql` performs the SQL-side count check.
5. **Extend** — relational views (`04`), duality views (`05`/`06`), JSON validity views (`07`) and
   the AI layer (`08`/`09`).

Full details, including the reference run's results (204 documents, 12 collections, 12 duality
views, 132/132 valid documents): [`docs/26ai/migration-guide.md`](docs/26ai/migration-guide.md).

## Solutions

1. [Simple app migration](./solutions/simple-migration/README.md)
2. [Complex app migration](./solutions/complex-migration/README.md)
3. [AI enhancements to the app](./solutions/ai-analytics/README.md)

## Annex: data model

- See [docs/ai-analytics/collections-and-schemas.md](docs/ai-analytics/collections-and-schemas.md)
  for the collections and document structures (stored as Oracle JSON collections).

## Contributing

This project welcomes contributions from the community. Before submitting a pull
request, please [review our contribution guide](./CONTRIBUTING.md).

## Security

Please consult the [security guide](./SECURITY.md) for our responsible security
vulnerability disclosure process.

## License
Copyright (c) 2024, 2026 Oracle and/or its affiliates.

Licensed under the Universal Permissive License (UPL), Version 1.0.

See [LICENSE](LICENSE.txt) for more details.

ORACLE AND ITS AFFILIATES DO NOT PROVIDE ANY WARRANTY WHATSOEVER, EXPRESS OR IMPLIED, FOR ANY SOFTWARE, MATERIAL OR CONTENT OF ANY KIND CONTAINED OR PRODUCED WITHIN THIS REPOSITORY, AND IN PARTICULAR SPECIFICALLY DISCLAIM ANY AND ALL IMPLIED WARRANTIES OF TITLE, NON-INFRINGEMENT, MERCHANTABILITY, AND FITNESS FOR A PARTICULAR PURPOSE.  FURTHERMORE, ORACLE AND ITS AFFILIATES DO NOT REPRESENT THAT ANY CUSTOMARY SECURITY REVIEW HAS BEEN PERFORMED WITH RESPECT TO ANY SOFTWARE, MATERIAL OR CONTENT CONTAINED OR PRODUCED WITHIN THIS REPOSITORY. IN ADDITION, AND WITHOUT LIMITING THE FOREGOING, THIRD PARTIES MAY HAVE POSTED SOFTWARE, MATERIAL OR CONTENT TO THIS REPOSITORY WITHOUT ANY REVIEW. USE AT YOUR OWN RISK.
