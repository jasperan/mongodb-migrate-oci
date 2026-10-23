require('dotenv').config();
const express = require('express');
const chalk = require('chalk');
const cors = require('cors');
const helmet = require('helmet');
const mongoose = require('mongoose');

const keys = require('./config/keys');
const routes = require('./routes');
const socket = require('./socket');
const setupDB = require('./utils/db');
const oracle = require('./services/oracle');

const { port } = keys;
const app = express();

// Behind nginx/a load balancer the client address comes from X-Forwarded-For;
// the rate limiters count it, so the proxy depth has to be declared:
// TRUST_PROXY=1 (one hop), `true`, or an address/subnet list. Unset = no proxy.
const parseTrustProxy = value => {
  if (value === undefined || value === '' || value === 'false') return false;
  if (value === 'true') return true;
  return /^\d+$/.test(value) ? Number(value) : value;
};
const trustProxy = parseTrustProxy(process.env.TRUST_PROXY);
if (trustProxy !== false) app.set('trust proxy', trustProxy);

// Plain `key=value` parsing: `category[$ne]=x` stays a string instead of
// becoming an operator object that would reach a query filter.
app.set('query parser', 'simple');

app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(
  helmet({
    contentSecurityPolicy: false,
    frameguard: true
  })
);
app.use(cors({ origin: keys.corsOrigins }));

const ORACLE_PING_TTL_MS = 10000;
const ORACLE_PING_TIMEOUT_MS = 3000;
let oraclePing = { at: 0, state: 'down' };

// Cached briefly: container healthchecks poll this route, and each probe would
// otherwise take a pooled connection from the Oracle pool.
const checkOracle = async () => {
  if (!oracle.isConfigured()) return 'not-configured';
  if (Date.now() - oraclePing.at < ORACLE_PING_TTL_MS) return oraclePing.state;

  let timer;
  const state = await Promise.race([
    oracle.query('select 1 from dual').then(() => 'up'),
    new Promise(resolve => {
      timer = setTimeout(() => resolve('down'), ORACLE_PING_TIMEOUT_MS);
    })
  ])
    .catch(() => 'down')
    .finally(() => clearTimeout(timer));

  oraclePing = { at: Date.now(), state };
  return state;
};

app.get('/api/health', async (req, res) => {
  const mongoUp = mongoose.connection.readyState === 1;
  const oracleState = await checkOracle();
  const healthy = mongoUp && oracleState !== 'down';

  res.status(mongoUp ? 200 : 503).json({
    status: healthy ? 'ok' : 'degraded',
    mongo: mongoUp ? 'up' : 'down',
    oracle: oracleState
  });
});

require('./config/passport')(app);
app.use(routes);

// Unknown API paths and every error forwarded through asyncHandler()/next(err)
// answer in the `{ error }` shape the web client already reads. Server-side
// failures are logged and reported generically; their text never leaves.
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Malformed JSON body.' });
  }
  const status = Number.isInteger(err.status) && err.status >= 400 && err.status < 600 ? err.status : 500;
  if (status >= 500) console.error(err);
  const message = status < 500 || err.expose ? err.message : 'Internal server error';
  return res.status(status).json({ error: message, ...(err.extra || {}) });
});

process.on('unhandledRejection', reason => {
  console.error('Unhandled promise rejection:', reason);
});

const SHUTDOWN_GRACE_MS = 10000;

const shutdown = (signal, server, io) => {
  console.log(`${signal} received, shutting down.`);
  // Hard stop if a connection refuses to drain.
  setTimeout(() => process.exit(1), SHUTDOWN_GRACE_MS).unref();

  const closeHttp = new Promise(resolve => io.close(() => resolve()));
  closeHttp
    .then(() => (server.listening ? new Promise(resolve => server.close(resolve)) : null))
    .then(() => mongoose.disconnect())
    .then(() => (typeof oracle.close === 'function' ? oracle.close() : null))
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Shutdown failed:', error);
      process.exit(1);
    });
};

// Listen only once the database connection is up: setupDB() stops the process on
// a connection failure, so a bad MONGO_URI never leaves a half-serving API.
setupDB().then(() => {
  const server = app.listen(port, () => {
    console.log(
      `${chalk.green('✓')} ${chalk.blue(
        `API listening on port ${port}. Start the web client and open http://localhost:8080/ for the storefront.`
      )}`
    );
  });

  const io = socket(server);

  ['SIGINT', 'SIGTERM'].forEach(signal =>
    process.once(signal, () => shutdown(signal, server, io))
  );
});
