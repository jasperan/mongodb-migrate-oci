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

// Helper: Euclidean distance
function euclideanDistance(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return Infinity;
  return Math.sqrt(a.reduce((sum, v, i) => sum + Math.pow(v - b[i], 2), 0));
}

// Vector search using SODA (products, reviews collections)
async function vectorSearch(queryEmbedding) {
  const conn = await getOracleConnection();
  try {
    const soda = conn.getSodaDatabase();
    const collections = [
      { name: 'products', type: 'product', nameField: 'name', descField: 'description' },
      { name: 'reviews', type: 'review', nameField: null, descField: 'reviewText' }
    ];
    let results = [];
    for (const col of collections) {
      const collection = await soda.openCollection(col.name);
      if (!collection) continue;
      // Find all docs with embedding
      const cursor = await collection.find().filter({ "embedding": { "$exists": true } }).getCursor();
      let docs = [];
      let doc;
      while ((doc = await cursor.getNext())) {
        const content = doc.getContent();
        if (Array.isArray(content.embedding)) {
          const dist = euclideanDistance(queryEmbedding, content.embedding);
          docs.push({
            type: col.type,
            name: col.nameField ? content[col.nameField] : null,
            description: content[col.descField],
            similarity: dist
          });
        }
      }
      // Sort and take top 2
      docs.sort((a, b) => a.similarity - b.similarity);
      results = results.concat(docs.slice(0, 2));
    }
    // Separate products and reviews for return
    const products = results.filter(r => r.type === 'product').map(r => ({ name: r.name, description: r.description }));
    const reviews = results.filter(r => r.type === 'review').map(r => ({ reviewText: r.description }));
    return { products, reviews };
  } finally {
    await conn.close();
  }
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