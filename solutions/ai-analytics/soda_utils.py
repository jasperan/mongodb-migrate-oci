import yaml
import oracledb
import json
from sentence_transformers import SentenceTransformer
import array
from decimal import Decimal
from datetime import datetime

class SodaUtils:
    """
    Utility class for working with Oracle JSON collections using SODA (Simple Oracle Document Access).
    Provides NoSQL-style operations for document management.
    """
    
    def __init__(self, config):
        """Initialize SODA connection and get collection reference"""
        try:
            # Initialize Oracle client
            oracledb.init_oracle_client(lib_dir=config.get('WALLET_DIR', 'C:/oracle/instantclient'))
            
            # Use SODA-specific credentials if present, else fall back to generic
            user = config.get('SODA_DB_USERNAME', config['ORACLE_DB_USERNAME'])
            password = config.get('SODA_DB_PASSWORD', config['ORACLE_DB_PASSWORD'])
            dsn = config.get('SODA_DB_DSN', config['ORACLE_DB_DSN'])
            
            # Create connection
            self.conn = oracledb.connect(
                user=user,
                password=password,
                dsn=dsn,
                config_dir=config.get('WALLET_DIR', 'C:/oracle/instantclient')
            )
            
            # Get SODA database object
            self.soda_db = self.conn.getSodaDatabase()
            
            # Create or open the reviews collection as a pure JSON collection
            metadata = {
                "keyColumn": {
                    "name": "_id",
                    "sqlType": "BLOB"
                },
                "contentColumn": {
                    "name": "JSON_DOCUMENT",
                    "sqlType": "BLOB"
                },
                "lastModifiedColumn": {
                    "name": "LAST_MODIFIED"
                },
                "versionColumn": {
                    "name": "VERSION"
                }
            }
            
            try:
                # Try to open existing collection
                self.collection = self.soda_db.openCollection("reviews")
                if not self.collection:
                    # Create as pure JSON collection
                    self.collection = self.soda_db.createCollection("reviews", metadata)
            except Exception:
                # Collection doesn't exist, create it as pure JSON collection
                self.collection = self.soda_db.createCollection("reviews", metadata)
            
            # Initialize sentence transformer for embeddings
            self.encoder = SentenceTransformer('all-MiniLM-L12-v2')
            
            print("✅ SODA connection initialized successfully!")
            
        except Exception as e:
            print(f"❌ Failed to initialize SODA connection: {e}")
            raise
    
    def __del__(self):
        """Cleanup connections when object is destroyed"""
        try:
            if hasattr(self, 'conn') and self.conn:
                self.conn.close()
        except:
            pass

    def convert_to_json_serializable(self, obj):
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
            return {key: self.convert_to_json_serializable(value) for key, value in obj.items()}
        elif isinstance(obj, (list, tuple)):
            return [self.convert_to_json_serializable(item) for item in obj]
        else:
            # For any other type, convert to string
            return str(obj)

    def normalize_document_id(self, doc_id):
        """
        Normalize document ID to hex string for consistent SODA operations
        
        Args:
            doc_id: The document ID (bytes, JsonId, or string)
            
        Returns:
            str: Normalized hex string ID
        """
        if isinstance(doc_id, bytes):
            return doc_id.hex()
        elif hasattr(doc_id, '__class__') and 'JsonId' in str(type(doc_id)):
            # JsonId objects are bytes-like and have a .hex() method
            return doc_id.hex()
        else:
            return str(doc_id)

    def list_collections(self):
        """
        List all available SODA collections in the database
        
        Returns:
            list: List of collection names
        """
        try:
            collection_names = self.soda_db.getCollectionNames()
            return collection_names
        except Exception as e:
            print(f"❌ Error listing collections: {e}")
            raise
    
    def insert_document(self, document):
        """
        Insert a single document into the collection
        """
        try:
            print(f"🔧 Attempting to insert document: {document.get('_id', 'unknown')}")
            # Insert document using SODA
            result = self.collection.insertOne(document)
            if result:
                print(f"✅ Document inserted with key: {result.key}")
                return result.key
            else:
                print(f"✅ Document inserted (insertOne returned None)")
                return None
        except Exception as e:
            print(f"❌ Error inserting document: {e}")
            raise
    
    def insert_many_documents(self, documents):
        """
        Insert multiple documents into the collection
        """
        try:
            inserted_count = 0
            for doc in documents:
                try:
                    self.collection.insertOne(doc)
                    inserted_count += 1
                    # Commit after each insert to avoid long transactions
                    self.conn.commit()
                except Exception as e:
                    print(f"⚠️  Error inserting document {doc.get('_id', 'unknown')}: {e}")
                    self.conn.rollback()
                    continue
            print(f"✅ Successfully inserted {inserted_count} documents.")
            return inserted_count
        except Exception as e:
            print(f"❌ Error in insert_many_documents: {e}")
            raise
    
    def find_documents(self, filter_dict=None, limit=None):
        """
        Find documents in the collection using SODA query
        """
        try:
            operation = self.collection.find()
            if filter_dict:
                normalized_filter = {}
                for key, value in filter_dict.items():
                    if hasattr(value, '__class__') and 'JsonId' in str(type(value)):
                        normalized_filter[key] = str(value)
                    elif isinstance(value, bytes):
                        normalized_filter[key] = value.hex()
                    else:
                        normalized_filter[key] = value
                operation = operation.filter(normalized_filter)
            if limit:
                operation = operation.limit(limit)
            cursor = operation.getCursor()
            documents = [doc.getContent() for doc in cursor]
            print(f"📦 Retrieved {len(documents)} documents from SODA collection.")
            return documents
        except Exception as e:
            print(f"❌ Error in find_documents: {e}")
            raise
    
    def update_document(self, filter_dict, update_dict):
        """
        Update documents matching the filter criteria
        
        Args:
            filter_dict (dict): SODA filter criteria to match documents
            update_dict (dict): Fields to update in matching documents
            
        Returns:
            int: Number of documents updated
        """
        try:
            print(f"🔍 Updating document with filter: {filter_dict}")
            print(f"🔍 Update dict type: {type(update_dict)}")
            print(f"🔍 Update dict keys: {list(update_dict.keys()) if isinstance(update_dict, dict) else 'Not a dict'}")
            
            # For SODA replaceOne, we need to use the key attribute
            # First find the document to get its key
            documents = self.find_documents(filter_dict)
            if not documents:
                print(f"⚠️  No documents found with filter: {filter_dict}")
                return 0
            
            # Get the document key from the first matching document
            doc = documents[0]
            doc_key = doc.get('_id')
            if not doc_key:
                print(f"⚠️  Document has no _id field")
                return 0
            
            print(f"🔍 Using document key: {doc_key}")
            
            # Convert document to JSON serializable format to handle JsonId and other types
            safe_doc = self.convert_to_json_serializable(doc)
            
            # Ensure _id is normalized to hex string
            if '_id' in safe_doc:
                safe_doc['_id'] = self.normalize_document_id(safe_doc['_id'])
                print(f"🔍 Normalized safe_doc _id: {safe_doc['_id']}")
            
            # Add embedding to the document
            safe_doc["embedding"] = embedding
            print(f"🔍 Added embedding with {len(embedding)} dimensions")
            
            # Update the document using the original document key
            original_key = doc.get('_id')
            print(f"🔍 Updating document with key: {original_key}")
            
            # Try delete all and re-insert approach (workaround for JsonId filtering)
            try:
                # Delete all documents in the collection
                print(f"🔍 Deleting all documents in collection...")
                delete_result = self.collection.find().remove()
                print(f"🔍 Delete result: {delete_result}")
                
                # Insert the updated document with embedding
                print(f"🔍 Inserting updated document with embedding...")
                insert_result = self.collection.insertOne(safe_doc)
                print(f"🔍 Insert result: {insert_result}")
                
                result = True
            except Exception as e:
                print(f"🔍 Delete all and re-insert approach failed: {e}")
                raise e
            
            # Commit the transaction
            self.conn.commit()
            
            return 1 if result else 0
            
        except Exception as e:
            print(f"❌ Error in update_document: {e}")
            print(f"🔍 Error type: {type(e).__name__}")
            import traceback
            print(f"🔍 Full traceback: {traceback.format_exc()}")
            self.conn.rollback()
            raise
    
    def count_documents(self, filter_dict=None):
        """
        Count documents in the collection
        
        Args:
            filter_dict (dict): SODA filter criteria (optional)
            
        Returns:
            int: Number of documents
        """
        try:
            operation = self.collection.find()
            
            if filter_dict:
                operation = operation.filter(filter_dict)
            
            return operation.count()
            
        except Exception as e:
            print(f"❌ Error in count_documents: {e}")
            raise
    
    def add_embedding_to_document(self, document_id, embedding):
        """
        Add embedding to a specific document
        
        Args:
            document_id (str): The document ID to update
            embedding (list): The embedding vector to add
            
        Returns:
            bool: True if successful, False otherwise
        """
        try:
            # Normalize document_id to hex string
            filter_id = self.normalize_document_id(document_id)
            print(f"🔍 Normalized document_id: {document_id} -> {filter_id}")

            # Find the document using hex string
            documents = self.find_documents({"_id": filter_id})
            print(f"🔍 Found {len(documents)} documents with filter_id: {filter_id}")
            
            # If not found with hex string, try with original document_id
            if not documents and document_id != filter_id:
                print(f"🔍 Trying with original document_id: {document_id}")
                documents = self.find_documents({"_id": document_id})
                print(f"🔍 Found {len(documents)} documents with original document_id")
            
            # If still not found, try to find by content (fallback)
            if not documents:
                print(f"🔍 Trying to find document by content...")
                all_documents = self.find_documents()
                print(f"🔍 Total documents in collection: {len(all_documents)}")
                
                # Find the document that matches the original document_id
                for doc in all_documents:
                    doc_id = doc.get('_id')
                    if doc_id == document_id:
                        documents = [doc]
                        print(f"🔍 Found document by content matching")
                        break
                
                if not documents:
                    print(f"⚠️  Document with ID {filter_id} not found")
                    return False
            
            # Get the first (and should be only) document
            doc = documents[0]
            print(f"🔍 Document _id: {doc.get('_id')}")
            
            # Convert document to JSON serializable format to handle JsonId and other types
            safe_doc = self.convert_to_json_serializable(doc)
            
            # Ensure _id is normalized to hex string
            if '_id' in safe_doc:
                safe_doc['_id'] = self.normalize_document_id(safe_doc['_id'])
                print(f"🔍 Normalized safe_doc _id: {safe_doc['_id']}")
            
            # Add embedding to the document
            safe_doc["embedding"] = embedding
            print(f"🔍 Added embedding with {len(embedding)} dimensions")
            
            # Update the document using the original document key
            original_key = doc.get('_id')
            print(f"🔍 Updating document with key: {original_key}")
            
            # Use SODA replaceOne with key() method as required
            try:
                # Convert the JsonId to a string key for SODA
                if hasattr(original_key, '__class__') and 'JsonId' in str(type(original_key)):
                    key_string = original_key.hex()
                else:
                    key_string = str(original_key)
                
                print(f"🔍 Using key string for replaceOne: {key_string}")
                
                # Use replaceOne with key() method as required by SODA
                result = self.collection.find().key(key_string).replaceOne(safe_doc)
                print(f"🔍 ReplaceOne result: {result}")
                
            except Exception as e:
                print(f"🔍 ReplaceOne approach failed: {e}")
                raise e
            
            # Commit the transaction
            self.conn.commit()
            
            return True
            
        except Exception as e:
            print(f"❌ Error adding embedding to document {document_id}: {e}")
            print(f"🔍 Error type: {type(e).__name__}")
            import traceback
            print(f"🔍 Full traceback: {traceback.format_exc()}")
            return False
    
    def similarity_search(self, query, top_k=3):
        """
        Perform vector similarity search using SODA
        
        Args:
            query (str): The query text to search for
            top_k (int): Number of similar documents to return
            
        Returns:
            list: List of similar documents
        """
        try:
            # Create embedding for the query
            embedding = self.encoder.encode(query)
            print(f"🔍 Query embedding type: {type(embedding[0]) if embedding is not None and len(embedding) > 0 else 'None'}, length: {len(embedding) if embedding is not None and len(embedding) > 0 else 0}")
            
            # Find documents with embeddings
            documents = self.find_documents({"embedding": {"$exists": True}})
            
            if not documents:
                print("⚠️  No documents with embeddings found")
                return []
            
            # Calculate similarities and sort
            similarities = []
            for doc in documents:
                if "embedding" in doc:
                    # Calculate Euclidean distance
                    doc_embedding = doc["embedding"]
                    print(f"🔍 Document embedding type: {type(doc_embedding[0]) if doc_embedding is not None and len(doc_embedding) > 0 else 'None'}, length: {len(doc_embedding) if doc_embedding is not None and len(doc_embedding) > 0 else 0}")
                    # Convert any Oracle numeric types (decimal.Decimal, etc.) to float to avoid type mismatch
                    doc_embedding_float = []
                    for x in doc_embedding:
                        if hasattr(x, 'as_tuple'):  # decimal.Decimal
                            doc_embedding_float.append(float(x))
                        elif isinstance(x, (int, float)):
                            doc_embedding_float.append(float(x))
                        else:
                            # Fallback: try to convert to float, if it fails, skip this document
                            try:
                                doc_embedding_float.append(float(x))
                            except (ValueError, TypeError):
                                print(f"⚠️  Skipping document with invalid embedding value: {x} (type: {type(x)})")
                                continue
                    
                    # Skip this document if we couldn't convert all values
                    if len(doc_embedding_float) != len(doc_embedding):
                        continue
                    distance = sum((a - b) ** 2 for a, b in zip(embedding, doc_embedding_float)) ** 0.5
                    similarities.append((distance, doc))
            
            # Sort by similarity (lower distance = more similar)
            similarities.sort(key=lambda x: x[0])
            
            # Return top_k results
            results = []
            for _, doc in similarities[:top_k]:
                # Convert document to JSON serializable format before serializing
                doc_serializable = self.convert_to_json_serializable(doc)
                results.append({
                    "text": json.dumps(doc_serializable, ensure_ascii=False),
                    "metadata": "SODA collection"
                })
            
            return results
            
        except Exception as e:
            print(f"❌ Error in similarity_search: {e}")
            raise
    
    def get_collection_stats(self):
        """
        Get statistics about the collection
        
        Returns:
            dict: Collection statistics
        """
        try:
            total_docs = self.count_documents()
            docs_with_embeddings = self.count_documents({"embedding": {"$exists": True}})
            
            return {
                "total_documents": total_docs,
                "documents_with_embeddings": docs_with_embeddings,
                "documents_without_embeddings": total_docs - docs_with_embeddings
            }
            
        except Exception as e:
            print(f"❌ Error getting collection stats: {e}")
            raise 

    def list_all_documents(self):
        """
        List all documents in the collection for debugging
        
        Returns:
            list: List of all documents
        """
        try:
            documents = self.find_documents()
            print(f"🔍 Found {len(documents)} total documents in collection")
            for i, doc in enumerate(documents):
                doc_id = doc.get('_id')
                print(f"🔍 Document {i+1}: _id = {doc_id} (type: {type(doc_id)})")
            return documents
        except Exception as e:
            print(f"❌ Error listing documents: {e}")
            raise 