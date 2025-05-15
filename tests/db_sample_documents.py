import os
from pymongo import MongoClient

MONGO_URI = os.getenv('MONGO_URI', 'mongodb://localhost:27017/mern_ecommerce')
COLLECTIONS = ['products', 'brands', 'users', 'categories']

print('--- MongoDB Sample Documents Test ---')
try:
    client = MongoClient(MONGO_URI)
    db = client.get_default_database()
    if db is None:
        db = client['mern_ecommerce']
    for coll_name in COLLECTIONS:
        print(f'\nCollection: {coll_name}')
        if coll_name in db.list_collection_names():
            doc = db[coll_name].find_one()
            if doc:
                print(doc)
            else:
                print('  (No documents found)')
        else:
            print('  (Collection does not exist)')
    client.close()
except Exception as e:
    print(f'Error connecting to MongoDB: {e}') 