# Complex App Migration with JSON Duality Views

## **📁 Demo Directory Structure**
```
mongodb-migrate-oci/solutions/complex-migration/demo/
├── README.md                    # Comprehensive demo guide with Mermaid diagrams
├── run-all-demos.sh            # Master script to run all demos
├── demo-1-problem.sh           # Shows orphaned references problem
├── demo-2-solution.sh          # Shows JSON Duality Views solution
├── demo-3-verification.sh      # Verifies data integrity
├── demo-4-performance.sh       # Compares performance
├── demo-5-integration.sh       # Shows application integration
└── demo-6-business-impact.sh   # Demonstrates business value
```

## Introduction

This solution demonstrates the migration of a MERN (MongoDB, Express, React, Node.js) application with complex MongoDB features to Oracle Database, with a special focus on **JSON Duality Views** and their unique benefits for data consistency and integrity.

We will explore three different ways to store and access data:
- **MongoDB Collection**: The original data in your MongoDB database
- **Oracle MongoDB API (JSON native collection)**: Collections compatible with MongoDB drivers and tools; these are non-relational collections
- **Oracle JSON Duality View**: An advanced Oracle feature that provides a relational/JSON dual view of your data, enabling powerful SQL analytics, integration, and **data consistency enforcement**

> **Key Insight**: While MongoDB API collections allow for MongoDB-style access, JSON Duality Views are the recommended way to leverage Oracle's full power for analytics, SQL, integration, and most importantly, **data consistency and referential integrity**.

## The Power of JSON Duality Views: Cart Consistency Example

### The Problem with Traditional JSON Collections

In a typical ecommerce application using MongoDB or JSON native collections, you might encounter this scenario:

```json
// Cart document with product references
{
  "_id": "cart_123",
  "user": "user_456",
  "products": [
    {
      "product": "product_789",  // Reference to product
      "quantity": 2,
      "purchasePrice": 29.99
    },
    {
      "product": "product_999",  // This product might not exist!
      "quantity": 1,
      "purchasePrice": 15.99
    }
  ]
}
```

**The Problem**: With traditional JSON collections, there's no way to enforce that `product_999` actually exists in the products collection. You could have:
- Orphaned cart items referencing non-existent products
- Inconsistent data across your application
- No way to easily query "show me all carts with invalid product references"
- Data integrity issues that are hard to detect and fix

### The JSON Duality View Solution

JSON Duality Views solve this problem by providing **relational integrity** while maintaining JSON document flexibility. Here's how:

#### 1. Relational Foundation with JSON Flexibility

```sql
-- Create JSON Duality Views with referential integrity
CREATE OR REPLACE JSON DUALITY VIEW cartV AS
cart @insert @update @delete {
  _id: cart_id,
  user: user_id,
  products: cart_items @insert @update @delete {
    _id: item_id,
    product: product @unnest {
      _id: product_id,
      name: name,
      price: price,
      quantity: quantity,
      isActive: isActive
    },
    quantity: quantity,
    purchasePrice: purchasePrice,
    totalPrice: totalPrice
  }
};
```

#### 2. Automatic Consistency Enforcement

With JSON Duality Views:
- **Foreign Key Constraints**: The `product` reference in cart items automatically enforces that the referenced product exists
- **Data Validation**: Invalid product references are rejected at the database level
- **Cascade Operations**: When a product is deleted, related cart items can be automatically handled
- **ACID Transactions**: All operations maintain data consistency across related documents

#### 3. Real-World Benefits

**Before (JSON Collections)**:
```javascript
// No way to ensure product exists
const addToCart = async (cartId, productId, quantity) => {
  // Product might not exist, but we can't check easily
  await cartCollection.updateOne(
    { _id: cartId },
    { $push: { products: { product: productId, quantity } } }
  );
};
```

**After (JSON Duality Views)**:
```javascript
// Database enforces product existence automatically
const addToCart = async (cartId, productId, quantity) => {
  // If product doesn't exist, this will fail with a clear error
  await cartV.updateOne(
    { _id: cartId },
    { $push: { products: { product: productId, quantity } } }
  );
};
```

## Overview

The migration process involves:
1. Setting up the MERN ecommerce application
2. Identifying complex MongoDB features and data consistency requirements
3. Migrating data using JSON Duality Views for enhanced integrity
4. Demonstrating consistency benefits through practical examples
5. Optimizing performance while maintaining data integrity
6. Verifying the migration with consistency checks

## Prerequisites

- Docker or Podman to run containers
- Oracle AI Database 26ai
- Python 3.10+ (for Python migration utility) with Anaconda or `venv`
- `node.js` 18+ and `npm`
- A `mongodb` database running
- Oracle Autonomous AI Database 26ai, with the MongoDB API plugin enabled
- Database users: `ecommerce` (holds JSON native collections) and `ecommercedv` (owns JSON Duality Views)

This solution assumes you have previously completed the [simple migration process](../simple-migration/README.md) and have successfully imported all JSON native collections into your Autonomous database instance.

## Recap: From Simple to Complex Migration

In the [simple migration solution](../simple-migration/README.md), we successfully imported all MongoDB collections as native JSON data into the `ecommerce` schema using `mongorestore`. At this point, our data is available in JSON format and can be queried using dot notation or SQL/JSON functions.

However, we discovered limitations with JSON native collections:
- **No referential integrity**: Cart items can reference non-existent products
- **No data consistency enforcement**: Updates to products don't automatically reflect in carts
- **Limited integration**: BI tools and SQL-based systems struggle with pure JSON
- **Performance issues**: Complex queries require custom logic

## Why JSON Duality Views?

JSON Duality Views bridge the gap between document and relational models by providing:

### 1. **Data Consistency & Integrity**
- Foreign key constraints ensure referential integrity
- ACID transactions across multiple related documents
- Automatic consistency enforcement

### 2. **Flexible Data Access**
- Access data as JSON documents OR relational tables
- SQL queries with full power of Oracle's engine
- MongoDB aggregation pipeline compatibility

### 3. **Application Integration**
- Works with existing MongoDB drivers
- Compatible with BI tools expecting relational data
- REST API support out of the box

### 4. **Performance Optimization**
- Leverages Oracle's mature SQL engine
- Automatic indexing and query optimization
- Efficient storage with normalized data

## JSON Duality Views Creation & Migration

### Database User Structure

We use three database users for our migration:
- **`ADMIN`**: Sets up permissions and manages overall database configuration
- **`ecommerce`**: Holds the JSON native collections imported from MongoDB
- **`ecommercedv`**: Owns and manages the JSON Duality Views with enhanced integrity

### Step 1: Generate JSON Duality Views Schema

We'll use Oracle's `dbms_json_duality.infer_and_generate_schema` function to automatically create JSON Duality Views that enforce referential integrity:

```sql
-- Run as ecommercedv user
-- This generates JSON Duality Views with proper relationships
CREATE OR REPLACE PROCEDURE print_clob_to_output (
  p_clob IN CLOB
) IS
  l_offset INT := 1;
BEGIN
  LOOP
    EXIT WHEN l_offset > DBMS_LOB.GETLENGTH(p_clob);
    DBMS_OUTPUT.PUT_LINE(DBMS_LOB.SUBSTR(
      p_clob,
      255,
      l_offset
    ));
    l_offset := l_offset + 255;
  END LOOP;
END print_clob_to_output;
/

DECLARE
  schema_sql CLOB;
BEGIN
  FOR c IN (
    SELECT table_name
      FROM all_tables
     WHERE owner = 'ECOMMERCE' 
       AND table_name IN ('addresses', 'brands', 'carts', 'categories', 
                         'contacts', 'merchants', 'orders', 'products', 
                         'reviews', 'users', 'wishlists')
     ORDER BY 1
  ) LOOP
    BEGIN
      schema_sql := dbms_json_duality.infer_and_generate_schema(
        JSON(
          '{
            "sourceSchema": "ECOMMERCE",
            "tableNames": ["' || LOWER(c.table_name) || '"],
            "viewNames": ["' || LOWER(c.table_name) || '"],
            "useFlexFields": true,
            "updatability": true,
            "outputFormat": "standalone",
            "normalize": false,
            "enableUnnestedAttributes": false,
            "enableNestedAttributes": false,
            "hints": [{"type": "normalize", "table": "' || c.table_name || '", "path": "$", "value": false}]
          }'
        )
      );
      print_clob_to_output(schema_sql);
    EXCEPTION
      WHEN OTHERS THEN
        DBMS_OUTPUT.PUT_LINE('Error raised for ' || c.table_name || ': ' || 
                             DBMS_UTILITY.FORMAT_ERROR_BACKTRACE || ' - ' || SQLERRM);
    END;
  END LOOP;
EXCEPTION
  WHEN OTHERS THEN
    DBMS_OUTPUT.PUT_LINE('Error raised: ' || DBMS_UTILITY.FORMAT_ERROR_BACKTRACE || ' - ' || SQLERRM);
    RAISE;
END;
/
```

### Step 2: Create Enhanced JSON Duality Views with Relationships

After generating the basic schema, we'll enhance it to include proper relationships between collections:

```sql
-- Enhanced cart view with product relationship enforcement
CREATE OR REPLACE JSON DUALITY VIEW cartV AS
cart @insert @update @delete {
  _id: cart_id,
  user: user_id,
  products: cart_items @insert @update @delete {
    _id: item_id,
    product: product @unnest {
      _id: product_id,
      name: name,
      price: price,
      quantity: quantity,
      isActive: isActive,
      brand: brand @unnest {
        _id: brand_id,
        name: brand_name
      }
    },
    quantity: quantity,
    purchasePrice: purchasePrice,
    totalPrice: totalPrice,
    status: status
  },
  updated: updated,
  created: created
};

-- Enhanced product view with brand relationship
CREATE OR REPLACE JSON DUALITY VIEW productV AS
product @insert @update @delete {
  _id: product_id,
  sku: sku,
  name: name,
  slug: slug,
  imageUrl: imageUrl,
  description: description,
  quantity: quantity,
  price: price,
  taxable: taxable,
  isActive: isActive,
  brand: brand @unnest {
    _id: brand_id,
    name: brand_name
  },
  updated: updated,
  created: created
};
```

### Step 3: Import Data with Consistency Enforcement

Import data from JSON native collections to JSON Duality Views:

```sql
-- Import data with automatic consistency checking
BEGIN
  FOR c IN (
    SELECT table_name
      FROM all_tables
     WHERE owner = 'ECOMMERCE'
  ) LOOP
    BEGIN
      -- Create error log for tracking import issues
      DBMS_ERRLOG.CREATE_ERROR_LOG(
        dml_table_name => c.table_name,
        err_log_table_name => c.table_name || '_ERR_LOG',
        skip_unsupported => true
      );
    EXCEPTION
      WHEN OTHERS THEN
        NULL;
    END;
    
    BEGIN
      -- Import with consistency enforcement
      DBMS_JSON_DUALITY.IMPORT(
        table_owner_name => 'ECOMMERCE',
        table_name => c.table_name,
        view_owner_name => 'ECOMMERCEDV',
        view_name => LOWER(c.table_name),
        err_log_name => c.table_name || '_ERR_LOG'
      );
    EXCEPTION
      WHEN OTHERS THEN
        NULL;
    END;
  END LOOP;
END;
/
```

## Demonstrating Data Consistency Benefits

### Example 1: Invalid Product Reference Detection

**Scenario**: A cart contains a reference to a product that doesn't exist.

**With JSON Native Collections**:
```sql
-- This query might return empty results or inconsistent data
SELECT c.data.products[*].product 
FROM cart c 
WHERE c.data.products[*].product NOT IN (
  SELECT p.data._id FROM products p
);
```

**With JSON Duality Views**:
```sql
-- Foreign key constraints prevent invalid references
-- If a cart item references a non-existent product, the import will fail
-- and the error will be logged in the error log table
SELECT * FROM cart_ERR_LOG;
```

### Example 2: Automatic Data Consistency

**Scenario**: A product is updated (price change, availability, etc.)

**With JSON Native Collections**:
```javascript
// Manual update required across all related documents
const updateProduct = async (productId, updates) => {
  // Update product
  await productsCollection.updateOne({ _id: productId }, { $set: updates });
  
  // Manually update all carts containing this product
  const carts = await cartCollection.find({ 'products.product': productId });
  for (const cart of carts) {
    // Complex logic to update cart items
  }
};
```

**With JSON Duality Views**:
```javascript
// Single update automatically propagates to all related documents
const updateProduct = async (productId, updates) => {
  // Update product - changes automatically reflect in all carts
  await productV.updateOne(
    { _id: productId },
    { $set: updates }
  );
  // No manual cart updates needed!
};
```

### Example 3: Data Integrity Queries

**Find all carts with products that are no longer active**:
```sql
-- With JSON Duality Views - simple and efficient
SELECT c.data._id as cart_id, 
       c.data.products[*].product.name as product_name,
       c.data.products[*].product.isActive as product_active
FROM cartV c
WHERE c.data.products[*].product.isActive = false;
```

**Find all products that are referenced in carts but don't exist**:
```sql
-- This query will return empty results with JSON Duality Views
-- because foreign key constraints prevent orphaned references
SELECT DISTINCT p.data._id as product_id
FROM cartV c, JSON_TABLE(c.data.products, '$[*]' COLUMNS(
  product_id VARCHAR2(100) PATH '$.product._id'
)) p
WHERE p.product_id NOT IN (
  SELECT pv.data._id FROM productV pv
);
```

## MongoDB Aggregation Framework & Oracle Compatibility

MongoDB's Aggregation Framework is widely used for complex data transformations. Oracle's MongoDB API translates aggregation pipelines into SQL queries, but JSON Duality Views provide additional benefits:

### Supported Aggregation Operations
- `$match`, `$group`, `$sort`, `$lookup`
- `$project`, `$unwind`, `$limit`, `$skip`
- Most common operators work seamlessly

### Enhanced Capabilities with JSON Duality Views
```javascript
// MongoDB aggregation pipeline
const pipeline = [
  { $match: { "products.product.isActive": true } },
  { $unwind: "$products" },
  { $group: { _id: "$products.product.brand.name", total: { $sum: "$products.totalPrice" } } }
];

// This works with both MongoDB API and JSON Duality Views
// But JSON Duality Views provide better performance and consistency
```

### Custom SQL Integration
For unsupported aggregation operators, use Oracle's `$sql` operator:
```javascript
const pipeline = [
  { $sql: "SELECT brand_name, SUM(total_price) as total FROM cartV WHERE is_active = 1 GROUP BY brand_name" }
];
```

## Application Integration

### Step 4: Update MERN Application Configuration

Update the application to use JSON Duality Views:

```bash
# Edit the environment configuration
cd mern-ecommerce/server
```

Update `.env` file:
```bash
# Use ecommercedv user for JSON Duality Views
MONGO_URI=mongodb://ecommercedv:password@your-db-url:27017/ecommercedv?loadBalanced=true&retryWrites=false&authMechanism=PLAIN&authSource=$external&tls=true&tlsAllowInvalidCertificates=true
```

### Step 5: Start the Application

```bash
cd mern-ecommerce
npm run dev
```

The application now runs with enhanced data consistency and integrity!

## Verification and Testing

### 1. Data Consistency Tests
```sql
-- Verify no orphaned references
SELECT COUNT(*) as orphaned_cart_items
FROM cartV c, JSON_TABLE(c.data.products, '$[*]' COLUMNS(
  product_id VARCHAR2(100) PATH '$.product._id'
)) p
WHERE p.product_id NOT IN (SELECT pv.data._id FROM productV pv);

-- Should return 0
```

### 2. Performance Comparison
```sql
-- Compare query performance
-- JSON Native Collections
SELECT COUNT(*) FROM cart WHERE JSON_EXISTS(data, '$.products[*] ? (@.product == "product_123")');

-- JSON Duality Views
SELECT COUNT(*) FROM cartV c WHERE c.data.products[*].product._id = 'product_123';
```

### 3. Application Functionality Tests
- Add products to cart
- Update product information
- Verify cart consistency
- Test order processing
- Validate data integrity across operations

## Benefits Summary

### Data Integrity
- ✅ Foreign key constraints prevent orphaned references
- ✅ ACID transactions ensure data consistency
- ✅ Automatic validation of data relationships

### Performance
- ✅ Leverages Oracle's mature SQL engine
- ✅ Automatic query optimization
- ✅ Efficient storage with normalized data

### Developer Experience
- ✅ Familiar MongoDB-style operations
- ✅ Powerful SQL capabilities when needed
- ✅ REST API support
- ✅ Comprehensive error handling

### Application Integration
- ✅ Works with existing MongoDB drivers
- ✅ Compatible with BI tools
- ✅ Supports complex aggregation pipelines
- ✅ Maintains application compatibility

## Conclusion

JSON Duality Views represent a significant advancement in database technology, providing the best of both document and relational worlds. By migrating from traditional JSON collections to JSON Duality Views, you gain:

1. **Data Consistency**: Automatic enforcement of referential integrity
2. **Performance**: Leverage Oracle's mature SQL engine
3. **Flexibility**: Access data as JSON documents or relational tables
4. **Integration**: Seamless compatibility with existing tools and applications

The cart consistency example demonstrates how JSON Duality Views solve real-world data integrity problems that are common in document-based applications. By providing relational integrity while maintaining JSON flexibility, Oracle's JSON Duality Views enable robust, scalable applications that maintain data consistency without sacrificing developer productivity.

## Contributing

This project welcomes contributions from the community. Before submitting a pull request, please [review our contribution guide](./CONTRIBUTING.md).

## Security

Please consult the [security guide](./SECURITY.md) for our responsible security vulnerability disclosure process.

## License
Copyright (c) 2024 Oracle and/or its affiliates.

Licensed under the Universal Permissive License (UPL), Version 1.0.

See [LICENSE](LICENSE.txt) for more details.

ORACLE AND ITS AFFILIATES DO NOT PROVIDE ANY WARRANTY WHATSOEVER, EXPRESS OR IMPLIED, FOR ANY SOFTWARE, MATERIAL OR CONTENT OF ANY KIND CONTAINED OR PRODUCED WITHIN THIS REPOSITORY, AND IN PARTICULAR SPECIFICALLY DISCLAIM ANY AND ALL IMPLIED WARRANTIES OF TITLE, NON-INFRINGEMENT, MERCHANTABILITY, AND FITNESS FOR A PARTICULAR PURPOSE. FURTHERMORE, ORACLE AND ITS AFFILIATES DO NOT REPRESENT THAT ANY CUSTOMARY SECURITY REVIEW HAS BEEN PERFORMED WITH RESPECT TO ANY SOFTWARE, MATERIAL OR CONTENT CONTAINED OR PRODUCED WITHIN THIS REPOSITORY. IN ADDITION, AND WITHOUT LIMITING THE FOREGOING, THIRD PARTIES MAY HAVE POSTED SOFTWARE, MATERIAL OR CONTENT TO THIS REPOSITORY WITHOUT ANY REVIEW. USE AT YOUR OWN RISK.