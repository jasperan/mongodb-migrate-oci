import os
import json
from pymongo import MongoClient

MONGO_URI = os.getenv('MONGO_URI', 'mongodb://localhost:27017/mern_ecommerce')
TARGET_DIR = os.getenv('TARGET_DIR', '.')
COLLECTIONS = ['addresses', 'brands', 'cartitems', 'carts', 'categories', 'contacts', 'merchants', 'orders', 'products', 'reviews', 'users', 'wishlists']

os.makedirs(TARGET_DIR, exist_ok=True)

print('--- MongoDB Export and Clear Collections ---')
try:
    client = MongoClient(MONGO_URI)
    db = client.get_default_database()
    if db is None:
        db = client['mern_ecommerce']
    for coll_name in COLLECTIONS:
        print(f'Processing: {coll_name}')
        if coll_name in db.list_collection_names():
            docs = list(db[coll_name].find())
            # Export to JSON
            out_path = os.path.join(TARGET_DIR, f'{coll_name}.json')
            with open(out_path, 'w', encoding='utf-8') as f:
                json.dump(docs, f, default=str, indent=2)
            # Delete all documents
            result = db[coll_name].delete_many({})
            print(f'  Exported {len(docs)} docs, deleted {result.deleted_count}')
        else:
            print('  (Collection does not exist)')
    client.close()
except Exception as e:
    print(f'Error: {e}') 