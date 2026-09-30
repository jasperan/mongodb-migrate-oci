#!/usr/bin/env node
/**
 * Populate server-side embeddings for the migrated catalogue.
 *
 * Two modes:
 *   in-database (no API key needed, once an ONNX model is loaded in the schema)
 *     VECTOR_EMBEDDING_MODEL=ALL_MINILM_L12_V2 node scripts/embed_catalog.js
 *     -> one INSERT ... SELECT that embeds every product inside Oracle
 *
 *   remote (OpenAI-compatible embeddings endpoint)
 *     LLM_BASE_URL=... LLM_API_KEY=... LLM_EMBEDDING_MODEL=text-embedding-3-small \
 *       node scripts/embed_catalog.js
 *
 * Both modes write into <schema>.PRODUCT_EMBEDDINGS (see sql/26ai/08_ai_vector_store.sql).
 * Run from mern-ecommerce/server so the .env file is picked up.
 */
require('dotenv').config();
const { query, getPool, isConfigured, schema } = require('../services/oracle');
const llm = require('../services/llm');

const TABLE = process.env.VECTOR_TABLE || 'PRODUCT_EMBEDDINGS';
const IN_DB_MODEL = process.env.VECTOR_EMBEDDING_MODEL || '';
const BATCH = Number(process.env.EMBED_BATCH || 32);

const toLiteral = (vector) => `[${vector.map((value) => Number(value)).join(',')}]`;

const embedInDatabase = async () => {
  console.log(`Embedding products with in-database model ${IN_DB_MODEL} …`);
  const start = Date.now();
  // The embedded text carries the fields a shopper would actually reason about
  // (name, description, brand, category, price): the seeded descriptions are
  // filler text, so brand/category/price are what make semantic queries land.
  const document = `json_value(p.data, '$.name')
         || ' — ' || json_value(p.data, '$.description')
         || ' | brand: ' || nvl((select json_value(b.data, '$.name') from brands b
                                  where json_value(b.data, '$._id') = json_value(p.data, '$.brand')), 'unbranded')
         || ' | categories: ' || nvl((select listagg(json_value(c.data, '$.name'), ', ') within group (order by 1)
                                       from categories c
                                      where json_exists(c.data, '$.products[*]?(@ == $prod)'
                                                         passing json_value(p.data, '$._id') as "prod")), 'uncategorised')
         || ' | price: $' || json_value(p.data, '$.price' returning number)`;
  const insert = `insert into ${TABLE} (product_id, name, document, embedding)
       select json_value(p.data, '$._id'),
              json_value(p.data, '$.name'),
              ${document},
              vector_embedding(${IN_DB_MODEL} using ${document} as data)
         from products p`;
  // Two committed statements rather than one PL/SQL block: the helper returns rows
  // only for plain statements, and the pool rolls back uncommitted work on close.
  await query(`delete from ${TABLE}`, {}, { autoCommit: true });
  const rows = await query(insert, {}, { autoCommit: true });
  console.log(`done in ${Date.now() - start} ms`, rows.length ? `(${rows.length} rows)` : '');
};

const embedRemotely = async () => {
  if (!llm.config().embeddingModel) {
    throw new Error('Set LLM_EMBEDDING_MODEL (or VECTOR_EMBEDDING_MODEL for the in-database path).');
  }
  const products = await query(
    `select json_value(data, '$._id') as id,
            json_value(data, '$.name') as name,
            json_value(data, '$.description') as description
       from products`
  );
  console.log(`Embedding ${products.length} products with ${llm.config().embeddingModel} …`);

  let done = 0;
  for (let index = 0; index < products.length; index += BATCH) {
    const batch = products.slice(index, index + BATCH);
    const inputs = batch.map((row) => `${row.NAME}. ${row.DESCRIPTION || ''}`.trim());
    const { vectors } = await llm.embed(inputs);
    for (let i = 0; i < batch.length; i += 1) {
      await query(
        `merge into ${TABLE} t
           using (select :id as product_id, :name as name, :doc as document, vector(:vec) as embedding from dual) s
              on (t.product_id = s.product_id)
            when matched then update set t.name = s.name, t.document = s.document,
                                          t.embedding = s.embedding, t.embedded_at = systimestamp
            when not matched then insert (t.product_id, t.name, t.document, t.embedding)
                                  values (s.product_id, s.name, s.document, s.embedding)`,
        { id: batch[i].ID, name: batch[i].NAME, doc: inputs[i], vec: toLiteral(vectors[i]) }
      );
    }
    done += batch.length;
    console.log(`  ${done}/${products.length}`);
  }
};

(async () => {
  if (!isConfigured()) {
    console.error('Oracle SQL access is not configured (ORACLE_APP_USER / ORACLE_APP_PASSWORD / ORACLE_CONNECT_STRING).');
    process.exit(2);
  }
  try {
    if (IN_DB_MODEL) await embedInDatabase();
    else {
      if (!llm.isConfigured()) {
        console.error('No LLM provider configured. Set LLM_BASE_URL + LLM_API_KEY (remote) or VECTOR_EMBEDDING_MODEL (in-database).');
        process.exit(2);
      }
      await embedRemotely();
    }
    const [{ EMBEDDINGS }] = await query(`select count(*) as embeddings from ${TABLE}`);
    console.log(`schema ${schema.app}: ${EMBEDDINGS} embeddings in ${TABLE}`);
  } catch (error) {
    console.error(`FAILED: ${error.message}`);
    process.exit(1);
  } finally {
    // The connection pool keeps the event loop alive: without this the script
    // finishes its work and then hangs instead of exiting.
    const pool = await getPool().catch(() => null);
    await pool?.close(0).catch(() => {});
  }
})();
