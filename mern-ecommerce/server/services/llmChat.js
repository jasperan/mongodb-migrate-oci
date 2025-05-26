const axios = require('axios');
const oracledb = require('oracledb');
const Product = require('../models/product');
const Review = require('../models/review');

// Oracle connection utility
async function getOracleConnection() {
  return await oracledb.getConnection({
    user: process.env.ORACLE_USER,
    password: process.env.ORACLE_PASSWORD,
    connectString: process.env.ORACLE_CONNECT_STRING
  });
}

// Vector search using Oracle 23ai JSON DB
async function vectorSearch(query) {
  const conn = await getOracleConnection();
  // Example: search products and reviews by semantic similarity
  const sql = `
    SELECT 'product' as type, json_value(data, '$.name') as name, json_value(data, '$.description') as description, vector_distance(product_vector, text_embedding(:q)) as similarity
    FROM products_collection
    ORDER BY similarity
    FETCH FIRST 2 ROWS ONLY
    UNION ALL
    SELECT 'review' as type, NULL as name, json_value(data, '$.reviewText') as description, vector_distance(review_vector, text_embedding(:q)) as similarity
    FROM reviews_collection
    ORDER BY similarity
    FETCH FIRST 2 ROWS ONLY
  `;
  const result = await conn.execute(sql, { q: query });
  await conn.close();
  const products = [];
  const reviews = [];
  for (const row of result.rows) {
    if (row[0] === 'product') {
      products.push({ name: row[1], description: row[2] });
    } else if (row[0] === 'review') {
      reviews.push({ reviewText: row[2] });
    }
  }
  return { products, reviews };
}

// Call Ollama LLM API (OpenAPI-compatible)
async function callLlmApi({ message, context }) {
  const ollamaUrl = process.env.OLLAMA_API_URL;
  const payload = {
    messages: [
      { role: 'system', content: 'You are a helpful assistant for ecommerce.' },
      ...context.map((c) => ({ role: 'user', content: c })),
      { role: 'user', content: message }
    ]
  };
  const res = await axios.post(`${ollamaUrl}/v1/chat/completions`, payload);
  return res.data.choices[0].message.content;
}

// Call FastAPI RAG endpoint
async function ragQuery(message) {
  const fastapiUrl = process.env.RAG_API_URL || 'http://localhost:8000/rag';
  const payload = { question: message };
  const res = await axios.post(fastapiUrl, payload);
  return res.data.answer;
}

module.exports = { vectorSearch, callLlmApi, ragQuery }; 