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

## Solutions

1. [Simple app migration](./solutions/simple-migration/README.md)
2. [Complex app migration](./solutions/complex-migration/README.md)
3. [AI enhancements to the app](./solutions/ai-analytics/README.md)

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
