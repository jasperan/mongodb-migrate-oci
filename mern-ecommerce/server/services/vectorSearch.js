/**
 * Vector search over the migrated catalogue, executed inside Oracle AI Database.
 *
 * Two embedding paths are supported:
 *   1. in-database ONNX model (VECTOR_EMBEDDING_MODEL, e.g. ALL_MINILM_L12_V2):
 *      text -> embedding -> ranking all happen in one SQL statement.
 *   2. OpenAI-compatible embedding endpoint (LLM_EMBEDDING_MODEL): the query text
 *      is embedded remotely, the vectors live in a VECTOR column, and the ranking
 *      is still computed by Oracle with VECTOR_DISTANCE.
 */
const { query } = require('./oracle');
const llm = require('./llm');

const EMBEDDING_TABLE = process.env.VECTOR_TABLE || 'PRODUCT_EMBEDDINGS';
const EMBEDDING_MODEL = process.env.VECTOR_EMBEDDING_MODEL || '';
const EMBEDDING_DIM = Number(process.env.EMBEDDING_DIM || 1536);

const hasInDatabaseModel = () => Boolean(EMBEDDING_MODEL);

const toLiteral = (vector) => `[${vector.map((value) => Number(value)).join(',')}]`;

const mapRows = (rows) =>
  rows.map((row) => ({ id: row.PRODUCT_ID, name: row.NAME, score: row.SCORE }));

const searchInDatabase = async (text, topK, model) => {
  const sql = `
    select product_id,
           name,
           round(1 - vector_distance(embedding, vector_embedding(${model} using :text as data), cosine), 4) as score
      from ${EMBEDDING_TABLE}
     where embedding is not null
     order by vector_distance(embedding, vector_embedding(${model} using :text as data), cosine)
     fetch first :k rows only`;
  const rows = await query(sql, { text, k: topK });
  return { source: `in-database:${model}`, results: mapRows(rows) };
};

const searchRemote = async (text, topK) => {
  const { model, vectors } = await llm.embed(text);
  const rows = await query(
    `select product_id,
            name,
            round(1 - vector_distance(embedding, vector(:vec), cosine), 4) as score
       from ${EMBEDDING_TABLE}
      where embedding is not null
      order by vector_distance(embedding, vector(:vec), cosine)
      fetch first :k rows only`,
    { vec: toLiteral(vectors[0]), k: topK }
  );
  return { source: `remote:${model}`, results: mapRows(rows) };
};

const search = async (text, topK = 6) => {
  const limit = Number.isFinite(Number(topK)) ? Number(topK) : 6;
  const result = hasInDatabaseModel()
    ? await searchInDatabase(text, limit, EMBEDDING_MODEL)
    : await searchRemote(text, limit);

  if (!result.results.length) {
    const error = new Error(
      `No embeddings found in ${EMBEDDING_TABLE}. Run scripts/embed_catalog.js to populate them.`
    );
    error.status = 503;
    throw error;
  }

  return { ...result, dimension: EMBEDDING_DIM, model: EMBEDDING_MODEL || llm.config().embeddingModel || null };
};

module.exports = { search, EMBEDDING_TABLE, EMBEDDING_MODEL, EMBEDDING_DIM, hasInDatabaseModel };
