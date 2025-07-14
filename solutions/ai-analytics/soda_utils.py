import yaml
import oracledb
import json
from sentence_transformers import SentenceTransformer
import array

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
            
            # Create connection
            self.conn = oracledb.connect(
                user=config['ORACLE_DB_USERNAME'],
                password=config['ORACLE_DB_PASSWORD'],
                dsn=config['ORACLE_DB_DSN'],
                config_dir=config.get('WALLET_DIR', 'C:/oracle/instantclient')
            )
            
            # Get SODA database object
            self.soda_db = self.conn.getSodaDatabase()
            
            # Get or create the reviews collection
            try:
                self.collection = self.soda_db.openCollection("reviews")
                if not self.collection:
                    self.collection = self.soda_db.createCollection("reviews")
            except Exception:
                # Collection doesn't exist, create it
                self.collection = self.soda_db.createCollection("reviews")
            
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
        
        Args:
            document (dict): The document to insert
            
        Returns:
            str: The document key (ID) of the inserted document
        """
        try:
            print(f"🔧 Attempting to insert document: {document.get('_id', 'unknown')}")
            # Insert document using SODA
            result = self.collection.insertOne(document)
            print(f"🔧 Insert result: {result}")
            if result:
                print(f"🔧 Insert result key: {result.key}")
                return result.key
            else:
                raise Exception("Insert operation returned None")
        except Exception as e:
            print(f"❌ Error inserting document: {e}")
            raise
    
    def insert_many_documents(self, documents):
        """
        Insert multiple documents into the collection
        
        Args:
            documents (list): List of documents to insert
            
        Returns:
            int: Number of documents successfully inserted
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
            
            print(f"✅ Successfully inserted {inserted_count} documents")
            return inserted_count
            
        except Exception as e:
            print(f"❌ Error in insert_many_documents: {e}")
            raise
    
    def find_documents(self, filter_dict=None, limit=None):
        """
        Find documents in the collection using SODA query
        
        Args:
            filter_dict (dict): SODA filter criteria
            limit (int): Maximum number of documents to return
            
        Returns:
            list: List of document dictionaries
        """
        try:
            # Create SODA operation
            operation = self.collection.find()
            
            # Apply filter if provided
            if filter_dict:
                operation = operation.filter(filter_dict)
            
            # Apply limit if provided
            if limit:
                operation = operation.limit(limit)
            
            # Execute query
            cursor = operation.getCursor()
            documents = []
            
            for doc in cursor:
                documents.append(doc.getContent())
            
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
            # Create SODA operation
            operation = self.collection.find().filter(filter_dict)
            
            # Apply update
            result = operation.replaceOne(update_dict)
            
            # Commit the transaction
            self.conn.commit()
            
            return 1 if result else 0
            
        except Exception as e:
            print(f"❌ Error in update_document: {e}")
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
            # Find the document first
            documents = self.find_documents({"_id": document_id})
            
            if not documents:
                print(f"⚠️  Document with ID {document_id} not found")
                return False
            
            # Get the first (and should be only) document
            doc = documents[0]
            
            # Add embedding to the document
            doc["embedding"] = embedding
            
            # Update the document
            self.update_document({"_id": document_id}, doc)
            
            return True
            
        except Exception as e:
            print(f"❌ Error adding embedding to document {document_id}: {e}")
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
                    distance = sum((a - b) ** 2 for a, b in zip(embedding, doc_embedding)) ** 0.5
                    similarities.append((distance, doc))
            
            # Sort by similarity (lower distance = more similar)
            similarities.sort(key=lambda x: x[0])
            
            # Return top_k results
            results = []
            for _, doc in similarities[:top_k]:
                results.append({
                    "text": json.dumps(doc, ensure_ascii=False),
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