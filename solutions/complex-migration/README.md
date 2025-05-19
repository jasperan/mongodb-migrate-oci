# Complex App Migration

This solution demonstrates the migration of a MERN (MongoDB, Express, React, Node.js) application with complex MongoDB features to Oracle Database.

As an introduction, we will talk about three different types of ways to store data:
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

- Docker and Docker Compose
- Oracle Database 19c or later
- MongoDB 4.4 or later
- Python 3.9+ (for Python migration utility)
- Oracle Python Driver (cx_Oracle)
- PyMongo
- Java 17+ (for mongo2ora tool)

## MERN Application Setup

1. Clone the MERN application:
```bash
git clone https://github.com/your-username/mern-ecommerce.git
cd mern-ecommerce
```

2. Configure environment variables:
```bash
# Create .env files for client and server
cp client/.env.example client/.env
cp server/.env.example server/.env

# Update MongoDB connection string in server/.env
MONGODB_URI=mongodb://mongodb:27017/ecommerce
```

3. Start the application using Docker Compose:
```yaml
version: '3.8'
services:
  client:
    build: ./client
    ports:
      - "3000:3000"
    environment:
      - REACT_APP_API_URL=http://localhost:5000
    depends_on:
      - server

  server:
    build: ./server
    ports:
      - "5000:5000"
    environment:
      - MONGODB_URI=mongodb://mongodb:27017/ecommerce
    depends_on:
      - mongodb

  mongodb:
    image: mongo:latest
    ports:
      - "27017:27017"
    volumes:
      - mongodb_data:/data/db

volumes:
  mongodb_data:
```

4. Build and start the containers:
```bash
docker-compose up --build
```

5. Access the application:
- Frontend: http://localhost:3000
- Backend API: http://localhost:5000
- Admin interface: http://localhost:3000/admin
  - Email: admin@example.com
  - Password: admin123

## Migration Approaches

### 1. Java-based Migration (mongo2ora)

This approach uses the mongo2ora Java tool for complex schema migration:

1. Configure the migration settings in `transform-rules.json`:
```json
{
  "collections": ["users", "products", "orders", "reviews"],
  "transformations": {
    "users": {
      "fieldMappings": {
        "_id": "id",
        "email": "email_address"
      }
    }
  }
}
```

2. Run the migration:
```bash
java -jar mongo2ora.jar \
  --source-uri mongodb://localhost:27017/ecommerce \
  --target-uri oracle://localhost:1521/ecommerce \
  --transform-config transform-rules.json
```

### 2. Python-based Direct Migration

An alternative approach using the provided Python migration utility:

1. Configure the migration settings in `config/config.ini`:
```ini
[mongodb]
userid=your_mongo_user
password=your_mongo_password
hostname=localhost
port=27017
sourcedb=your_database
iscloud=N
fetchsize=1000
collection=your_collection

[oracle]
userid=your_oracle_user
password=your_oracle_password
service=your_service_name
usertablespace=your_tablespace
dropschemas=Y
```

2. For a single collection, run:
```bash
cd scripts
python mongo2ora_singlecollection.py
```

3. For multiple collections, use the multi-collection migration script:
```bash
cd scripts
python migrate_all_collections.py
```

The multi-collection migration script:
- Automatically detects all collections in the MongoDB database
- Updates the configuration for each collection
- Migrates collections sequentially
- Provides detailed logging in `log/multi_collection_migration.log`
- Handles errors for each collection independently

Features of the Python migration utility:
- Direct MongoDB to Oracle migration using SODA API
- Automatic schema creation and management
- Batch processing with configurable sizes
- Progress tracking and logging
- Error handling and recovery
- Support for large collections
- Parallel processing capabilities

The utility provides:
- Automatic schema creation in Oracle
- SODA collection creation with proper metadata
- Batch processing of documents
- Progress logging to `log/mongodb_datamigration.log`
- Error handling and recovery mechanisms
- Support for case-insensitive collection names
- Automatic constraint management

## MongoDB Aggregation Framework & OracleDB Compatibility

MongoDB introduced its own query language (MQL) for basic document queries (e.g., `db.collection.find`). However, for more advanced analytics and data processing, MongoDB created the **Aggregation Framework**, which allows users to build complex data transformations using **aggregation pipelines** (e.g., `db.collection.aggregate([...])`).

Aggregation pipelines are widely used in real-world MongoDB applications for grouping, filtering, sorting, and transforming large sets of documents. Each pipeline consists of a sequence of stages (commands) such as `$match`, `$group`, `$sort`, `$lookup`, etc. This framework is unique to MongoDB and is not a database industry standard.

**Migration Challenge:**
- Many companies rely heavily on aggregation pipelines in their MongoDB workloads.
- To support these workloads, Oracle's MongoDB API must be compatible with the aggregation framework.
- However, MongoDB's aggregation framework is large and evolving, with many operators and features. Oracle's implementation covers the most common operators, but not all (due to resource, priority, or technical reasons).

**Oracle's Approach:**
- The MongoDB API in Oracle Autonomous Database (implemented in ORDS, a Java application) translates incoming aggregation pipelines into equivalent SQL queries.
- These SQL queries are executed by Oracle's mature SQL engine, and the results are returned as JSON documents to the application.
- This approach leverages Oracle's powerful SQL engine rather than building a new aggregation engine from scratch.

**Limitations and Workarounds:**
- Not all MongoDB aggregation operators are supported yet. Some may be buggy, unsupported, or not yet implemented (especially new or rarely used ones).
- To help bridge this gap, Oracle provides a special `$sql` operator in the aggregation pipeline. This allows users to write custom SQL for cases where the MongoDB aggregation framework is not fully supported.
- The `$sql` operator is not part of the MongoDB standard, but is provided by Oracle to help with migration and compatibility.

**Summary:**
- Most common aggregation pipelines will work out of the box, but some advanced or new operators may not be supported.
- For unsupported cases, use the `$sql` operator to write custom SQL as part of your aggregation pipeline.
- This hybrid approach enables most MongoDB workloads to migrate with minimal changes, while still allowing full power and flexibility of Oracle SQL when needed.

## Performance Optimization

1. Query Pattern Analysis:
   - Identify common query patterns
   - Analyze index usage
   - Document performance bottlenecks

2. Index Optimization:
   ```sql
   -- Create indexes for common query patterns
   CREATE INDEX idx_product_name ON products_collection 
   json_value(data, '$.name' RETURNING VARCHAR2(100));
   
   CREATE INDEX idx_product_price ON products_collection 
   json_value(data, '$.price' RETURNING NUMBER);
   ```

3. JSON Search Index Configuration:
   ```sql
   -- Create JSON search index for text search
   CREATE SEARCH INDEX idx_product_search ON products_collection
   FOR JSON
   COLUMNS (data)
   PARAMETERS ('SEARCH_ON TEXT');
   ```

## Verification

After migration:
1. Verify data integrity
2. Test application functionality
3. Compare performance metrics
4. Validate indexes and constraints
5. Test complex queries and aggregations

## Next Steps

1. Implement the chosen migration approach
2. Set up monitoring and logging
3. Create rollback procedures
4. Document the migration process
5. Optimize performance based on usage patterns 