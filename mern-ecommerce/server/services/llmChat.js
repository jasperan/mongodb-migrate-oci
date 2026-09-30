/**
 * RAG chat over the migrated catalogue.
 *
 * Retrieval runs inside Oracle AI Database:
 *   1. the question is embedded (in-database ONNX model, or the configured
 *      OpenAI-compatible embedding endpoint), then
 *   2. the closest catalogue documents are fetched with VECTOR_DISTANCE.
 * Generation runs on the configured OpenAI-compatible chat model.
 *
 * When embeddings are not available yet the service degrades to a keyword
 * retrieval over the same collections, and reports which path was used.
 */
const { query } = require('./oracle');
const llm = require('./llm');
const vectorSearch = require('./vectorSearch');

const SYSTEM_PROMPT = `You are the store assistant for a MERN ecommerce demo whose catalogue lives in Oracle AI Database 26ai.
Answer using ONLY the catalogue context provided. If the context does not contain the answer, say so plainly.
Keep answers short, factual and specific; mention product names and prices exactly as they appear.`;

const STOPWORDS = new Set(['which', 'what', 'does', 'cost', 'sell', 'your', 'have', 'with', 'that', 'this', 'from', 'they', 'them', 'show', 'list', 'many', 'much', 'about', 'into', 'there', 'where', 'when', 'tell']);

const keywordFallback = async (message) => {
  const terms = String(message)
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 3 && !STOPWORDS.has(word))
    .slice(0, 4);
  const needles = terms.length ? terms : [String(message).toLowerCase()];

  // One OR'd LIKE per term: a phrase match would miss documents that spread the
  // words across fields, which is the common case for a product question.
  const binds = {};
  const clauses = needles.map((term, index) => {
    binds[`t${index}`] = `%${term}%`;
    return `lower(json_serialize(data)) like :t${index}`;
  });

  const rows = await query(
    `select json_value(data, '$.name') as name,
            json_value(data, '$.description') as description,
            json_value(data, '$.price' returning number) as price,
            (select json_value(b.data, '$.name') from brands b
              where json_value(b.data, '$._id') = json_value(products.data, '$.brand')) as brand
       from products
      where ${clauses.join(' or ')}
      fetch first 5 rows only`,
    binds
  );
  return rows.map(toDocument);
};

// Both retrieval paths come back from SQL with the same four fields, so the
// document shape - and the context line built from it - lives in one place.
const toDocument = (row) => ({
  name: row.NAME,
  description: row.DESCRIPTION,
  price: row.PRICE,
  brand: row.BRAND
});

// Shoppers ask about brands and categories as often as about products, so both
// travel with the retrieved document when the database returned them.
const formatLine = (doc) =>
  `- ${doc.name} ($${doc.price})${doc.brand ? ` · ${doc.brand}` : ''}: ${doc.description}`;

const retrieve = async (message) => {
  try {
    const { results, source } = await vectorSearch.search(message, 5);
    // Join on product id, not name: the catalogue holds same-named products in
    // different departments, and a name join would silently drop them.
    const ids = results.map((row) => `'${String(row.id).replace(/'/g, "''")}'`).join(',');
    const rows = await query(
      `select json_value(data, '$.name') as name,
              json_value(data, '$.description') as description,
              json_value(data, '$.price' returning number) as price,
              (select json_value(b.data, '$.name') from brands b
                where json_value(b.data, '$._id') = json_value(products.data, '$.brand')) as brand,
              (select listagg(json_value(c.data, '$.name'), ', ') within group (order by 1)
                 from categories c
                where json_exists(c.data, '$.products[*]?(@ == $prod)' passing json_value(products.data, '$._id') as "prod")) as categories
         from products
        where json_value(data, '$._id') in (${ids})
        fetch first 5 rows only`
    );
    return { source, documents: rows.map(toDocument) };
  } catch (error) {
    // The keyword path covers exactly one boundary: no embedding store to search.
    // Any other error (a broken join, a driver failure) is a real failure and must
    // not be answered with a plausible-looking keyword result.
    if (error.status !== 503) throw error;
    return {
      source: `keyword-fallback (${error.message})`,
      documents: await keywordFallback(message)
    };
  }
};

const buildContext = (retrieval) => retrieval.documents.map(formatLine).join('\n');

const ragQuery = async (message) => {
  const retrieval = await retrieve(message);
  const context = buildContext(retrieval);

  if (!llm.isConfigured()) {
    return {
      answer: null,
      configured: false,
      retrieval: { source: retrieval.source, context },
      error: llm.status().hint
    };
  }

  const completion = await llm.chat({
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: `Catalogue context:\n${context || '(no matching documents)'}\n\nQuestion: ${message}` }
    ]
  });

  return {
    answer: completion.content,
    configured: true,
    model: completion.model,
    usage: completion.usage,
    retrieval: { source: retrieval.source, documents: retrieval.documents }
  };
};

module.exports = { ragQuery };
