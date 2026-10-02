-- In-database vector store for the migrated catalogue (Oracle AI Database 26ai).
-- Run as MERN26 (saved SQLcl connection: mig26-app) after the data import.
--
-- The table keeps one embedding per product together with the text that was
-- embedded, so similarity search never has to leave the database:
--   * in-database embeddings: VECTOR_EMBEDDING(<model> USING <text> AS DATA)
--     -- the demo loads all-MiniLM-L12-v2 into the schema with onnx2oracle
--        (server/scripts/load_onnx_embedding.py), which produces 384 dims
--   * remote embeddings: rows are filled by scripts/embed_catalog.js and the
--     query text is embedded by the same provider at search time
--     (text-embedding-3-small and friends produce 1536 dims)
-- Either way the ranking is computed by Oracle with VECTOR_DISTANCE.
--
-- Set the dimension to match the embedding model you configure:
--   define embedding_dim=384    -- ALL_MINILM_L12_V2 (in-database, default here)
--   define embedding_dim=1536   -- text-embedding-3-small (remote endpoint)

set echo on
set define on

-- keep a dimension the caller already defined; otherwise default to 384
set termout off
column embedding_dim new_value embedding_dim noprint
select null embedding_dim from dual where 1 = 0;
column embedding_dim_default new_value embedding_dim noprint
select nvl('&embedding_dim', '384') embedding_dim_default from dual;
set termout on

begin
  execute immediate 'create table product_embeddings (
                       product_id  varchar2(64) primary key,
                       name        varchar2(400),
                       document    clob,
                       embedding   vector(' || &embedding_dim || ', float32),
                       embedded_at timestamp default systimestamp)';
exception
  when others then
    if sqlcode != -955 then raise; end if;
end;
/

-- Approximate index for larger catalogues; harmless (and unused) for a few
-- hundred rows, where Oracle uses exact search anyway.
begin
  execute immediate 'create vector index product_embeddings_vec_idx
                       on product_embeddings (embedding)
                       organization inmemory neighbor graph
                       distance cosine with target accuracy 90';
exception
  when others then
    dbms_output.put_line('vector index not created: ' || substr(sqlerrm, 1, 200));
end;
/

select count(*) as embeddings from product_embeddings;

-- The similarity query the application issues (parameterised version lives in
-- server/services/vectorSearch.js) - "comfortable shoes for trails", embedded
-- in-database by the ONNX model:
select product_id,
       name,
       round(1 - vector_distance(embedding,
                 vector_embedding(ALL_MINILM_L12_V2 using 'comfortable shoes for trails' as data),
                 cosine), 4) as score
  from product_embeddings
 where embedding is not null
 order by vector_distance(embedding,
                 vector_embedding(ALL_MINILM_L12_V2 using 'comfortable shoes for trails' as data),
                 cosine)
 fetch first 5 rows only;
