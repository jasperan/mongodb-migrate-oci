# JSON Duality Views Demo: Cart Consistency

This demo showcases the power of JSON Duality Views in solving real-world data integrity problems using a relatable ecommerce cart scenario.

## Demo Overview

We'll demonstrate how JSON Duality Views solve the common problem of **orphaned references** in document databases by comparing:

1. **Traditional JSON Collections** - No referential integrity
2. **JSON Duality Views** - Automatic foreign key constraints

## Demo Structure

```mermaid
graph TD
    A[Demo 1: Problem Identification] --> B[Demo 2: Solution Implementation]
    B --> C[Demo 3: Data Integrity Verification]
    C --> D[Demo 4: Performance Comparison]
    D --> E[Demo 5: Application Integration]
    
    A1[Show orphaned cart items] --> A
    A2[Query invalid references] --> A
    B1[Create duality views] --> B
    B2[Import with constraints] --> B
    C1[Verify no orphaned refs] --> C
    C2[Test constraint enforcement] --> C
    D1[Compare query performance] --> D
    D2[Show SQL vs JSON access] --> D
    E1[Update application config] --> E
    E2[Test cart operations] --> E
```

## Demo 1: The Problem - Orphaned References

### Objective
Demonstrate how traditional JSON collections allow invalid references that can cause data integrity issues.

### Setup
```sql
-- Connect as ecommerce user (JSON native collections)
-- We have carts with product references that may not exist
```

### Step 1: Show the Problem
```sql
-- Query carts with potentially invalid product references
SELECT c.data._id as cart_id, 
       c.data.products[*].product as product_ref,
       c.data.products[*].quantity as quantity
FROM cart c 
WHERE JSON_EXISTS(c.data, '$.products[*]');

-- Expected output: Shows cart items with product references
-- Problem: We can't tell if these product references are valid
```

### Step 2: Identify Orphaned References
```sql
-- Find cart items that reference non-existent products
SELECT DISTINCT 
       JSON_VALUE(c.data, '$.products[*].product') as product_id,
       COUNT(*) as cart_count
FROM cart c,
     JSON_TABLE(c.data, '$.products[*]' COLUMNS(
       product_id VARCHAR2(100) PATH '$.product'
     )) p
WHERE p.product_id NOT IN (
  SELECT p2.data._id FROM products p2
)
GROUP BY JSON_VALUE(c.data, '$.products[*].product');

-- Expected output: Shows orphaned references (if any)
-- This query might return empty if data is clean, but demonstrates the risk
```

### Visual Representation

```mermaid
graph LR
    subgraph "Traditional JSON Collections"
        C1[Cart 1] --> P1[Product A]
        C1 --> P2[Product B]
        C2[Cart 2] --> P2
        C2 --> P3[Product C - DELETED!]
        C3[Cart 3] --> P1
        C3 --> P4[Product D - DELETED!]
    end
    
    subgraph "Products Collection"
        P1[Product A - EXISTS]
        P2[Product B - EXISTS]
        P3[Product C - DELETED]
        P4[Product D - DELETED]
    end
    
    style P3 fill:#ff9999
    style P4 fill:#ff9999
    style C2 fill:#ffcc99
    style C3 fill:#ffcc99
```

**Problem**: Cart items reference deleted products with no way to enforce referential integrity.

## Demo 2: The Solution - JSON Duality Views

### Objective
Show how JSON Duality Views automatically enforce referential integrity.

### Setup
```sql
-- Connect as ecommercedv user (JSON Duality Views)
-- Create enhanced duality views with foreign key relationships
```

### Step 1: Create Enhanced Duality Views
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
      isActive: isActive
    },
    quantity: quantity,
    purchasePrice: purchasePrice,
    totalPrice: totalPrice
  },
  updated: updated,
  created: created
};

-- Enhanced product view
CREATE OR REPLACE JSON DUALITY VIEW productV AS
product @insert @update @delete {
  _id: product_id,
  sku: sku,
  name: name,
  slug: slug,
  price: price,
  quantity: quantity,
  isActive: isActive,
  updated: updated,
  created: created
};
```

### Step 2: Import Data with Constraint Enforcement
```sql
-- Import with automatic consistency checking
BEGIN
  -- Import products first (referenced by carts)
  DBMS_JSON_DUALITY.IMPORT(
    table_owner_name => 'ECOMMERCE',
    table_name => 'products',
    view_owner_name => 'ECOMMERCEDV',
    view_name => 'products',
    err_log_name => 'products_ERR_LOG'
  );
  
  -- Import carts with foreign key validation
  DBMS_JSON_DUALITY.IMPORT(
    table_owner_name => 'ECOMMERCE',
    table_name => 'carts',
    view_owner_name => 'ECOMMERCEDV',
    view_name => 'carts',
    err_log_name => 'carts_ERR_LOG'
  );
END;
/
```

### Visual Representation

```mermaid
graph LR
    subgraph "JSON Duality Views"
        C1[Cart 1] --> P1[Product A]
        C1 --> P2[Product B]
        C2[Cart 2] --> P2
        C3[Cart 3] --> P1
    end
    
    subgraph "Products Collection"
        P1[Product A - EXISTS]
        P2[Product B - EXISTS]
    end
    
    subgraph "Foreign Key Constraints"
        FK1[Cart Items → Products]
        FK2[Automatic Validation]
    end
    
    C1 -.-> FK1
    FK1 -.-> FK2
    FK2 -.-> P1
    FK2 -.-> P2
    
    style FK1 fill:#99ff99
    style FK2 fill:#99ff99
```

**Solution**: Foreign key constraints automatically prevent invalid references.

## Demo 3: Data Integrity Verification

### Objective
Verify that JSON Duality Views maintain data consistency.

### Step 1: Check for Orphaned References
```sql
-- This query should return empty results with duality views
SELECT COUNT(*) as orphaned_cart_items
FROM cartV c, JSON_TABLE(c.data.products, '$[*]' COLUMNS(
  product_id VARCHAR2(100) PATH '$.product._id'
)) p
WHERE p.product_id NOT IN (
  SELECT pv.data._id FROM productV pv
);

-- Expected output: 0 (no orphaned references)
```

### Step 2: Test Constraint Enforcement
```sql
-- Try to add a cart item with non-existent product
-- This should fail with a foreign key constraint error
INSERT INTO cartV VALUES (
  '{"_id": "test_cart", "products": [{"product": "non_existent_product", "quantity": 1}]}'
);

-- Expected output: ORA-02291: integrity constraint violated
```

### Step 3: Show Error Logging
```sql
-- Check error logs for any import issues
SELECT * FROM carts_ERR_LOG;
SELECT * FROM products_ERR_LOG;

-- Expected output: Empty or shows specific constraint violations
```

### Visual Representation

```mermaid
flowchart TD
    A[Attempt to Insert Invalid Reference] --> B{Product Exists?}
    B -->|No| C[Foreign Key Constraint Error]
    B -->|Yes| D[Insert Succeeds]
    
    C --> E[Error Logged]
    D --> F[Data Integrity Maintained]
    
    E --> G[Review Error Logs]
    F --> H[Continue Processing]
    
    style C fill:#ff9999
    style F fill:#99ff99
```

## Demo 4: Performance Comparison

### Objective
Compare query performance between JSON native collections and JSON Duality Views.

### Step 1: JSON Native Collections Performance
```sql
-- Connect as ecommerce user
-- Query using JSON native collections
SELECT COUNT(*) as cart_count
FROM cart c 
WHERE JSON_EXISTS(c.data, '$.products[*] ? (@.product == "product_123")');

-- Expected: Slower performance due to JSON parsing
```

### Step 2: JSON Duality Views Performance
```sql
-- Connect as ecommercedv user
-- Query using JSON Duality Views
SELECT COUNT(*) as cart_count
FROM cartV c 
WHERE c.data.products[*].product._id = 'product_123';

-- Expected: Faster performance due to SQL optimization
```

### Step 3: Complex Query Comparison
```sql
-- JSON Native Collections: Complex aggregation
SELECT 
  JSON_VALUE(c.data, '$.user') as user_id,
  COUNT(*) as cart_count,
  SUM(JSON_VALUE(c.data, '$.products[*].quantity')) as total_items
FROM cart c
WHERE JSON_EXISTS(c.data, '$.products[*]')
GROUP BY JSON_VALUE(c.data, '$.user');

-- JSON Duality Views: SQL-native aggregation
SELECT 
  c.data.user as user_id,
  COUNT(*) as cart_count,
  SUM(p.quantity) as total_items
FROM cartV c,
     JSON_TABLE(c.data.products, '$[*]' COLUMNS(
       quantity NUMBER PATH '$.quantity'
     )) p
GROUP BY c.data.user;
```

### Visual Representation

```mermaid
graph LR
    subgraph "JSON Native Collections"
        A1[Complex JSON Parsing] --> A2[Slower Performance]
        A3[Custom Logic Required] --> A4[Limited Optimization]
    end
    
    subgraph "JSON Duality Views"
        B1[SQL Engine Optimization] --> B2[Faster Performance]
        B3[Standard SQL Queries] --> B4[Full Oracle Optimization]
    end
    
    A2 -.-> B2
    A4 -.-> B4
    
    style A2 fill:#ff9999
    style B2 fill:#99ff99
```

## Demo 5: Application Integration

### Objective
Show how applications can seamlessly use JSON Duality Views.

### Step 1: Update Application Configuration
```bash
# Update MERN application to use duality views
cd mern-ecommerce/server
```

Update `.env` file:
```bash
# Use ecommercedv user for JSON Duality Views
MONGO_URI=mongodb://ecommercedv:password@your-db-url:27017/ecommercedv?loadBalanced=true&retryWrites=false&authMechanism=PLAIN&authSource=$external&tls=true&tlsAllowInvalidCertificates=true
```

### Step 2: Test Cart Operations
```javascript
// Test adding items to cart
const addToCart = async (cartId, productId, quantity) => {
  try {
    // This will fail if product doesn't exist (constraint enforcement)
    await cartV.updateOne(
      { _id: cartId },
      { $push: { products: { product: productId, quantity } } }
    );
    console.log('✅ Item added successfully');
  } catch (error) {
    console.log('❌ Failed to add item:', error.message);
  }
};

// Test with valid product
await addToCart('cart_123', 'valid_product_id', 2);

// Test with invalid product
await addToCart('cart_123', 'non_existent_product', 1);
```

### Step 3: Verify Data Consistency
```javascript
// Query carts with automatic product information
const getCartWithProducts = async (cartId) => {
  const cart = await cartV.findOne({ _id: cartId });
  console.log('Cart with embedded product details:', cart);
  return cart;
};

// This automatically includes product details due to @unnest
const cart = await getCartWithProducts('cart_123');
```

### Visual Representation

```mermaid
sequenceDiagram
    participant App as Application
    participant DV as JSON Duality Views
    participant DB as Oracle Database
    
    App->>DV: Add item to cart
    DV->>DB: Check product exists
    alt Product exists
        DB->>DV: Allow insert
        DV->>App: Success
    else Product doesn't exist
        DB->>DV: Constraint violation
        DV->>App: Error
    end
    
    App->>DV: Query cart
    DV->>DB: Join with products
    DB->>DV: Return with product details
    DV->>App: Complete cart data
```

## Demo 6: Business Impact Demonstration

### Objective
Show the real business value of data consistency.

### Step 1: Revenue Protection
```sql
-- Calculate potential revenue loss from invalid cart items
SELECT 
  COUNT(*) as invalid_cart_items,
  SUM(p.quantity * p.purchasePrice) as potential_revenue_loss
FROM cartV c,
     JSON_TABLE(c.data.products, '$[*]' COLUMNS(
       quantity NUMBER PATH '$.quantity',
       purchasePrice NUMBER PATH '$.purchasePrice'
     )) p
WHERE p.product_id NOT IN (
  SELECT pv.data._id FROM productV pv WHERE pv.data.isActive = true
);

-- Expected: 0 with duality views (constraints prevent invalid refs)
```

### Step 2: Customer Experience
```sql
-- Show how customers get accurate product information
SELECT 
  c.data._id as cart_id,
  c.data.user as user_id,
  p.name as product_name,
  p.price as current_price,
  ci.purchasePrice as cart_price
FROM cartV c,
     JSON_TABLE(c.data.products, '$[*]' COLUMNS(
       product_id VARCHAR2(100) PATH '$.product._id',
       purchasePrice NUMBER PATH '$.purchasePrice'
     )) ci,
     productV p
WHERE ci.product_id = p.data._id
  AND p.data.isActive = true;

-- Shows accurate, up-to-date product information
```

### Visual Representation

```mermaid
graph TD
    subgraph "Before: JSON Collections"
        A1[Orphaned Cart Items] --> A2[Revenue Loss]
        A3[Invalid Product Data] --> A4[Poor Customer Experience]
        A5[Manual Validation Required] --> A6[Development Overhead]
    end
    
    subgraph "After: JSON Duality Views"
        B1[Automatic Constraint Enforcement] --> B2[Revenue Protection]
        B3[Accurate Product Data] --> B4[Better Customer Experience]
        B5[Database-Level Validation] --> B6[Reduced Development Overhead]
    end
    
    A2 -.-> B2
    A4 -.-> B4
    A6 -.-> B6
    
    style A2 fill:#ff9999
    style A4 fill:#ff9999
    style A6 fill:#ff9999
    style B2 fill:#99ff99
    style B4 fill:#99ff99
    style B6 fill:#99ff99
```

## Demo Scripts

### Quick Demo Script
```bash
# Run all demos in sequence
./demo-1-problem.sh
./demo-2-solution.sh
./demo-3-verification.sh
./demo-4-performance.sh
./demo-5-integration.sh
./demo-6-business-impact.sh
```

### Individual Demo Scripts
Each demo has its own script with detailed comments and expected outputs.

## Key Takeaways

1. **Data Integrity**: JSON Duality Views provide automatic referential integrity
2. **Performance**: Leverage Oracle's SQL engine for optimized queries
3. **Developer Experience**: Familiar MongoDB-style operations with SQL power
4. **Business Value**: Prevent revenue loss and improve customer experience
5. **Migration Path**: Seamless transition from JSON collections to duality views

## Next Steps

1. Run through each demo in sequence
2. Experiment with different scenarios
3. Try the performance comparison with your own data
4. Integrate with your MERN application
5. Monitor error logs and constraint violations

This demo suite provides a comprehensive understanding of how JSON Duality Views solve real-world data integrity problems in ecommerce applications. 