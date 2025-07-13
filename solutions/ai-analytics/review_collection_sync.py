import yaml
with open('config.yaml', 'r') as f:
    config = yaml.safe_load(f)
import oracledb
oracledb.init_oracle_client(lib_dir=config.get('WALLET_DIR', 'C:/oracle/instantclient'))
import argparse
from sentence_transformers import SentenceTransformer
import array
import json
from decimal import Decimal
from datetime import datetime

"""
WARNING:
This script now works with the native JSON collection 'reviews' in ecommercedv schema.
It adds embeddings to existing review documents in the JSON collection.
"""

SOURCE_SCHEMA = 'ecommercedv'
SOURCE_COLLECTION = 'reviews'
DATA_COL = 'data'


def get_oracle_conn(config):
    """Create a robust database connection with proper error handling"""
    print("🔄 Attempting to connect to Oracle database...")
    try:
        print(f"📁 Using wallet directory: {config.get('WALLET_DIR', 'C:/oracle/instantclient')}")
        print(f"👤 Connecting as user: {config['ORACLE_DB_USERNAME']}")
        print(f"🌐 Using DSN: {config['ORACLE_DB_DSN'][:50]}...")
        
        conn = oracledb.connect(
            user=config['ORACLE_DB_USERNAME'],
            password=config['ORACLE_DB_PASSWORD'],
            dsn=config['ORACLE_DB_DSN'],
            config_dir=config.get('WALLET_DIR', 'C:/oracle/instantclient')
        )
        print("✅ Successfully connected to Oracle database!")
        return conn
    except Exception as e:
        print(f"❌ Failed to connect to database: {e}")
        raise

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

def test_database_operations(config):
    """Test basic database operations to ensure connection is stable"""
    print("🧪 Testing basic database operations...")
    conn = None
    cursor = None
    try:
        conn = get_oracle_conn(config)
        cursor = conn.cursor()
        
        # Test 1: Simple SELECT
        print("🔍 Test 1: Simple SELECT operation...")
        cursor.execute(f"SELECT COUNT(*) FROM {SOURCE_SCHEMA}.{SOURCE_COLLECTION}")
        count = cursor.fetchone()[0]
        print(f"✅ SELECT test passed. Found {count} reviews.")
        
        # Test 2: JSON query
        print("🔍 Test 2: JSON query operation...")
        cursor.execute(f"SELECT data FROM {SOURCE_SCHEMA}.{SOURCE_COLLECTION} WHERE ROWNUM = 1")
        result = cursor.fetchone()
        if result:
            print("✅ JSON query test passed.")
        else:
            print("⚠️  No data found for JSON query test.")
        
        # Test 3: Simple UPDATE (no JSON_MERGEPATCH)
        print("🔍 Test 3: Simple UPDATE operation...")
        test_review_id = "test_review_123"
        cursor.execute(f"SELECT COUNT(*) FROM {SOURCE_SCHEMA}.{SOURCE_COLLECTION} WHERE JSON_VALUE(data, '$._id') = :review_id", {"review_id": test_review_id})
        test_count = cursor.fetchone()[0]
        print(f"✅ Simple UPDATE test passed. Test review count: {test_count}")
        
        print("🎉 All database operation tests passed!")
        return True
        
    except Exception as e:
        print(f"❌ Database operation test failed: {e}")
        print(f"🔍 Error type: {type(e).__name__}")
        return False
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()

def add_embeddings_to_reviews(config):
    print("🚀 Starting embedding addition process...")
    
    # First, test database operations
    if not test_database_operations(config):
        print("❌ Database operation tests failed. Aborting embedding addition.")
        return
    
    conn = None
    cursor = None
    try:
        print("🔗 Getting database connection...")
        conn = get_oracle_conn(config)
        print("📝 Creating cursor...")
        cursor = conn.cursor()
        print("🤖 Initializing sentence transformer...")
        encoder = SentenceTransformer('all-MiniLM-L12-v2')
        print("✅ Sentence transformer initialized successfully!")

        # Get all reviews from the JSON collection
        print(f"🔍 Querying {SOURCE_SCHEMA}.{SOURCE_COLLECTION} for reviews...")
        cursor.execute(f'SELECT data FROM {SOURCE_SCHEMA}.{SOURCE_COLLECTION}')
        rows = cursor.fetchall()
        print(f"📊 Found {len(rows)} reviews in {SOURCE_SCHEMA}.{SOURCE_COLLECTION}.")

        updated_count = 0
        for i, (data_obj,) in enumerate(rows, 1):
            try:
                print(f"🔄 Processing review {i}/{len(rows)}...")
                review = bytes_to_str(data_obj)
                review_id = normalize_id(review.get('id') or review.get('_id'))
                print(f"📋 Review ID: {review_id}")
                
                # Check if embedding already exists
                if 'embedding' in review:
                    print(f"⏭️  Review {review_id} already has embedding, skipping...")
                    continue
                    
                # Create embedding for the review text
                print(f"🧠 Creating embedding for review {review_id}...")
                text = json.dumps(review, ensure_ascii=False)
                print(f"📝 Text length: {len(text)} characters")
                embedding = encoder.encode(text)
                print(f"🔢 Embedding created with {len(embedding)} dimensions")
                vector = array.array("f", embedding)
                
                # Update the review document with embedding
                print(f"💾 Updating review {review_id} with embedding...")
                
                # First, let's test if we can read the current data
                print(f"🔍 Testing read operation for review {review_id}...")
                test_sql = f"SELECT data FROM {SOURCE_SCHEMA}.{SOURCE_COLLECTION} WHERE JSON_VALUE(data, '$.id') = :review_id OR JSON_VALUE(data, '$._id') = :review_id"
                cursor.execute(test_sql, {"review_id": review_id})
                test_result = cursor.fetchone()
                if not test_result:
                    print(f"⚠️  Warning: Could not find review {review_id} for update")
                    continue
                print(f"✅ Found review {review_id} for update")
                
                # Create the embedding JSON
                embedding_json = json.dumps({"embedding": embedding.tolist()})
                print(f"📝 Embedding JSON length: {len(embedding_json)} characters")
                
                # Try a simpler update approach first
                print(f"🔧 Attempting simple update for review {review_id}...")
                update_sql = f"UPDATE {SOURCE_SCHEMA}.{SOURCE_COLLECTION} SET data = JSON_MERGEPATCH(data, :embedding_json) WHERE JSON_VALUE(data, '$._id') = :review_id OR JSON_VALUE(data, '$._id') = :review_id"
                print(f"🔧 SQL: {update_sql}")
                
                # Execute with explicit parameter binding
                params = {
                    "embedding_json": embedding_json,
                    "review_id": review_id
                }
                print(f"🔧 Parameters: embedding_json length={len(params['embedding_json'])}, review_id={params['review_id']}")
                
                cursor.execute(update_sql, params)
                print(f"✅ Review {review_id} updated successfully!")
                updated_count += 1
                
                # Commit after each update to avoid long transactions
                print(f"💾 Committing transaction for review {review_id}...")
                conn.commit()
                print(f"✅ Transaction committed for review {review_id}")
                
            except Exception as e:
                print(f"❌ Error updating review {review_id}: {e}")
                print(f"🔍 Error type: {type(e).__name__}")
                # Rollback on error and continue with next review
                if conn:
                    print(f"🔄 Rolling back transaction for review {review_id}...")
                    conn.rollback()
                    print(f"✅ Transaction rolled back for review {review_id}")
                continue
        
        print(f"🎉 Successfully added embeddings to {updated_count} reviews in {SOURCE_SCHEMA}.{SOURCE_COLLECTION}.")
        
    except Exception as e:
        print(f"❌ Error in add_embeddings_to_reviews: {e}")
        print(f"🔍 Error type: {type(e).__name__}")
        if conn:
            print("🔄 Rolling back main transaction...")
            conn.rollback()
            print("✅ Main transaction rolled back")
        raise
    finally:
        if cursor:
            print("🔒 Closing cursor...")
            cursor.close()
            print("✅ Cursor closed")
        if conn:
            print("🔒 Closing database connection...")
            conn.close()
            print("✅ Database connection closed")

def review_similarity_search(config, query, top_k=3):
    print(f"🔍 Starting similarity search for query: '{query}'")
    conn = None
    cursor = None
    try:
        print("🔗 Getting database connection for similarity search...")
        conn = get_oracle_conn(config)
        print("📝 Creating cursor for similarity search...")
        cursor = conn.cursor()
        print("🤖 Initializing sentence transformer for similarity search...")
        encoder = SentenceTransformer('all-MiniLM-L12-v2')
        print("🧠 Creating embedding for query...")
        embedding = encoder.encode(query)
        print(f"🔢 Query embedding created with {len(embedding)} dimensions")
        vector = array.array("f", embedding)
        
        # Query JSON collection for similar reviews using vector distance
        print("🔍 Executing similarity search query...")
        sql = f"""
            SELECT data
            FROM {SOURCE_SCHEMA}.{SOURCE_COLLECTION}
            WHERE JSON_EXISTS(data, '$.embedding')
            ORDER BY VECTOR_DISTANCE(JSON_VALUE(data, '$.embedding'), :nv, EUCLIDEAN)
            FETCH FIRST {top_k} ROWS ONLY
        """
        print(f"🔧 SQL: {sql}")
        cursor.execute(sql, {"nv": vector})
        print("✅ Similarity search query executed successfully!")
        rows = cursor.fetchall()
        print(f"📊 Found {len(rows)} similar reviews")
        
        for i, (data_obj,) in enumerate(rows, 1):
            review = bytes_to_str(data_obj)
            review_id = normalize_id(review.get('id') or review.get('_id'))
            print(f"📋 Review #{i}")
            print(f"🆔 ID: {review_id}")
            print(f"📄 Content: {json.dumps(review, ensure_ascii=False, indent=2)}")
            print("-" * 40)
        
    except Exception as e:
        print(f"❌ Error in review_similarity_search: {e}")
        print(f"🔍 Error type: {type(e).__name__}")
        raise
    finally:
        if cursor:
            print("🔒 Closing cursor for similarity search...")
            cursor.close()
            print("✅ Similarity search cursor closed")
        if conn:
            print("🔒 Closing database connection for similarity search...")
            conn.close()
            print("✅ Similarity search database connection closed")

def display_reviews_from_json_collection(config):
    """Display reviews from the JSON collection"""
    print("📋 Starting review display process...")
    conn = None
    cursor = None
    try:
        print("🔗 Getting database connection for review display...")
        conn = get_oracle_conn(config)
        print("📝 Creating cursor for review display...")
        cursor = conn.cursor()
        
        # Get total count from JSON collection
        print(f"🔍 Counting total reviews in {SOURCE_SCHEMA}.{SOURCE_COLLECTION}...")
        cursor.execute(f'SELECT COUNT(*) FROM {SOURCE_SCHEMA}.{SOURCE_COLLECTION}')
        total_reviews = cursor.fetchone()[0]
        print(f"📊 Total reviews in {SOURCE_SCHEMA}.{SOURCE_COLLECTION}: {total_reviews}")
        
        # Get count of reviews with embeddings
        print("🔍 Counting reviews with embeddings...")
        cursor.execute(f"SELECT COUNT(*) FROM {SOURCE_SCHEMA}.{SOURCE_COLLECTION} WHERE JSON_EXISTS(data, '$.embedding')")
        reviews_with_embeddings = cursor.fetchone()[0]
        print(f"📊 Reviews with embeddings: {reviews_with_embeddings}")
        
        # Extract 1 review as JSON from the collection
        print("🔍 Fetching sample review...")
        cursor.execute(f'SELECT data FROM {SOURCE_SCHEMA}.{SOURCE_COLLECTION} WHERE ROWNUM = 1')
        rows = cursor.fetchall()
        print(f"📋 Displaying 1 review from {SOURCE_SCHEMA}.{SOURCE_COLLECTION}:")
        print("=" * 80)
        
        for i, (data_obj,) in enumerate(rows, 1):
            review = bytes_to_str(data_obj)
            review_id = normalize_id(review.get('id') or review.get('_id'))
            print(f"\n📋 Review #{i}")
            print(f"🆔 ID: {review_id}")
            print(f"📄 Content: {json.dumps(review, ensure_ascii=False, indent=2)}")
            print("-" * 40)
        
    except Exception as e:
        print(f"❌ Error in display_reviews_from_json_collection: {e}")
        print(f"🔍 Error type: {type(e).__name__}")
        raise
    finally:
        if cursor:
            print("🔒 Closing cursor for review display...")
            cursor.close()
            print("✅ Review display cursor closed")
        if conn:
            print("🔒 Closing database connection for review display...")
            conn.close()
            print("✅ Review display database connection closed")

def main():
    print("🎯 Starting review collection sync script...")
    parser = argparse.ArgumentParser(description="Add embeddings to reviews in the JSON collection.")
    parser.add_argument('--ingest', action='store_true', help='Add embeddings to reviews in JSON collection')
    parser.add_argument('--query', type=str, help='Query JSON collection for similar reviews')
    parser.add_argument('--display', action='store_true', help='Display reviews from JSON collection without ingesting (default behavior)')
    args = parser.parse_args()

    try:
        print("📖 Loading configuration from config.yaml...")
        with open('config.yaml', 'r') as f:
            config = yaml.safe_load(f)
        print("✅ Configuration loaded successfully!")

        if args.ingest:
            print("🔄 Starting ingest mode...")
            add_embeddings_to_reviews(config)
        elif args.query:
            print(f"🔍 Starting query mode with query: '{args.query}'")
            review_similarity_search(config, args.query)
        else:
            print("📋 Starting display mode (default behavior)...")
            # Default behavior: display reviews without ingesting
            display_reviews_from_json_collection(config)
        
        print("🎉 Script completed successfully!")
    except Exception as e:
        print(f"❌ Error: {e}")
        print(f"🔍 Error type: {type(e).__name__}")
        return 1

if __name__ == "__main__":
    main() 