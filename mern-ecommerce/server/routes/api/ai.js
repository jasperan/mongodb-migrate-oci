/**
 * AI endpoints backed by Oracle AI Database 26ai + an OpenAI-compatible model.
 *
 * POST /api/ai/similar  { text, topK? } -> in-database vector search over the catalogue
 * POST /api/ai/ask      { question }    -> Select AI (natural language to SQL) when a
 *                                          profile is configured, otherwise an
 *                                          explanatory 503; admin only
 * GET  /api/ai/status                   -> which AI capabilities are configured
 *
 * All of them share the AI rate limit: each call embeds text or reaches a paid model.
 */
const express = require('express');
const { query } = require('../../services/oracle');
const llm = require('../../services/llm');
const vectorSearch = require('../../services/vectorSearch');
const auth = require('../../middleware/auth');
const role = require('../../middleware/role');
const { aiLimiter } = require('../../middleware/rateLimit');
const { asyncHandler, httpError } = require('../../utils/http');
const { checkGeneratedSql } = require('../../utils/sqlGuard');
const { ROLES } = require('../../constants');

const router = express.Router();

const SELECT_AI_PROFILE = process.env.SELECT_AI_PROFILE || '';

const MAX_TEXT_CHARS = 500;
// Select AI asks a model inside the database, so generating the SQL takes much
// longer than running it.
const GENERATE_TIMEOUT_MS = 30000;
const RUN_TIMEOUT_MS = 10000;
const ASK_MAX_ROWS = 50;

router.use(aiLimiter);

const requireText = (value, field) => {
  if (typeof value !== 'string' || !value.trim()) throw httpError(400, `${field} is required.`);
  const text = value.trim();
  if (text.length > MAX_TEXT_CHARS) {
    throw httpError(400, `${field} must be at most ${MAX_TEXT_CHARS} characters.`);
  }
  return text;
};

router.get('/status', (req, res) => {
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

router.post(
  '/similar',
  asyncHandler(async (req, res) => {
    const text = requireText(req.body?.text, 'text');
    const topK = req.body?.topK;
    if (topK !== undefined && !Number.isFinite(topK)) throw httpError(400, 'topK must be a number.');

    try {
      const result = await vectorSearch.search(text, topK);
      return res.json({ query: text, ...result });
    } catch (error) {
      // Missing embeddings are a setup state the page explains; anything else
      // (database or provider failure) reaches the error middleware unchanged.
      if (error.status === 503 && error.expose) {
        error.extra = {
          hint:
            'Vector search needs either an in-database embedding model (VECTOR_EMBEDDING_MODEL) or an OpenAI-compatible embedding endpoint (LLM_EMBEDDING_MODEL) plus populated embeddings (see sql/26ai/08_ai_vector_store.sql).'
        };
      }
      throw error;
    }
  })
);

// ------------------------------------------------------------------ Select AI
// Select AI hands back SQL that this endpoint then executes as the schema owner.
// Only a single read-only query is run (see utils/sqlGuard.js); anything else is
// reported, not executed.

// The ORA code identifies the failure without exposing object names or paths.
const oraCode = (error) => String(error?.message || '').match(/ORA-\d{5}/)?.[0] || null;

router.post(
  '/ask',
  auth,
  role.check(ROLES.Admin),
  asyncHandler(async (req, res) => {
    const question = requireText(req.body?.question, 'question');

    if (!SELECT_AI_PROFILE) {
      throw httpError(503, 'No Select AI profile is configured.', {
        hint: 'Create one with DBMS_CLOUD_AI.CREATE_PROFILE and set SELECT_AI_PROFILE in server/.env (see sql/26ai/09_select_ai.sql).'
      });
    }

    let generated;
    try {
      const rows = await query(
        `select dbms_cloud_ai.generate(
                  prompt       => :question,
                  profile_name => :profile,
                  action       => 'showsql') as generated_sql
           from dual`,
        { question, profile: SELECT_AI_PROFILE },
        { callTimeout: GENERATE_TIMEOUT_MS }
      );
      generated = String(rows[0]?.GENERATED_SQL || '').trim();
    } catch (error) {
      console.error('[select-ai] generate failed:', error);
      throw httpError(502, 'Select AI could not generate SQL for this question.', { provider: 'Oracle Select AI' });
    }

    const response = {
      question,
      provider: 'Oracle Select AI',
      profile: SELECT_AI_PROFILE,
      sql: generated,
      rows: null,
      truncated: false
    };

    const checked = checkGeneratedSql(generated);
    if (checked.skipped) return res.json({ ...response, skipped: checked.skipped });

    try {
      const rows = await query(checked.sql, {}, { callTimeout: RUN_TIMEOUT_MS, maxRows: ASK_MAX_ROWS + 1 });
      return res.json({ ...response, rows: rows.slice(0, ASK_MAX_ROWS), truncated: rows.length > ASK_MAX_ROWS });
    } catch (error) {
      console.error('[select-ai] generated SQL failed:', error);
      const code = oraCode(error);
      return res.json({ ...response, error: `The generated SQL could not be run${code ? ` (${code})` : ''}.` });
    }
  })
);

module.exports = router;
