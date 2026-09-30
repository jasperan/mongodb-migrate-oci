/**
 * OpenAI-compatible LLM client (replaces the previous Ollama-specific service).
 *
 * Works with any provider that speaks the OpenAI chat-completions API:
 * xAI (Grok), OpenAI, OCI Generative AI's OpenAI-compatible endpoint,
 * vLLM/Ollama's /v1 shim, etc.
 *
 * Configuration (server/.env):
 *   LLM_PROVIDER   optional: `oci` (OCI Generative AI) or `openai` (default)
 *   LLM_MODEL      e.g. xai.grok-4.3, grok-4
 *
 *   OCI Generative AI (LLM_PROVIDER=oci) — the workshop setup:
 *     OCI_GENAI_ENDPOINT       https://inference.generativeai.us-phoenix-1.oci.oraclecloud.com
 *     OCI_GENAI_API_KEY        sk-… (OCI GenAI API key, not an OCI config profile)
 *   A bare region URL is normalised to its OpenAI-compatible path (/openai/v1).
 *
 *   Any other OpenAI-compatible provider:
 *     LLM_BASE_URL   e.g. https://api.x.ai/v1
 *     LLM_API_KEY    provider key
 *
 *   LLM_BASE_URL / LLM_API_KEY still win when set, so a direct endpoint can be
 *   pointed at without changing the provider switch.
 *
 *   LLM_EMBEDDING_MODEL  optional, e.g. text-embedding-3-small
 */
const DEFAULT_TIMEOUT_MS = 60000;

// `https://host` or `https://host/openai/v1` -> `https://host/openai/v1`
const normalizeEndpoint = (value) => {
  const base = String(value || '').trim().replace(/\/+$/, '');
  if (!base) return '';
  return /\/openai\/v1$/.test(base) ? base : `${base}/openai/v1`;
};

const config = () => {
  const provider = (process.env.LLM_PROVIDER || (process.env.OCI_GENAI_API_KEY ? 'oci' : 'openai')).toLowerCase();
  const ociBaseUrl = normalizeEndpoint(process.env.OCI_GENAI_ENDPOINT_FULL || process.env.OCI_GENAI_ENDPOINT);
  return {
    provider,
    baseUrl: (process.env.LLM_BASE_URL || (provider === 'oci' ? ociBaseUrl : '')).replace(/\/+$/, ''),
    apiKey: process.env.LLM_API_KEY || (provider === 'oci' ? process.env.OCI_GENAI_API_KEY || '' : ''),
    model: process.env.LLM_MODEL || 'grok-4',
    embeddingModel: process.env.LLM_EMBEDDING_MODEL || ''
  };
};

const isConfigured = () => {
  const { baseUrl, apiKey } = config();
  return Boolean(baseUrl && apiKey);
};

const status = () => {
  const { provider, baseUrl, model, embeddingModel } = config();
  return {
    configured: isConfigured(),
    provider,
    baseUrl: baseUrl || null,
    model,
    embeddingModel: embeddingModel || null,
    hint: isConfigured()
      ? null
      : 'Set LLM_PROVIDER=oci with OCI_GENAI_ENDPOINT + OCI_GENAI_API_KEY, or LLM_BASE_URL + LLM_API_KEY, in server/.env.'
  };
};

const post = async (path, body) => {
  const { baseUrl, apiKey } = config();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  try {
    const response = await fetch(`${baseUrl}${path}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });
    const text = await response.text();
    let payload = null;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      payload = { raw: text };
    }
    if (!response.ok) {
      const message = payload?.error?.message || payload?.message || payload?.raw || response.statusText;
      const error = new Error(`LLM request failed (${response.status}): ${message}`);
      error.status = response.status;
      throw error;
    }
    return payload;
  } finally {
    clearTimeout(timer);
  }
};

/**
 * Chat completion. `messages` is the OpenAI message array.
 */
const chat = async ({ messages, temperature = 0.2, maxTokens = 700 }) => {
  const { model } = config();
  const payload = await post('/chat/completions', {
    model,
    messages,
    temperature,
    max_tokens: maxTokens
  });
  return {
    model: payload?.model || model,
    content: payload?.choices?.[0]?.message?.content?.trim() || '',
    usage: payload?.usage || null
  };
};

const embed = async (input) => {
  const { embeddingModel } = config();
  if (!embeddingModel) {
    const error = new Error('No embedding model configured (set LLM_EMBEDDING_MODEL).');
    error.status = 503;
    throw error;
  }
  const payload = await post('/embeddings', { model: embeddingModel, input });
  const vectors = (payload?.data || []).map((item) => item.embedding);
  if (!vectors.length) throw new Error('Embedding provider returned no vectors');
  return { model: payload?.model || embeddingModel, vectors };
};

module.exports = { chat, embed, status, isConfigured, config };
