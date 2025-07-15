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
from soda_utils import SodaUtils

"""
WARNING:
This script now works with the native JSON collection 'reviews' using SODA.
It adds embeddings to existing review documents in the SODA collection.
"""

def test_soda_operations(config):
    """Test basic SODA operations to ensure connection is stable"""
    print("🧪 Testing basic SODA operations...")
    try:
        soda_utils = SodaUtils(config)
        
        # Test 1: Count documents
        print("🔍 Test 1: Count documents operation...")
        total_count = soda_utils.count_documents()
        print(f"✅ Count test passed. Found {total_count} reviews.")
        
        # Test 2: Find documents
        print("🔍 Test 2: Find documents operation...")
        sample_docs = soda_utils.find_documents(limit=1)
        if sample_docs:
            print("✅ Find documents test passed.")
        else:
            print("⚠️  No documents found for find test.")
        
        # Test 3: Collection stats
        print("🔍 Test 3: Collection stats operation...")
        stats = soda_utils.get_collection_stats()
        print(f"✅ Collection stats test passed. Stats: {stats}")
        
        print("🎉 All SODA operation tests passed!")
        return True
        
    except Exception as e:
        print(f"❌ SODA operation test failed: {e}")
        print(f"🔍 Error type: {type(e).__name__}")
        return False

def add_embeddings_to_reviews(config):
    print("🚀 Starting embedding addition process using SODA...")
    
    # First, test SODA operations
    if not test_soda_operations(config):
        print("❌ SODA operation tests failed. Aborting embedding addition.")
        return
    
    try:
        print("🔗 Initializing SODA connection...")
        soda_utils = SodaUtils(config)
        
        # Load reviews from generated_reviews.json
        print("📖 Loading reviews from generated_reviews.json...")
        with open('generated_reviews.json', 'r') as f:
            reviews_data = json.load(f)
        
        print(f"📊 Found {len(reviews_data)} reviews in generated_reviews.json")
        
        # Get existing documents in SODA collection to avoid duplicates
        print("🔍 Checking existing documents in SODA collection...")
        existing_docs = soda_utils.find_documents()
        existing_ids = {doc.get('_id') for doc in existing_docs}
        print(f"📋 Found {len(existing_ids)} existing documents in SODA collection")
        
        inserted_count = 0
        skipped_count = 0
        
        for i, review_data in enumerate(reviews_data, 1):
            try:
                print(f"🔄 Processing review {i}/{len(reviews_data)}...")
                
                # Parse the review text to get the review object
                review_text = review_data.get('text', '{}')
                review_obj = json.loads(review_text)
                
                review_id = review_obj.get('_id') or review_obj.get('id')
                print(f"📋 Review ID: {review_id}")
                
                # Check if review already exists
                if review_id in existing_ids:
                    print(f"⏭️  Review {review_id} already exists, skipping...")
                    skipped_count += 1
                    continue
                
                # Add embedding from the review data
                embedding = review_data.get('embedding')
                if not embedding:
                    print(f"⚠️  Review {review_id} has no embedding, skipping...")
                    skipped_count += 1
                    continue
                
                print(f"🧠 Adding embedding with {len(embedding)} dimensions to review {review_id}...")
                
                # Insert the review with embedding into SODA collection
                review_obj['embedding'] = embedding
                
                # Insert the document
                try:
                    print(f"🔧 Attempting to insert review {review_id}...")
                    insert_result = soda_utils.collection.insertOne(review_obj)
                    print(f"🔧 Insert result: {insert_result}")
                    # insertOne() returns None on success, so we check if it's not an exception
                    if insert_result is not None:
                        print(f"✅ Review {review_id} inserted successfully!")
                        inserted_count += 1
                    else:
                        print(f"✅ Review {review_id} inserted successfully! (insertOne returned None)")
                        inserted_count += 1
                    
                    # Commit the transaction to persist the changes
                    soda_utils.conn.commit()
                    print(f"💾 Transaction committed for review {review_id}")
                    
                except Exception as insert_error:
                    print(f"❌ Insert error for review {review_id}: {insert_error}")
                    print(f"🔍 Insert error type: {type(insert_error).__name__}")
                    soda_utils.conn.rollback()
                    skipped_count += 1
                    continue
                
            except Exception as e:
                print(f"❌ Error processing review {review_id}: {e}")
                print(f"🔍 Error type: {type(e).__name__}")
                skipped_count += 1
                continue
        
        print(f"🎉 Successfully inserted {inserted_count} reviews to SODA collection.")
        print(f"⏭️  Skipped {skipped_count} reviews (already exist or errors).")
        
        # Get final statistics
        stats = soda_utils.get_collection_stats()
        print(f"📈 Final collection stats: {stats}")
        
    except Exception as e:
        print(f"❌ Error in add_embeddings_to_reviews: {e}")
        print(f"🔍 Error type: {type(e).__name__}")
        raise

def convert_to_json_serializable(obj):
    """
    Recursively convert objects to JSON serializable format.
    Handles JsonId, Decimal, bytes, datetime, and other non-serializable types.
    """
    if obj is None:
        return None
    elif isinstance(obj, (str, int, bool, float)):
        return obj
    elif isinstance(obj, Decimal):
        return float(obj)
    elif isinstance(obj, bytes):
        return obj.hex()
    elif isinstance(obj, datetime):
        return obj.isoformat()
    elif hasattr(obj, '__class__') and 'JsonId' in str(type(obj)):
        return str(obj)
    elif isinstance(obj, dict):
        return {key: convert_to_json_serializable(value) for key, value in obj.items()}
    elif isinstance(obj, (list, tuple)):
        return [convert_to_json_serializable(item) for item in obj]
    else:
        # For any other type, convert to string
        return str(obj)

def review_similarity_search(config, query, top_k=3):
    print(f"🔍 Starting similarity search for query: '{query}' using SODA")
    try:
        print("🔗 Initializing SODA connection for similarity search...")
        soda_utils = SodaUtils(config)
        
        print("🔍 Executing similarity search...")
        results = soda_utils.similarity_search(query, top_k)
        print(f"📊 Found {len(results)} similar reviews")
        
        for i, result in enumerate(results, 1):
            print(f"📋 Review #{i}")
            print(f"📄 Content: {result['text']}")
            print("-" * 40)
        
    except Exception as e:
        print(f"❌ Error in review_similarity_search: {e}")
        print(f"🔍 Error type: {type(e).__name__}")
        raise

def display_reviews_from_soda_collection(config):
    """Display reviews from the SODA collection"""
    print("📋 Starting review display process using SODA...")
    try:
        print("🔗 Initializing SODA connection for review display...")
        soda_utils = SodaUtils(config)
        
        # Get collection statistics
        print("🔍 Getting collection statistics...")
        stats = soda_utils.get_collection_stats()
        print(f"📊 Collection stats: {stats}")
        
        # Get total number of documents
        total_docs = stats.get('total_documents', 0)
        print(f"📦 Total reviews in SODA collection: {total_docs}")
        
    except Exception as e:
        print(f"❌ Error in display_reviews_from_soda_collection: {e}")
        print(f"🔍 Error type: {type(e).__name__}")
        raise

def main():
    print("🎯 Starting review collection sync script using SODA...")
    parser = argparse.ArgumentParser(description="Add embeddings to reviews in the SODA collection.")
    parser.add_argument('--ingest', action='store_true', help='Add embeddings to reviews in SODA collection')
    parser.add_argument('--query', type=str, help='Query SODA collection for similar reviews')
    parser.add_argument('--display', action='store_true', help='Display reviews from SODA collection without ingesting (default behavior)')
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
            display_reviews_from_soda_collection(config)
        
        print("🎉 Script completed successfully!")
    except Exception as e:
        print(f"❌ Error: {e}")
        print(f"🔍 Error type: {type(e).__name__}")
        return 1

if __name__ == "__main__":
    main() 