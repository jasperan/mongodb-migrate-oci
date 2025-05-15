# Simple App Migration

This solution demonstrates a straightforward migration of a MERN (MongoDB, Express, React, Node.js) application to Oracle Database.

## Overview

The migration process involves:
1. Setting up the MERN ecommerce application
2. Exporting data from MongoDB using either:
   - `mongodump` and `dbms_migrator` (traditional approach)
   - Python-based direct migration utility (alternative approach)
3. Importing data into Oracle Database
4. Verifying the migration

## Prerequisites

- Docker and Docker Compose
- Oracle Database 19c or later
- MongoDB 4.4 or later
- Python 3.9+ (for Python migration utility)
- Oracle Python Driver (cx_Oracle)
- PyMongo

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

### 1. Traditional Approach (mongodump + dbms_migrator)

This approach uses MongoDB's native tools and Oracle's migration utilities:

1. Export MongoDB data:
```bash
python scripts/migrate_mongodump.py
```

The script uses `mongodump` with the following optimizations:
- Gzip compression for efficient storage
- Oplog inclusion for consistency
- Parallel collection processing
- Primary read preference for consistency

2. Import to Oracle:
```sql
BEGIN
    dbms_migrator.import_mongodb_collection(
        p_directory => 'DATA_PUMP_DIR',
        p_file_name => 'users.bson',
        p_collection_name => 'users'
    );
END;
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
cd mongodb2ora_migrationtools
python mongo2ora_singlecollection.py
```

3. For multiple collections, use the multi-collection migration script:
```bash
cd mongodb2ora_migrationtools
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

## Verification

After migration:
1. Verify data integrity
2. Test application functionality
3. Compare performance metrics
4. Validate indexes and constraints

## Next Steps

1. Implement the chosen migration approach
2. Set up monitoring and logging
3. Create rollback procedures
4. Document the migration process 