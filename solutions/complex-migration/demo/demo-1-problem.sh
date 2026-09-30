#!/bin/bash

# Demo 1: The Problem - Orphaned References
# This script demonstrates how traditional JSON collections allow invalid references

echo "🛒 Demo 1: The Problem - Orphaned References"
echo "=============================================="
echo ""

# Connect to Oracle as ecommerce user (JSON native collections)
echo "📊 Step 1: Connecting to Oracle as ecommerce user..."
echo "   Using JSON native collections (no referential integrity)"
echo ""

# Show the problem with cart items
echo "🔍 Step 2: Querying carts with potentially invalid product references..."
echo ""
echo "SQL Query:"
echo "SELECT c.data._id as cart_id,"
echo "       c.data.products[*].product as product_ref,"
echo "       c.data.products[*].quantity as quantity"
echo "FROM cart c"
echo "WHERE JSON_EXISTS(c.data, '\$.products[*]');"
echo ""

echo "Expected Output:"
echo "CART_ID    PRODUCT_REF    QUANTITY"
echo "--------   ------------   --------"
echo "cart_123   product_789    2"
echo "cart_123   product_999    1  ← This product might not exist!"
echo "cart_456   product_789    1"
echo ""

echo "❌ Problem: We can't tell if these product references are valid"
echo "   - No foreign key constraints"
echo "   - No automatic validation"
echo "   - Manual checking required"
echo ""

# Identify orphaned references
echo "🔍 Step 3: Identifying orphaned references..."
echo ""
echo "SQL Query:"
echo "SELECT DISTINCT"
echo "       JSON_VALUE(c.data, '\$.products[*].product') as product_id,"
echo "       COUNT(*) as cart_count"
echo "FROM cart c,"
echo "     JSON_TABLE(c.data, '\$.products[*]' COLUMNS("
echo "       product_id VARCHAR2(100) PATH '\$.product'"
echo "     )) p"
echo "WHERE p.product_id NOT IN ("
echo "  SELECT p2.data._id FROM products p2"
echo ")"
echo "GROUP BY JSON_VALUE(c.data, '\$.products[*].product');"
echo ""

echo "Expected Output:"
echo "PRODUCT_ID        CART_COUNT"
echo "------------      ----------"
echo "product_999       1          ← Orphaned reference!"
echo "product_888       2          ← Orphaned reference!"
echo ""

echo "⚠️  Issues Found:"
echo "   - Cart items reference non-existent products"
echo "   - No automatic cleanup when products are deleted"
echo "   - Data integrity compromised"
echo ""

echo "📈 Business Impact:"
echo "   - Revenue loss from invalid cart items"
echo "   - Poor customer experience"
echo "   - Manual data cleanup required"
echo "   - Development overhead for validation"
echo ""

echo "✅ Demo 1 Complete!"
echo "   Next: Run demo-2-solution.sh to see the solution"
echo "" 