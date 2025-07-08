import argparse
import yaml
import oracledb
from sentence_transformers import SentenceTransformer
import array
import json
from decimal import Decimal
from datetime import datetime

"""
WARNING:
Only run if you need to sync the reviews from the ecommercedv.reviews
table to the ReviewCollection table in Oracle.

"""

REVIEW_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS ReviewCollection (
    id VARCHAR2(4000 BYTE) PRIMARY KEY,
    text VARCHAR2(4000 BYTE),
    metadata VARCHAR2(4000 BYTE),
    embedding VECTOR
)
"""

SOURCE_SCHEMA = 'ecommercedv'
SOURCE_TABLE = 'reviews'
DATA_COL = 'data'


def get_oracle_conn(config):
    return oracledb.connect(
        user=config['ORACLE_DB_USERNAME'],
        password=config['ORACLE_DB_PASSWORD'],
        dsn=config['ORACLE_DB_DSN']
    )

def ensure_review_table(cursor):
    cursor.execute(REVIEW_TABLE_SQL)

def normalize_id(val):
    if isinstance(val, bytes):
        return val.hex()
    return str(val)

def bytes_to_str(obj):
    if isinstance(obj, dict):
        return {k: bytes_to_str(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [bytes_to_str(v) for v in obj]
    elif isinstance(obj, bytes):
        return obj.hex()
    elif isinstance(obj, Decimal):
        return str(obj)
    elif isinstance(obj, datetime):
        return obj.isoformat()
    else:
        return obj

def ingest_reviews_from_oracle(config):
    conn = get_oracle_conn(config)
    cursor = conn.cursor()
    ensure_review_table(cursor)
    encoder = SentenceTransformer('all-MiniLM-L12-v2')

    # Extract all reviews as JSON from ecommercedv.reviews
    cursor.execute(f'SELECT {DATA_COL} FROM {SOURCE_SCHEMA}.{SOURCE_TABLE}')
    rows = cursor.fetchall()
    print(f"Found {len(rows)} reviews in {SOURCE_SCHEMA}.{SOURCE_TABLE}.")

    for (data_obj,) in rows:
        review = bytes_to_str(data_obj)
        review_id = normalize_id(review.get('id') or review.get('_id'))
        text = json.dumps(review, ensure_ascii=False)
        metadata = json.dumps({"source_table": f"{SOURCE_SCHEMA}.{SOURCE_TABLE}"})
        embedding = encoder.encode(text)
        vector = array.array("f", embedding)
        try:
            cursor.execute(
                "INSERT INTO ReviewCollection (id, text, metadata, embedding) VALUES (:1, :2, :3, :4)",
                (review_id, text, metadata, vector)
            )
        except oracledb.IntegrityError:
            continue  # skip duplicates
    conn.commit()
    print(f"Ingested {len(rows)} reviews into Oracle ReviewCollection.")
    cursor.close()
    conn.close()

def review_similarity_search(config, query, top_k=3):
    conn = get_oracle_conn(config)
    cursor = conn.cursor()
    encoder = SentenceTransformer('all-MiniLM-L12-v2')
    embedding = encoder.encode(query)
    vector = array.array("f", embedding)
    sql = f"""
        SELECT id, text, metadata
        FROM ReviewCollection
        ORDER BY VECTOR_DISTANCE(embedding, :nv, EUCLIDEAN)
        FETCH FIRST {top_k} ROWS ONLY
    """
    cursor.execute(sql, {"nv": vector})
    rows = cursor.fetchall()
    for row in rows:
        print(f"ID: {row[0]}\nText: {row[1]}\nMetadata: {row[2]}\n---")
    cursor.close()
    conn.close()

def display_reviews_from_oracle(config):
    """Display reviews from ecommercedv.reviews and ReviewCollection for comparison"""
    conn = get_oracle_conn(config)
    cursor = conn.cursor()
    
    # Get total count from ecommercedv.reviews
    cursor.execute(f'SELECT COUNT(*) FROM {SOURCE_SCHEMA}.{SOURCE_TABLE}')
    total_reviews = cursor.fetchone()[0]
    print(f"Total reviews in {SOURCE_SCHEMA}.{SOURCE_TABLE}: {total_reviews}")
    
    # Extract 1 review as JSON from ecommercedv.reviews
    cursor.execute(f'SELECT {DATA_COL} FROM {SOURCE_SCHEMA}.{SOURCE_TABLE} WHERE ROWNUM = 1')
    rows = cursor.fetchall()
    print(f"\nDisplaying 1 review from {SOURCE_SCHEMA}.{SOURCE_TABLE}:")
    print("=" * 80)
    
    for i, (data_obj,) in enumerate(rows, 1):
        review = bytes_to_str(data_obj)
        review_id = normalize_id(review.get('id') or review.get('_id'))
        print(f"\nReview #{i}")
        print(f"ID: {review_id}")
        print(f"Content: {json.dumps(review, ensure_ascii=False, indent=2)}")
        print("-" * 40)
    
    # Get total count from ReviewCollection
    cursor.execute('SELECT COUNT(*) FROM ecommercedv.ReviewCollection')
    total_review_collection = cursor.fetchone()[0]
    print(f"\nTotal reviews in ecommercedv.ReviewCollection: {total_review_collection}")
    
    # Extract 1 review from ReviewCollection
    cursor.execute('SELECT id, text, metadata FROM ecommercedv.ReviewCollection WHERE ROWNUM = 1')
    review_collection_rows = cursor.fetchall()
    print(f"\nDisplaying 1 review from ecommercedv.ReviewCollection:")
    print("=" * 80)
    
    if review_collection_rows:
        for i, (review_id, text, metadata) in enumerate(review_collection_rows, 1):
            print(f"\nReview #{i}")
            print(f"ID: {review_id}")
            print(f"Text: {text}")
            print(f"Metadata: {metadata}")
            print("-" * 40)
    else:
        print("No reviews found in ecommercedv.ReviewCollection table.")
    
    cursor.close()
    conn.close()

def main():
    parser = argparse.ArgumentParser(description="Extract reviews from ecommercedv.reviews (JSON) and insert into ReviewCollection with embeddings.")
    parser.add_argument('--ingest', action='store_true', help='Extract from ecommercedv.reviews and insert into ReviewCollection')
    parser.add_argument('--query', type=str, help='Query ReviewCollection for similar reviews')
    parser.add_argument('--display', action='store_true', help='Display reviews from ecommercedv.reviews without ingesting (default behavior)')
    args = parser.parse_args()

    with open('config.yaml', 'r') as f:
        config = yaml.safe_load(f)

    if args.ingest:
        ingest_reviews_from_oracle(config)
    elif args.query:
        review_similarity_search(config, args.query)
    else:
        # Default behavior: display reviews without ingesting
        display_reviews_from_oracle(config)

if __name__ == "__main__":
    main() 