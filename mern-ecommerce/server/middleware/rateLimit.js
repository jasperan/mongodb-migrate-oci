/**
 * Per-IP request budgets for the endpoints that are expensive or abusable:
 * credential checks, anonymous writes that store rows or send mail, and the AI
 * endpoints that call a paid model or the in-database embedding model.
 *
 * Each budget can be tuned with an environment variable; 0 disables it (the
 * e2e harnesses replay many sign-ins from one address).
 * Behind a reverse proxy set TRUST_PROXY (see index.js) so the client address,
 * not the proxy's, is what gets counted.
 */
const { rateLimit } = require('express-rate-limit');

const budget = (name, fallback) => {
  const value = Number.parseInt(process.env[name], 10);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
};

const limiter = ({ windowMs, max, message }) =>
  rateLimit({
    windowMs,
    limit: max,
    skip: () => max === 0,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: (req, res) => res.status(429).json({ error: message })
  });

// sign-in, sign-up, password reset and merchant sign-up
const authLimiter = limiter({
  windowMs: 15 * 60 * 1000,
  max: budget('RATE_LIMIT_AUTH', 50),
  message: 'Too many attempts. Please wait a few minutes and try again.'
});

// contact form, newsletter, merchant applications
const formLimiter = limiter({
  windowMs: 15 * 60 * 1000,
  max: budget('RATE_LIMIT_FORMS', 30),
  message: 'Too many submissions. Please wait a few minutes and try again.'
});

// /api/chat and /api/ai/*
const aiLimiter = limiter({
  windowMs: 60 * 1000,
  max: budget('RATE_LIMIT_AI', 30),
  message: 'Too many AI requests. Please wait a minute and try again.'
});

module.exports = { authLimiter, formLimiter, aiLimiter };
