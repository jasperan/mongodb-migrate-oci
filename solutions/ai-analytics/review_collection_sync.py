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
        
        # Get all reviews from the SODA collection
        print("🔍 Querying SODA collection for reviews...")
        documents = soda_utils.find_documents()
        print(f"📊 Found {len(documents)} reviews in SODA collection.")

        updated_count = 0
        for i, doc in enumerate(documents, 1):
            try:
                print(f"🔄 Processing review {i}/{len(documents)}...")
                review_id = doc.get('_id') or doc.get('id')
                print(f"📋 Review ID: {review_id}")
                
                # Check if embedding already exists
                if 'embedding' in doc:
                    print(f"⏭️  Review {review_id} already has embedding, skipping...")
                    continue
                    
                # Create embedding for the review text
                print(f"🧠 Creating embedding for review {review_id}...")
                text = json.dumps(doc, ensure_ascii=False)
                print(f"📝 Text length: {len(text)} characters")
                embedding = soda_utils.encoder.encode(text)
                print(f"🔢 Embedding created with {len(embedding)} dimensions")
                
                # Add embedding to the document using SODA
                print(f"💾 Adding embedding to review {review_id}...")
                success = soda_utils.add_embedding_to_document(review_id, embedding.tolist())
                
                if success:
                    print(f"✅ Review {review_id} updated successfully!")
                    updated_count += 1
                else:
                    print(f"⚠️  Failed to update review {review_id}")
                
            except Exception as e:
                print(f"❌ Error updating review {review_id}: {e}")
                print(f"🔍 Error type: {type(e).__name__}")
                continue
        
        print(f"🎉 Successfully added embeddings to {updated_count} reviews in SODA collection.")
        
        # Get final statistics
        stats = soda_utils.get_collection_stats()
        print(f"📈 Final collection stats: {stats}")
        
    except Exception as e:
        print(f"❌ Error in add_embeddings_to_reviews: {e}")
        print(f"🔍 Error type: {type(e).__name__}")
        raise

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
        
        # Get sample documents
        print("🔍 Fetching sample reviews...")
        sample_docs = soda_utils.find_documents(limit=3)
        print(f"📋 Displaying {len(sample_docs)} sample reviews from SODA collection:")
        print("=" * 80)
        
        for i, doc in enumerate(sample_docs, 1):
            review_id = doc.get('_id') or doc.get('id')
            print(f"\n📋 Review #{i}")
            print(f"🆔 ID: {review_id}")
            print(f"📄 Content: {json.dumps(doc, ensure_ascii=False, indent=2)}")
            print("-" * 40)
        
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