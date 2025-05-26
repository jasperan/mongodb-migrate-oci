import oracledb
import array
from sentence_transformers import SentenceTransformer

class OracleVectorStore:
    def __init__(self, config):
        self.conn = oracledb.connect(
            user=config['ORACLE_DB_USERNAME'],
            password=config['ORACLE_DB_PASSWORD'],
            dsn=config['ORACLE_DB_DSN']
        )
        self.cursor = self.conn.cursor()
        self.encoder = SentenceTransformer('all-MiniLM-L12-v2')

    def similarity_search(self, query, top_k=3):
        # Embed the query
        embedding = self.encoder.encode(query)
        vector = array.array("f", embedding)
        sql = f"""
            SELECT id, text, metadata
            FROM ecommercedv.ReviewCollection
            ORDER BY VECTOR_DISTANCE(embedding, :nv, EUCLIDEAN)
            FETCH FIRST {top_k} ROWS ONLY
        """
        self.cursor.execute(sql, {"nv": vector})
        rows = self.cursor.fetchall()
        results = []
        for row in rows:
            results.append({"text": row[1], "metadata": row[2]})
        return results 