const express = require('express');
const router = express.Router();
const { ragQuery } = require('../../services/llmChat');

// POST /api/llm-chat/message
router.post('/message', async (req, res) => {
  const { message } = req.body;
  try {
    const ragResponse = await ragQuery(message);
    return res.json({ response: ragResponse });
  } catch (err) {
    return res.status(500).json({ error: 'LLM chat failed', details: err.message });
  }
});

module.exports = router; 