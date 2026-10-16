-- Privileges MERN26 needs for in-database embeddings (ONNX model + AI Vector Search).
-- Run as ADMIN before loading the ONNX model (mern-ecommerce/server/scripts/load_onnx_embedding.py)
-- and before 08_ai_vector_store.sql. Re-runnable.

grant execute on dbms_vector to MERN26;
grant create mining model to MERN26;
