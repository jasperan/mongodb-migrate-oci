/**
 * AI endpoints backed by Oracle AI Database 26ai + an OpenAI-compatible model.
 *
 * POST /api/ai/similar  { text }     -> in-database vector search over the catalogue
 * POST /api/ai/ask      { question } -> Select AI (natural language to SQL) when a
 *                                       profile is configured, otherwise an
 *                                       explanatory 503
 * GET  /api/ai/status                -> which AI capabilities are configured
 */
const express = require('express');
const { query } = require('../../services/oracle');
const llm = require('../../services/llm');
const vectorSearch = require('../../services/vectorSearch');
const auth = require('../../middleware/auth');
const { ROLES } = require('../../constants');

const router = express.Router();

const SELECT_AI_PROFILE = process.env.SELECT_AI_PROFILE || '';

// Select AI hands back SQL that this endpoint then executes, so it stays behind an
// admin session: /api/ai/similar and /api/admin-db stay readable for the public
// showcase page, but only an administrator can drive queries against the schema.
const adminOnly = (req, res, next) =>
  req.user?.role === ROLES.Admin ? next() : res.status(403).json({ error: 'Admin role required' });

router.get('/status', async (req, res) => {
  res.json({
    llm: llm.status(),
    embeddings: {
      inDatabaseModel: vectorSearch.EMBEDDING_MODEL || null,
      dimension: vectorSearch.EMBEDDING_DIM,
      table: vectorSearch.EMBEDDING_TABLE,
      remoteModel: llm.config().embeddingModel || null
    },
    selectAi: {
      profile: SELECT_AI_PROFILE || null,
      configured: Boolean(SELECT_AI_PROFILE)
    }
  });
});

router.post('/similar', async (req, res) => {
  const text = (req.body?.text || '').trim();
  if (!text) return res.status(400).json({ error: 'text is required' });

  try {
    const result = await vectorSearch.search(text, Number(req.body?.topK) || 6);
    return res.json({ query: text, ...result });
  } catch (error) {
    return res.status(error.status || 500).json({
      error: error.message,
      hint:
        'Vector search needs either an in-database embedding model (VECTOR_EMBEDDING_MODEL) or an OpenAI-compatible embedding endpoint (LLM_EMBEDDING_MODEL) plus populated embeddings (see sql/26ai/08_ai_vector_store.sql).'
    });
  }
});

router.post('/ask', auth, adminOnly, async (req, res) => {
  const question = (req.body?.question || '').trim();
  if (!question) return res.status(400).json({ error: 'question is required' });

  if (!SELECT_AI_PROFILE) {
    return res.status(503).json({
      error: 'No Select AI profile is configured.',
      hint: 'Create one with DBMS_CLOUD_AI.CREATE_PROFILE and set SELECT_AI_PROFILE in server/.env (see sql/26ai/09_select_ai.sql).'
    });
  }

  try {
    const rows = await query(
      `select dbms_cloud_ai.generate(
                prompt       => :question,
                profile_name => :profile,
                action       => 'showsql') as generated_sql
         from dual`,
      { question, profile: SELECT_AI_PROFILE }
    );
    const generatedSql = String(rows[0]?.GENERATED_SQL || '').trim();

    let data = null;
    if (/^\s*select/i.test(generatedSql)) {
      data = await query(generatedSql.replace(/;\s*$/, '')).catch((error) => ({
        error: `Generated SQL failed: ${error.message}`
      }));
    }

    return res.json({
      question,
      provider: 'Oracle Select AI',
      profile: SELECT_AI_PROFILE,
      sql: generatedSql,
      rows: Array.isArray(data) ? data.slice(0, 50) : data
    });
  } catch (error) {
    return res.status(error.status || 500).json({ error: error.message, provider: 'Oracle Select AI' });
  }
});

module.exports = router;
