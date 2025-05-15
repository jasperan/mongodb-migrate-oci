const express = require('express');
const router = express.Router();
const { vectorSearch, callLlmApi } = require('../../services/llmChat');

// POST /api/llm-chat/message
router.post('/message', async (req, res) => {
  const { message } = req.body;
  try {
    // 1. Vector search for relevant context
    const { products, reviews } = await vectorSearch(message);
    const context = [];
    if (products) {
      context.push(...products.map(p => `Product: ${p.name} - ${p.description}`));
    }
    if (reviews) {
      context.push(...reviews.map(r => `Review: ${r.reviewText}`));
    }
    // 2. Call LLM API
    const llmResponse = await callLlmApi({ message, context });
    return res.json({ response: llmResponse, context });
  } catch (err) {
    return res.status(500).json({ error: 'LLM chat failed', details: err.message });
  }
});

module.exports = router; 