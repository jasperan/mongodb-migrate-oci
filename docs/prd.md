# Product Requirements Document: MongoDB to Oracle Migration with AI Enhancement Project

## Document Information
- **Document Owner:** Nacho Martine
- **Last Updated:** May 15th, 2025
- **Document Status:** Draft

## Executive Summary
This project demonstrates the seamless migration of MongoDB workloads to Oracle Autonomous JSON Database (AJD) with additional AI capabilities. Using a MERN (MongoDB, Express, React, Node.js) Ecommerce application as our demonstration vehicle, we'll showcase three key solutions: simple migration, complex migration, and AI/analytics enhancement. The project aims to highlight Oracle's 23ai database capabilities, migration tools, and AI integration features for database administrators and developers.

## Project Objectives
1. Demonstrate smooth migration from MongoDB to Oracle AJD without application changes
2. Showcase various migration tools and techniques
3. Highlight added value through AI and analytics capabilities
4. Provide reusable demonstrations for educational purposes

## Target Audience
- Database administrators
- Developers working with NoSQL databases
- IT decision makers evaluating database migration options
- Teams interested in integrating AI with database workloads

## Solution Requirements

### Solution 1: Simple App Migration Demonstration

#### Overview
Demonstrate a working MERN Ecommerce application, migrate its MongoDB data to Oracle 23ai Autonomous JSON Database (AJD), reconnect the application to Oracle, and verify functionality remains intact.

#### Requirements

1. **Environment Setup**
   - Configure MERN Ecommerce application in a container
   - Set up MongoDB instance in a container 
   - Set up Oracle 23ai Autonomous JSON Database (AJD) in OCI
   - Configure network connectivity between all components

2. **Baseline Demonstration**
   - Document and demonstrate original application functionality:
     - Browse store categories, products, and brands
     - Merchant management of brand components
     - Admin control panel functionality
   - Capture application performance metrics for comparison

3. **Data Migration**
   - Use MongoDB tools (mongodump) to export data:
     ```bash
     mongodump --host=<mongo-host> --port=<mongo-port> --db=ecommerce --out=/path/to/backup
     ```
   - Transfer exported data to Oracle environment
   - Use Oracle `dbms_migrator` tool to import data into AJD:
     ```sql
     BEGIN
       dbms_migrator.import_mongodb_collection(
         p_directory => 'DATA_PUMP_DIR',
         p_file_name => 'users.json',
         p_collection_name => 'users'
       );
     END;
     ```
    Perhaps this exporting / importing will be done automatically by a shell script, pre-configured with the most widely-used tools (like `mongodump`) to achieve this process seamlessly for the user.

4. **Application Reconfiguration**
   - Update application connection string to use Oracle 23ai AJD
   - Use MongoDB compatibility API syntax
   - No code changes beyond connection configuration

5. **Verification**
   - Demonstrate application with Oracle backend
   - Verify all three main flows still work:
     - Customer browsing and purchasing
     - Merchant management
     - Admin controls
   - Document and compare performance metrics

6. **Documentation**
   - Create step-by-step guide for the migration process
   - Document any gotchas or special considerations

### Solution 2: Complex App Migration

#### Overview
Demonstrate migration of the more complex aspects of the MERN Ecommerce application, focusing on advanced MongoDB features that are supported by Oracle 23ai AJD.

#### Requirements

1. **Feature Identification**
   - Identify complex MongoDB features used by the application:
     - Aggregation pipelines
     - Geospatial queries
     - Text search capabilities
     - Complex indexes

2. **Migration Approach**
   - Use mongo2ora Java-based migration tool for complex schema migration:
     ```bash
     java -jar mongo2ora.jar \
       --source-uri mongodb://<mongo-host>:<mongo-port>/ecommerce \
       --target-uri oracle://<oracle-host>:<oracle-port>/ecommerce \
       --collections users,products,orders,reviews \
       --transform-config transform-rules.json
     ```

3. **Index Migration**
   - Identify and recreate MongoDB indexes in Oracle AJD:
     ```sql
     -- Example for creating indexes on JSON fields
     CREATE INDEX idx_product_name ON products_collection json_value(data, '$.name' RETURNING VARCHAR2(100));
     CREATE INDEX idx_product_price ON products_collection json_value(data, '$.price' RETURNING NUMBER);
     ```

4. **Performance Tuning**
   - Identify query patterns in the application
   - Create appropriate JSON search indexes for common query patterns
   - Configure Oracle AJD performance parameters

5. **Verification**
   - Load test the application with significant data volume
   - Compare performance between MongoDB and Oracle implementations
   - Ensure all application features work correctly

### Solution 3: Bringing Analytics and AI to JSON Documents

#### Overview
Enhance the migrated application with analytics and AI capabilities not present in the original MongoDB implementation, showcasing the added value of Oracle's platform.

#### Requirements

1. **Analytics with Excel**
   - Create Oracle Database connection from Excel
   - Define SQL queries to extract meaningful business insights:
     ```sql
     -- Example: Sales trends by category
     SELECT json_value(p.data, '$.category') as category,
            json_value(o.data, '$.orderDate') as order_date,
            SUM(json_value(o.data, '$.totalPrice' RETURNING NUMBER)) as total_sales
     FROM orders_collection o, products_collection p
     WHERE json_value(o.data, '$.productId') = json_value(p.data, '$.id')
     GROUP BY json_value(p.data, '$.category'), json_value(o.data, '$.orderDate')
     ORDER BY order_date;
     ```
   - Develop sample Excel reports with visualizations:
     - Sales by category
     - Product performance analysis
     - Customer segmentation

2. **Select AI Integration**
   - Configure and enable Oracle's Select AI feature
   - Create AI-powered queries for product reviews analysis:
     ```sql
     SELECT select_ai(
       'Summarize the sentiment of these product reviews',
       json_arrayagg(json_value(data, '$.reviewText') RETURNING VARCHAR2(4000))
     ) AS review_sentiment
     FROM reviews_collection
     WHERE json_value(data, '$.productId') = '12345';
     ```
   - Implement sample use cases:
     - Review sentiment analysis
     - Product recommendation engine
     - Customer feedback insights
     - Automatic categorization of products

3. **Vector Processing**
   - Add vector embeddings to product descriptions:
     ```sql
     -- Create vector column
     ALTER TABLE products_collection ADD (product_vector VECTOR(1536));
     
     -- Update with embeddings (using appropriate embedding function)
     UPDATE products_collection
     SET product_vector = text_embedding(json_value(data, '$.description'))
     WHERE json_value(data, '$.description') IS NOT NULL;
     
     -- Create vector index
     CREATE INDEX product_vector_idx ON products_collection
     USING VECTOR COSINE DISTANCE ON product_vector;
     ```
   - Implement semantic search functionality:
     ```sql
     -- Example: Find similar products
     SELECT json_value(data, '$.name') as product_name,
            json_value(data, '$.description') as description,
            vector_distance(product_vector, text_embedding('comfortable athletic shoes')) as similarity
     FROM products_collection
     ORDER BY similarity
     FETCH FIRST 5 ROWS ONLY;
     ```
   - Create demo showcasing:
     - Similar product recommendations
     - Content-based search
     - Image similarity (if product images available)

4. **Integration with Application**
   - Add new API endpoints to expose AI capabilities
   - Create simple UI components to showcase AI features
   - Implement a demonstration dashboard

## Technical Requirements

### Development Environment
- Python 3.9+ for migration scripts and utilities
- Java 17+ for mongo2ora tool
- Node.js 18+ for MERN application
- Docker/Podman for containerization
- Oracle Cloud Infrastructure (OCI) account

### Infrastructure Requirements
- MongoDB container (source)
- Oracle 23ai Autonomous JSON Database (target)
- OCI Object Storage for data transfer
- Network connectivity between all components

### Migration Tools
1. **dbms_migrator (Oracle built-in tool)**
   - Purpose: Direct migration of JSON collections
   - Usage: PL/SQL procedures to import MongoDB data

2. **MongoDB native tools**
   - Purpose: Data export and format conversion
   - Components: mongodump, mongoexport

3. **mongo2ora**
   - Purpose: Complex migrations with transformations
   - Language: Java
   - Features: Schema mapping, data transformation

### Testing Requirements
- Functional testing of all application workflows
- Performance comparison before and after migration
- Data integrity verification
- AI feature validation

## Implementation Plan

### Phase 1: Environment Setup (Days 1-2)
- Set up MERN Ecommerce application with MongoDB
- Provision Oracle 23ai AJD instance
- Configure migration tools
- Document baseline application functionality and performance

### Phase 2: Simple Migration (Day 3)
- Execute data migration using MongoDB tools and dbms_migrator 
- Reconfigure application for Oracle backend
- Verify functionality
- Document process and results

### Phase 3: Complex Migration (Day 4)
- Identify and migrate complex features
- Set up appropriate indexes and optimizations
- Test and verify application with complex workloads
- Document process and results

### Phase 4: AI and Analytics Enhancement (Day 5)
- Implement Excel analytics reports
- Configure Select AI integration
- Add vector processing capabilities
- Create demonstration UI for AI features
- Document process and results

### Phase 5: Documentation and Packaging (Day 6-7)
- Finalize all documentation
- Create demonstration script
- Package solution for reuse
- Record demonstration video

## Deliverables
1. Functional MERN Ecommerce application connected to Oracle AJD
2. Step-by-step migration guide with scripts
3. AI-enhanced analytics demonstration
4. Presentation materials for developer audiences
5. Recorded demonstration video

## Success Criteria
- Successful migration with no application code changes
- All application features working correctly with Oracle backend
- Demonstration of AI and analytics capabilities
- Comprehensive documentation for replication
- Completed within 1-week timeline

## Assumptions and Constraints
- MERN Ecommerce application is available and can be containerized
- Oracle 23ai AJD resources are provisioned and accessible
- Network connectivity exists between all components
- Oracle Select AI feature is available and properly licensed

## Risk Mitigation
| Risk | Impact | Mitigation |
|------|--------|------------|
| Application compatibility issues | High | Early testing of critical MongoDB features with Oracle compatibility layer |
| Performance degradation | Medium | Implement appropriate indexing and tuning |
| Data migration fidelity | High | Validate data before and after migration with automated tests |
| AI integration complexity | Medium | Start with simple use cases and progressively enhance |

## Appendix

### Reference Architecture
```
┌───────────────┐     ┌──────────────┐     ┌────────────────┐
│ MERN          │     │ Migration    │     │ Oracle 23ai    │
│ Ecommerce App │────▶│ Tools        │────▶│ Autonomous JSON│
│ (Source)      │     │              │     │ Database       │
└───────────────┘     └──────────────┘     └────────────────┘
                                                   │
                                                   ▼
                                           ┌────────────────┐
                                           │ AI & Analytics │
                                           │ Enhancement    │
                                           └────────────────┘
```

### Sample Migration Commands

```bash
# Export MongoDB data
mongodump --host=mongodb-container --port=27017 --db=ecommerce --out=/backup

# Import to Oracle using dbms_migrator
sqlplus admin/password@ajd_db
```

```sql
-- Create directory for imports
CREATE DIRECTORY data_import AS '/backup';

-- Import collections
BEGIN
  dbms_migrator.import_mongodb_collection(
    p_directory => 'data_import',
    p_file_name => 'users.bson',
    p_collection_name => 'users'
  );
END;
/
```

### Sample Select AI Queries

```sql
-- Get product improvement suggestions based on negative reviews
SELECT select_ai(
  'Suggest product improvements based on these negative reviews',
  json_arrayagg(json_value(data, '$.reviewText') RETURNING VARCHAR2(4000))
) AS improvement_suggestions
FROM reviews_collection
WHERE json_value(data, '$.rating' RETURNING NUMBER) < 3
AND json_value(data, '$.productId') = '12345';

-- Analyze customer sentiment trends
SELECT json_value(data, '$.productId') as product_id,
       select_ai(
         'Summarize the overall sentiment and key themes in these reviews',
         json_arrayagg(json_value(data, '$.reviewText') RETURNING VARCHAR2(4000))
       ) AS sentiment_analysis
FROM reviews_collection
GROUP BY json_value(data, '$.productId');
```

### Required Resources
- Oracle 23ai Autonomous JSON Database instance
- MongoDB source instance
- Docker/Podman environment
- OCI Object Storage bucket
- Development workstation with Python, Java, and Node.js