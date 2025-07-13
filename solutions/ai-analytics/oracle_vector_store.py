import oracledb
import array
from sentence_transformers import SentenceTransformer

class OracleVectorStore:
    def __init__(self, config):
        try:
            self.conn = oracledb.connect(
                user=config['ORACLE_DB_USERNAME'],
                password=config['ORACLE_DB_PASSWORD'],
                dsn=config['ORACLE_DB_DSN'],
                config_dir=config.get('WALLET_DIR', 'C:/oracle/instantclient')
            )
            self.cursor = self.conn.cursor()
            self.encoder = SentenceTransformer('all-MiniLM-L12-v2')
        except Exception as e:
            print(f"Failed to initialize OracleVectorStore: {e}")
            raise

    def __del__(self):
        """Cleanup connections when object is destroyed"""
        try:
            if hasattr(self, 'cursor') and self.cursor:
                self.cursor.close()
            if hasattr(self, 'conn') and self.conn:
                self.conn.close()
        except:
            pass

    def similarity_search(self, query, top_k=3):
        try:
            # Embed the query
            embedding = self.encoder.encode(query)
            vector = array.array("f", embedding)
            
            # Query JSON collection for similar reviews using vector distance
            sql = f"""
                SELECT data
                FROM ecommercedv.reviews
                WHERE JSON_EXISTS(data, '$.embedding')
                ORDER BY VECTOR_DISTANCE(JSON_VALUE(data, '$.embedding'), :nv, EUCLIDEAN)
                FETCH FIRST {top_k} ROWS ONLY
            """
            self.cursor.execute(sql, {"nv": vector})
            rows = self.cursor.fetchall()
            results = []
            for row in rows:
                # Extract the text content from the JSON document
                review_data = row[0]
                if hasattr(review_data, 'read'):  # Handle LOB objects
                    review_data = review_data.read()
                review_json = review_data.decode('utf-8') if isinstance(review_data, bytes) else str(review_data)
                results.append({"text": review_json, "metadata": "JSON collection"})
            return results
        except Exception as e:
            print(f"Error in similarity_search: {e}")
            raise 