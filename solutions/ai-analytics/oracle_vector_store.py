import oracledb
import array
from sentence_transformers import SentenceTransformer
from soda_utils import SodaUtils

class OracleVectorStore:
    def __init__(self, config):
        try:
            # Use SODA utilities for connection and operations
            self.soda_utils = SodaUtils(config)
            print("✅ OracleVectorStore initialized with SODA successfully!")
        except Exception as e:
            print(f"Failed to initialize OracleVectorStore: {e}")
            raise

    def __del__(self):
        """Cleanup connections when object is destroyed"""
        try:
            if hasattr(self, 'soda_utils') and self.soda_utils:
                del self.soda_utils
        except:
            pass

    def similarity_search(self, query, top_k=3):
        try:
            # Use SODA similarity search
            results = self.soda_utils.similarity_search(query, top_k)
            return results
        except Exception as e:
            print(f"Error in similarity_search: {e}")
            raise 