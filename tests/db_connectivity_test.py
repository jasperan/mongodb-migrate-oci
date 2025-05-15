import os
from pymongo import MongoClient
import oracledb
import socket

MONGO_URI = os.getenv('MONGO_URI', 'mongodb://localhost:27017/mern_ecommerce')
ORACLE_USER = os.getenv('ORACLE_USER', 'your_oracle_user')
ORACLE_PASSWORD = os.getenv('ORACLE_PASSWORD', 'your_oracle_password')
ORACLE_CONNECT_STRING = os.getenv('ORACLE_CONNECT_STRING', 'your_oracle_connect_string')

CHECK = '\u2705'  # ✅
CROSS = '\u274C'  # ❌

print('--- MongoDB Connectivity Test ---')
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
        db = client['mern_ecommerce']
    collections = db.list_collection_names()
    if not collections:
        print('No collections found in MongoDB.')
    else:
        print(f'Collections in MongoDB: {collections}')
        for coll in collections:
            count = db[coll].count_documents({})
            print(f'  - {coll}: {count} documents')
    client.close()
except Exception as e:
    print(f'Connection: {CROSS} Failed')
    print(f'Error connecting to MongoDB: {e}')

print('\n--- Oracle Container Port 1521 Check ---')
oracle_port_ok = False
try:
    sock = socket.create_connection(('localhost', 1521), timeout=2)
    print(f'Port 1521: {CHECK} Open')
    oracle_port_ok = True
    sock.close()
except Exception as e:
    print(f'Port 1521: {CROSS} Closed')
    print(f'Error: {e}')

print('\n--- OracleDB Connectivity Test ---')
oracle_ok = False
try:
    conn = oracledb.connect(user=ORACLE_USER, password=ORACLE_PASSWORD, dsn=ORACLE_CONNECT_STRING)
    print(f'Connection: {CHECK} Successful')
    oracle_ok = True
    cur = conn.cursor()
    cur.execute('SELECT table_name FROM user_tables')
    tables = [row[0] for row in cur.fetchall()]
    if not tables:
        print('No tables found in OracleDB.')
    else:
        print(f'Tables in OracleDB: {tables}')
        for table in tables:
            cur.execute(f'SELECT COUNT(*) FROM "{table}"')
            count = cur.fetchone()[0]
            print(f'  - {table}: {count} rows')
    cur.close()
    conn.close()
except Exception as e:
    print(f'Connection: {CROSS} Failed')
    print(f'Error connecting to OracleDB: {e}')

if mongo_ok and oracle_ok and oracle_port_ok:
    print(f'\n{CHECK} All DB connectivity tests passed.')
else:
    print(f'\n{CROSS} One or more DB connectivity tests failed.') 