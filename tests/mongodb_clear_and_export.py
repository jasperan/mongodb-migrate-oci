"""
@author jasperan
Export every MERN collection of a MongoDB database to Extended JSON files and
then DELETE all documents from those collections.

The export uses bson.json_util (canonical Extended JSON), so ObjectId, dates and
Decimal128 survive and `mongoimport --jsonArray --file <collection>.json` can
restore them.

WARNING: this deletes all documents from the collections! There is no default
database: pass the URI explicitly and confirm with --yes.

Usage:
    python tests/mongodb_clear_and_export.py "mongodb://localhost:27017/mern_scratch" --target-dir backup --yes
"""

import argparse
import os
import sys

from bson import json_util
from pymongo import MongoClient

COLLECTIONS = ['addresses', 'brands', 'cartitems', 'carts', 'categories', 'contacts', 'merchants', 'orders', 'products', 'reviews', 'users', 'wishlists']


def export_and_clear(db, target_dir):
    existing = set(db.list_collection_names())
    # Export everything before the first delete: a failure leaves the data untouched.
    exported = {}
    for name in COLLECTIONS:
        if name not in existing:
            print(f'{name}: (collection does not exist)')
            continue
        docs = list(db[name].find())
        out_path = os.path.join(target_dir, f'{name}.json')
        with open(out_path, 'w', encoding='utf-8') as handle:
            handle.write(json_util.dumps(docs, indent=2))
        exported[name] = len(docs)
        print(f'{name}: exported {len(docs)} documents to {out_path}')

    for name, count in exported.items():
        deleted = db[name].delete_many({}).deleted_count
        print(f'{name}: deleted {deleted} documents')
        if deleted != count:
            raise RuntimeError(f'{name}: exported {count} documents but deleted {deleted}')


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('uri', help='MongoDB URI naming the database to export and clear')
    parser.add_argument('--target-dir', default='.', help='directory for the exported JSON files (default: current directory)')
    parser.add_argument('--yes', action='store_true', help='confirm that all documents will be deleted')
    args = parser.parse_args()

    client = MongoClient(args.uri, serverSelectionTimeoutMS=10000)
    try:
        db = client.get_default_database()
        if not args.yes:
            print(f'Refusing to clear database "{db.name}" without --yes.', file=sys.stderr)
            return 2
        os.makedirs(args.target_dir, exist_ok=True)
        export_and_clear(db, args.target_dir)
    except Exception as exc:
        print(f'Error: {type(exc).__name__}: {exc}', file=sys.stderr)
        return 1
    finally:
        client.close()
    return 0


if __name__ == '__main__':
    sys.exit(main())
