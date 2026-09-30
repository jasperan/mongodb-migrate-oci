#!/bin/bash
# mernAppMongoToOracle.sh
# Migrate MERN app MongoDB data to Oracle DB using MERN app connection info

# Load environment variables from .env if present
if [ -f ../mern-ecommerce/server/.env ]; then
  export $(grep -v '^#' ../mern-ecommerce/server/.env | xargs)
fi

# Default connection info (can be overridden by .env)
MONGO_URI=${MONGO_URI:-mongodb://localhost:27017/mern_ecommerce}
MONGO_DB=$(echo $MONGO_URI | sed -E 's/.*\/([^?]+)(\?.*)?$/\1/')
MONGO_HOST=$(echo $MONGO_URI | sed -E 's/mongodb:\/\/([^\/]+)\/.*$/\1/')
MONGO_USER=${MONGO_USER:-}
MONGO_PASSWORD=${MONGO_PASSWORD:-}
ORACLE_USER=${ORACLE_USER:-your_oracle_user}
ORACLE_PASSWORD=${ORACLE_PASSWORD:-your_oracle_password}
ORACLE_CONNECT_STRING=${ORACLE_CONNECT_STRING:-your_oracle_connect_string}

# Dump and restore directories
DUMP_DIR=${DUMP_DIR:-./dump}

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

logInfo() { echo -e "${GREEN}[INFO]${NC} $1"; }
logWarn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
logError() { echo -e "${RED}[ERROR]${NC} $1"; }

# 1. Check if MERN app and MongoDB are running
check_services() {
  logInfo "Checking if MERN frontend is running on http://localhost:8080 ..."
  if curl -s http://localhost:8080 | grep -q '<!DOCTYPE html>'; then
    logInfo "MERN frontend is running."
  else
    logWarn "MERN frontend is NOT running."
  fi
  logInfo "Checking if MongoDB is running on port 27017 ..."
  if nc -z localhost 27017; then
    logInfo "MongoDB is running."
  else
    logWarn "MongoDB is NOT running."
  fi
}

# 2. List MongoDB collections
list_mongo_collections() {
  logInfo "Listing MongoDB collections in $MONGO_URI (database: $MONGO_DB) ..."
  mongo --quiet "$MONGO_URI" --eval 'db.getCollectionNames()'
}

# 3. List Oracle DB collections (tables)
list_oracle_collections() {
  logInfo "Listing Oracle DB tables for user $ORACLE_USER ..."
  echo "SELECT table_name FROM user_tables;" | sqlplus -s "$ORACLE_USER/$ORACLE_PASSWORD@$ORACLE_CONNECT_STRING"
}

# 4. Export MongoDB data
export_mongodb_data() {
  mkdir -p "$DUMP_DIR"
  
  # Ask for mongodump parameters
  read -p "Use mongodump.exe instead of mongodump? (y/N): " use_exe
  
  MONGODUMP_CMD="mongodump"
  if [ "$use_exe" = "y" ] || [ "$use_exe" = "Y" ]; then
    MONGODUMP_CMD="mongodump.exe"
  fi
  
  logInfo "Select export method:"
  echo "1) Export using URI"
  echo "2) Export using host, db, username, password"
  read -p "Choose an option [1-2]: " export_method
  
  case $export_method in
    1)
      logInfo "Exporting MongoDB data using $MONGODUMP_CMD with URI ..."
      cmd="$MONGODUMP_CMD --uri=\"$MONGO_URI\" --out=\"$DUMP_DIR\""
      ;;
    2)
      logInfo "Exporting using host, database, and credentials..."
      
      cmd="$MONGODUMP_CMD --host \"$MONGO_HOST\" --db \"$MONGO_DB\""
      
      # Ask for auth if not provided in env vars
      if [ -z "$MONGO_USER" ]; then
        read -p "MongoDB username (leave empty for no auth): " MONGO_USER
      fi
      
      if [ -n "$MONGO_USER" ]; then
        cmd="$cmd -u \"$MONGO_USER\""
        
        if [ -z "$MONGO_PASSWORD" ]; then
          read -s -p "MongoDB password: " MONGO_PASSWORD
          echo ""
        fi
        
        if [ -n "$MONGO_PASSWORD" ]; then
          cmd="$cmd -p \"$MONGO_PASSWORD\""
        fi
      fi
      
      cmd="$cmd --out=\"$DUMP_DIR\""
      ;;
    *)
      logWarn "Invalid choice, using URI method."
      cmd="$MONGODUMP_CMD --uri=\"$MONGO_URI\" --out=\"$DUMP_DIR\""
      ;;
  esac
  
  logInfo "Executing: $cmd"
  eval $cmd
  
  if [ $? -eq 0 ]; then
    logInfo "Export completed successfully to $DUMP_DIR"
  else
    logError "Export failed"
  fi
}

# 5. Restore MongoDB data
restore_mongodb_data() {
  if [ ! -d "$DUMP_DIR" ]; then
    logError "Dump directory $DUMP_DIR not found."
    return 1
  fi
  
  # List available dump subdirectories
  echo "Available database dumps:"
  ls -1 "$DUMP_DIR"
  
  read -p "Enter database name to restore: " restore_db
  
  if [ ! -d "$DUMP_DIR/$restore_db" ]; then
    logError "Database dump not found: $DUMP_DIR/$restore_db"
    return 1
  fi
  
  # Ask for mongorestore parameters
  read -p "Use mongorestore.exe instead of mongorestore? (y/N): " use_exe
  
  MONGORESTORE_CMD="mongorestore"
  if [ "$use_exe" = "y" ] || [ "$use_exe" = "Y" ]; then
    MONGORESTORE_CMD="mongorestore.exe"
  fi
  
  read -p "Target URI (default: $MONGO_URI): " target_uri
  target_uri=${target_uri:-$MONGO_URI}
  
  read -p "Drop existing collections before restore? (y/N): " should_drop
  
  drop_option=""
  if [ "$should_drop" = "y" ] || [ "$should_drop" = "Y" ]; then
    drop_option="--drop"
  fi
  
  read -p "Use write concern w:0? (y/N): " no_write_concern
  
  write_concern=""
  if [ "$no_write_concern" = "y" ] || [ "$no_write_concern" = "Y" ]; then
    write_concern="--writeConcern '{w:0}'"
  fi
  
  read -p "Use --tlsInsecure? (y/N): " use_tls_insecure
  
  tls_insecure=""
  if [ "$use_tls_insecure" = "y" ] || [ "$use_tls_insecure" = "Y" ]; then
    tls_insecure="--tlsInsecure"
  fi
  
  read -p "Namespace to include (e.g., merndemo): " ns_include
  
  ns_include_option=""
  if [ -n "$ns_include" ]; then
    ns_include_option="--nsInclude=$ns_include"
  fi
  
  cmd="$MONGORESTORE_CMD --uri=\"$target_uri\" $drop_option $write_concern $tls_insecure $ns_include_option \"$DUMP_DIR\""
  
  logInfo "Executing: $cmd"
  eval $cmd
  
  if [ $? -eq 0 ]; then
    logInfo "Restore completed successfully"
  else
    logError "Restore failed"
  fi
}

# 6. Perform migration (mongodump + import to Oracle)
migrate_mongo_to_oracle() {
  export_mongodb_data
  
  logInfo "You now need to import this data into Oracle."
  logInfo "This step requires a custom script or tool (Python, Node, or Oracle utilities) to parse BSON/JSON and insert into Oracle JSON collections."
  logWarn "Automated import to Oracle is not implemented in this script. Please use your preferred migration tool or script."
}

# Menu
echo -e "${GREEN}MERN App MongoDB to Oracle Migration Utility${NC}"
echo -e "MongoDB Database: ${YELLOW}$MONGO_DB${NC}"
echo -e "MongoDB Host: ${YELLOW}$MONGO_HOST${NC}"

while true; do
  echo -e "\nMenu:"
  echo "1) Check if MERN app and MongoDB are running"
  echo "2) List MongoDB collections"
  echo "3) List Oracle DB tables"
  echo "4) Export MongoDB data (mongodump)"
  echo "5) Restore MongoDB data (mongorestore)"
  echo "6) Perform migration (export + Oracle import helper)"
  echo "7) Exit"
  read -p "Choose an option [1-7]: " choice
  case $choice in
    1) check_services ;;
    2) list_mongo_collections ;;
    3) list_oracle_collections ;;
    4) export_mongodb_data ;;
    5) restore_mongodb_data ;;
    6) migrate_mongo_to_oracle ;;
    7) exit 0 ;;
    *) logWarn "Invalid choice." ;;
  esac
done 