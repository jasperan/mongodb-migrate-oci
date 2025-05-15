import os
from pymongo import MongoClient
import oracledb
import socket
from urllib.parse import urlparse

MONGO_URI = os.getenv('MONGO_URI', 'mongodb://localhost:27017/mern_ecommerce')
ORACLE_USER = os.getenv('ORACLE_USER', 'your_oracle_user')
ORACLE_PASSWORD = os.getenv('ORACLE_PASSWORD', 'your_oracle_password')
ORACLE_CONNECT_STRING = os.getenv('ORACLE_CONNECT_STRING', 'your_oracle_connect_string')

CHECK = '\u2705'  # ✅
CROSS = '\u274C'  # ❌

# Parse MongoDB URI to extract database name
def get_mongo_db_name(uri):
    parsed = urlparse(uri)
    db_name = parsed.path.strip('/')
    if not db_name:
        return 'mern_ecommerce'  # Default if not specified
    return db_name

MONGO_DB_NAME = get_mongo_db_name(MONGO_URI)
print(f'--- MongoDB Connectivity Test ---')
print(f'MongoDB URI: {MONGO_URI}')
print(f'MongoDB Database: {MONGO_DB_NAME}')
mongo_ok = False
try:
    client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=3000)
    # Force connection on a request as the
    # connect=True parameter of MongoClient seems
    # to be useless here
    client.admin.command('ping')
    print(f'Connection: {CHECK} Successful')
    mongo_ok = True
    db = client.get_default_database()
    if db is None:
        db = client[MONGO_DB_NAME]
        print(f'Using explicit database: {MONGO_DB_NAME}')
    else:
        print(f'Using default database from URI: {db.name}')
    
    collections = db.list_collection_names()
    if not collections:
        print(f'No collections found in MongoDB database {db.name}.')
    else:
        print(f'Collections in MongoDB database {db.name}: {collections}')
        for coll in collections:
            count = db[coll].count_documents({})
            print(f'  - {coll}: {count} documents')
    client.close()
except Exception as e:
    print(f'Connection: {CROSS} Failed')
    print(f'Error connecting to MongoDB: {e}')

print('\n--- Oracle Container (localhost:1521/FREEPDB1) DB Connectivity Test ---')
oracle_container_ok = False
try:
    oracle_container_db = 'FREEPDB1'
    print(f'Oracle Container Database: {oracle_container_db}')
    conn = oracledb.connect(user='PDBADMIN', password=ORACLE_PASSWORD, dsn=f'localhost:1521/{oracle_container_db}')
    print(f'Connection: {CHECK} Successful')
    oracle_container_ok = True
    with conn.cursor() as cur:
        cur.execute("SELECT SYS_CONTEXT('USERENV', 'DB_NAME') FROM dual")
        db_name = cur.fetchone()[0]
        print(f'Connected to Oracle Database: {db_name}')
        
        cur.execute("SELECT 'Hello World!' FROM dual")
        res = cur.fetchall()
        print(f"Test query result: {res}")
        
        cur.execute("SELECT SYS_CONTEXT('USERENV', 'CURRENT_SCHEMA') FROM dual")
        schema = cur.fetchone()[0]
        print(f'Current schema: {schema}')
        
        cur.execute('SELECT table_name FROM user_tables')
        tables = [row[0] for row in cur.fetchall()]
        if not tables:
            print(f'No tables found in Oracle container DB schema {schema}.')
        else:
            print(f'Tables in Oracle container DB schema {schema}: {tables}')
    conn.close()
except Exception as e:
    print(f'Connection: {CROSS} Failed')
    print(f'Error connecting to Oracle container DB: {e}')

print('\n--- OracleDB (Configured DSN) Connectivity Test ---')
print(f'Oracle Connect String: {ORACLE_CONNECT_STRING}')
print(f'Oracle User: {ORACLE_USER}')
oracle_ok = False
try:
    conn = oracledb.connect(user=ORACLE_USER, password=ORACLE_PASSWORD, dsn=ORACLE_CONNECT_STRING)
    print(f'Connection: {CHECK} Successful')
    oracle_ok = True
    cur = conn.cursor()
    
    cur.execute("SELECT SYS_CONTEXT('USERENV', 'DB_NAME') FROM dual")
    db_name = cur.fetchone()[0]
    print(f'Connected to Oracle Database: {db_name}')
    
    cur.execute("SELECT SYS_CONTEXT('USERENV', 'CURRENT_SCHEMA') FROM dual")
    schema = cur.fetchone()[0]
    print(f'Current schema: {schema}')
    
    cur.execute('SELECT table_name FROM user_tables')
    tables = [row[0] for row in cur.fetchall()]
    if not tables:
        print(f'No tables found in OracleDB schema {schema}.')
    else:
        print(f'Tables in OracleDB schema {schema}: {tables}')
        for table in tables:
            cur.execute(f'SELECT COUNT(*) FROM "{table}"')
            count = cur.fetchone()[0]
            print(f'  - {table}: {count} rows')
    cur.close()
    conn.close()
except Exception as e:
    print(f'Connection: {CROSS} Failed')
    print(f'Error connecting to OracleDB: {e}')

if mongo_ok and oracle_ok and oracle_container_ok:
    print(f'\n{CHECK} All DB connectivity tests passed.')
else:
    print(f'\n{CROSS} One or more DB connectivity tests failed.') 