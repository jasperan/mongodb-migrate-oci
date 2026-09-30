#!/bin/bash
# mongoContainerUtils.sh
# Utility to interact with the MongoDB container used by the MERN app
# Usage: ./mongoContainerUtils.sh [container_name]
# Example: ./mongoContainerUtils.sh exciting_rubin

MONGO_CONTAINER="${1:-mongodb}"
MONGO_DB="mern_ecommerce"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

logInfo() { echo -e "${GREEN}[INFO]${NC} $1"; }
logWarn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
logError() { echo -e "${RED}[ERROR]${NC} $1"; }

list_databases() {
  logInfo "Listing all databases in container $MONGO_CONTAINER ..."
  podman exec -it $MONGO_CONTAINER mongo --quiet --eval 'db.adminCommand( { listDatabases: 1 } )'
}

list_collections() {
  logInfo "Listing collections in database $MONGO_DB ..."
  podman exec -it $MONGO_CONTAINER mongo $MONGO_DB --quiet --eval 'db.getCollectionNames()'
}

show_collection_stats() {
  read -p "Enter collection name: " coll
  logInfo "Showing stats for collection $coll ..."
  podman exec -it $MONGO_CONTAINER mongo $MONGO_DB --quiet --eval "db.getCollection('$coll').stats()"
}

view_collection_data() {
  read -p "Enter collection name: " coll
  read -p "Enter limit (default 10): " limit
  limit=${limit:-10}
  logInfo "Viewing data from collection $coll (limit: $limit) ..."
  podman exec -it $MONGO_CONTAINER mongo $MONGO_DB --quiet --eval "db.getCollection('$coll').find().limit($limit).pretty()"
}

count_documents() {
  read -p "Enter collection name: " coll
  logInfo "Counting documents in collection $coll ..."
  podman exec -it $MONGO_CONTAINER mongo $MONGO_DB --quiet --eval "db.getCollection('$coll').countDocuments({})"
}

export_collection() {
  read -p "Enter collection name to export: " coll
  output_file="./exports/${coll}_$(date +%Y%m%d%H%M%S).json"
  mkdir -p ./exports
  logInfo "Exporting collection $coll to $output_file ..."
  
  # Use mongoexport to export the collection to JSON
  podman exec -it $MONGO_CONTAINER mongoexport --db=$MONGO_DB --collection=$coll --out=/tmp/export.json
  
  # Copy the exported file from container to host
  podman cp $MONGO_CONTAINER:/tmp/export.json $output_file
  
  if [ $? -eq 0 ]; then
    logInfo "Export completed: $output_file"
  else
    logError "Export failed"
  fi
}

import_collection() {
  # List available JSON files in exports directory
  echo "Available JSON files:"
  ls -1 ./exports/*.json 2>/dev/null || echo "No files available"
  
  read -p "Enter JSON file path to import: " json_file
  read -p "Enter target collection name: " coll
  
  if [ ! -f "$json_file" ]; then
    logError "File not found: $json_file"
    return 1
  fi
  
  logInfo "Importing $json_file to collection $coll ..."
  
  # Copy the file to container
  podman cp $json_file $MONGO_CONTAINER:/tmp/import.json
  
  # Use mongoimport to import the JSON file
  podman exec -it $MONGO_CONTAINER mongoimport --db=$MONGO_DB --collection=$coll --file=/tmp/import.json
  
  if [ $? -eq 0 ]; then
    logInfo "Import completed to collection: $coll"
  else
    logError "Import failed"
  fi
}

drop_collection() {
  read -p "Enter collection name to drop: " coll
  read -p "Are you sure you want to drop the collection '$coll'? (y/N): " confirm
  
  if [ "$confirm" = "y" ] || [ "$confirm" = "Y" ]; then
    logInfo "Dropping collection $coll ..."
    podman exec -it $MONGO_CONTAINER mongo $MONGO_DB --quiet --eval "db.getCollection('$coll').drop()"
  else
    logWarn "Operation canceled"
  fi
}

find_document() {
  read -p "Enter collection name: " coll
  read -p "Enter field name to search: " field
  read -p "Enter value to search for: " value
  
  # Check if value should be treated as a number or string
  if [[ $value =~ ^[0-9]+$ ]]; then
    query="{$field: $value}"
  else
    query="{$field: \"$value\"}"
  fi
  
  logInfo "Finding documents where $field matches $value..."
  podman exec -it $MONGO_CONTAINER mongo $MONGO_DB --quiet --eval "db.getCollection('$coll').find($query).pretty()"
}

create_sample_data() {
  read -p "Enter collection name to populate: " coll
  read -p "Number of sample documents to create (default 5): " num_docs
  num_docs=${num_docs:-5}
  
  case $coll in
    users)
      logInfo "Creating $num_docs sample users..."
      js_code="
        for(let i=0; i<$num_docs; i++) {
          db.users.insertOne({
            email: 'user'+i+'@example.com',
            firstName: 'Test',
            lastName: 'User'+i,
            password: 'password123',
            role: i % 5 == 0 ? 'ADMIN' : 'MEMBER',
            created: new Date(),
            updated: new Date()
          });
        }
        return 'Created $num_docs sample users';
      "
      ;;
    products)
      logInfo "Creating $num_docs sample products..."
      js_code="
        for(let i=0; i<$num_docs; i++) {
          db.products.insertOne({
            name: 'Product '+i,
            description: 'This is sample product '+i,
            price: Math.floor(Math.random() * 1000) + 10,
            quantity: Math.floor(Math.random() * 100),
            isActive: true,
            created: new Date(),
            updated: new Date()
          });
        }
        return 'Created $num_docs sample products';
      "
      ;;
    orders)
      logInfo "Creating $num_docs sample orders..."
      js_code="
        for(let i=0; i<$num_docs; i++) {
          db.orders.insertOne({
            user: ObjectId(),
            total: Math.floor(Math.random() * 5000) + 100,
            created: new Date(),
            products: [
              {
                product: ObjectId(),
                quantity: Math.floor(Math.random() * 5) + 1,
                price: Math.floor(Math.random() * 100) + 10
              }
            ],
            status: ['CREATED', 'PROCESSING', 'SHIPPED', 'DELIVERED'][Math.floor(Math.random() * 4)]
          });
        }
        return 'Created $num_docs sample orders';
      "
      ;;
    reviews)
      logInfo "Creating $num_docs sample reviews..."
      js_code="
        for(let i=0; i<$num_docs; i++) {
          db.reviews.insertOne({
            product: ObjectId(),
            user: ObjectId(),
            rating: Math.floor(Math.random() * 5) + 1,
            review: 'Sample review text for product '+i,
            approved: true,
            created: new Date()
          });
        }
        return 'Created $num_docs sample reviews';
      "
      ;;
    categories)
      logInfo "Creating sample categories..."
      js_code="
        const categories = ['Electronics', 'Clothing', 'Books', 'Home & Garden', 'Toys'];
        for(let i=0; i<categories.length; i++) {
          db.categories.insertOne({
            name: categories[i],
            description: 'Category for '+categories[i],
            isActive: true,
            created: new Date(),
            updated: new Date()
          });
        }
        return 'Created sample categories';
      "
      ;;
    brands)
      logInfo "Creating sample brands..."
      js_code="
        const brands = ['Apple', 'Samsung', 'Nike', 'Adidas', 'Sony'];
        for(let i=0; i<brands.length; i++) {
          db.brands.insertOne({
            name: brands[i],
            description: brands[i]+' products',
            isActive: true,
            created: new Date(),
            updated: new Date()
          });
        }
        return 'Created sample brands';
      "
      ;;
    *)
      logWarn "No template for collection '$coll'. Creating generic documents..."
      js_code="
        for(let i=0; i<$num_docs; i++) {
          db.getCollection('$coll').insertOne({
            name: 'Sample '+i,
            description: 'Sample document '+i,
            created: new Date()
          });
        }
        return 'Created $num_docs generic documents';
      "
      ;;
  esac
  
  podman exec -it $MONGO_CONTAINER mongo $MONGO_DB --quiet --eval "$js_code"
}

check_indexes() {
  read -p "Enter collection name: " coll
  logInfo "Listing indexes for collection $coll ..."
  podman exec -it $MONGO_CONTAINER mongo $MONGO_DB --quiet --eval "db.getCollection('$coll').getIndexes()"
}

execute_custom_query() {
  read -p "Enter collection name: " coll
  echo "Enter MongoDB query/command (e.g., db.collection.find({...}).limit(10)):"
  echo "Note: Collection will be replaced with your selection"
  read -p "> " query
  
  # Replace 'collection' in the query with the actual collection name
  query=$(echo "$query" | sed "s/collection/$coll/g")
  
  logInfo "Executing custom query: $query"
  podman exec -it $MONGO_CONTAINER mongo $MONGO_DB --quiet --eval "$query"
}

echo -e "${GREEN}MongoDB Container Utility${NC}"
echo -e "Using container: $MONGO_CONTAINER"
while true; do
  echo -e "\nMenu:"
  echo "1) List all databases"
  echo "2) List all collections in $MONGO_DB"
  echo "3) Show stats for a collection"
  echo "4) View collection data"
  echo "5) Count documents in a collection"
  echo "6) Export collection to JSON"
  echo "7) Import collection from JSON"
  echo "8) Drop collection"
  echo "9) Find document by field value"
  echo "10) Create sample data"
  echo "11) Check collection indexes"
  echo "12) Execute custom query"
  echo "0) Exit"
  read -p "Choose an option [0-12]: " choice
  case $choice in
    1) list_databases ;;
    2) list_collections ;;
    3) show_collection_stats ;;
    4) view_collection_data ;;
    5) count_documents ;;
    6) export_collection ;;
    7) import_collection ;;
    8) drop_collection ;;
    9) find_document ;;
    10) create_sample_data ;;
    11) check_indexes ;;
    12) execute_custom_query ;;
    0) exit 0 ;;
    *) logWarn "Invalid choice." ;;
  esac
done 