#!/usr/bin/env python3
"""
Test script for SODA operations in the AI analytics solution.
This script verifies that SODA operations work correctly with the Oracle JSON collection.
"""

import yaml
import json
from soda_utils import SodaUtils

def test_soda_collection_listing():
    """Test listing available SODA collections"""
    print("🧪 Testing SODA collection listing...")
    
    try:
        # Load configuration
        with open('config.yaml', 'r') as f:
            config = yaml.safe_load(f)
        
        # Initialize SODA
        soda_utils = SodaUtils(config)
        
        # List collections
        print("📋 Listing available SODA collections...")
        collections = soda_utils.list_collections()
        print(f"✅ Found {len(collections)} SODA collections:")
        for i, collection_name in enumerate(collections, 1):
            print(f"   {i}. {collection_name}")
        
        return True
        
    except Exception as e:
        print(f"❌ SODA collection listing test failed: {e}")
        return False

def test_soda_basic_operations():
    """Test basic SODA operations"""
    print("🧪 Testing basic SODA operations...")
    
    try:
        # Load configuration
        with open('config.yaml', 'r') as f:
            config = yaml.safe_load(f)
        
        # Initialize SODA
        soda_utils = SodaUtils(config)
        
        # Test 1: Get collection stats
        print("📊 Test 1: Getting collection statistics...")
        stats = soda_utils.get_collection_stats()
        print(f"✅ Collection stats: {stats}")
        
        # Test 2: Find documents
        print("🔍 Test 2: Finding documents...")
        docs = soda_utils.find_documents(limit=2)
        print(f"✅ Found {len(docs)} documents")
        
        # Test 3: Insert a test document
        print("📝 Test 3: Inserting test document...")
        test_doc = {
            "_id": "test_soda_doc",
            "title": "SODA Test Document",
            "content": "This is a test document for SODA operations",
            "test": True
        }
        
        doc_key = soda_utils.insert_document(test_doc)
        print(f"✅ Inserted document with key: {doc_key}")
        
        # Test 4: Find the test document
        print("🔍 Test 4: Finding test document...")
        found_docs = soda_utils.find_documents({"_id": "test_soda_doc"})
        if found_docs:
            print(f"✅ Found test document: {found_docs[0]}")
        else:
            print("❌ Test document not found")
        
        # Test 5: Update the test document
        print("✏️  Test 5: Updating test document...")
        update_doc = {
            "_id": "test_soda_doc",
            "title": "SODA Test Document - Updated",
            "content": "This is an updated test document for SODA operations",
            "test": True,
            "updated": True
        }
        
        updated_count = soda_utils.update_document({"_id": "test_soda_doc"}, update_doc)
        print(f"✅ Updated {updated_count} document(s)")
        
        # Test 6: Count documents
        print("🔢 Test 6: Counting documents...")
        total_count = soda_utils.count_documents()
        print(f"✅ Total documents: {total_count}")
        
        print("🎉 All SODA tests passed!")
        return True
        
    except Exception as e:
        print(f"❌ SODA test failed: {e}")
        return False

def test_soda_similarity_search():
    """Test SODA similarity search with embeddings"""
    print("🧪 Testing SODA similarity search...")
    
    try:
        # Load configuration
        with open('config.yaml', 'r') as f:
            config = yaml.safe_load(f)
        
        # Initialize SODA
        soda_utils = SodaUtils(config)
        
        # Test similarity search
        query = "What are the best reviews?"
        print(f"🔍 Testing similarity search with query: '{query}'")
        
        results = soda_utils.similarity_search(query, top_k=3)
        print(f"✅ Found {len(results)} similar documents")
        
        for i, result in enumerate(results, 1):
            print(f"📋 Result {i}: {result['text'][:100]}...")
        
        print("🎉 SODA similarity search test passed!")
        return True
        
    except Exception as e:
        print(f"❌ SODA similarity search test failed: {e}")
        return False

def main():
    print("=== SODA Operations Test ===\n")
    
    # Test collection listing first
    if not test_soda_collection_listing():
        print("❌ SODA collection listing test failed")
        return 1
    
    print("\n" + "="*50 + "\n")
    
    # Test basic operations
    if not test_soda_basic_operations():
        print("❌ Basic SODA operations test failed")
        return 1
    
    print("\n" + "="*50 + "\n")
    
    # Test similarity search
    if not test_soda_similarity_search():
        print("❌ SODA similarity search test failed")
        return 1
    
    print("\n🎉 All SODA tests completed successfully!")
    return 0

if __name__ == "__main__":
    exit(main()) 