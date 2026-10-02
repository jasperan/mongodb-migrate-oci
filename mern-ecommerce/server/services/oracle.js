/**
 * Thin Oracle access for the feature endpoints (migration showcase, AI).
 *
 * The storefront itself talks to Oracle through the MongoDB API (mongoose);
 * these helpers are for SQL-shaped work: JSON/duality views, validity reports
 * and in-database vector search.
 *
 * Configuration (server/.env):
 *   ORACLE_CONNECT_STRING  - EZConnect / descriptor / TNS alias of the ADB
 *   ORACLE_APP_USER        - schema that owns the migrated JSON collections
 *   ORACLE_APP_PASSWORD    - its password
 *   ORACLE_DV_USER         - schema that owns the duality views (default: <app>_DV)
 *   ORACLE_POOL_MAX        - pooled connections (default 6)
 *   ORACLE_CALL_TIMEOUT_MS - per-statement round-trip limit (default 15000)
 * The public API never runs as ADMIN: ORACLE_USER/ORACLE_PASSWORD are for the
 * setup scripts only, so a missing ORACLE_APP_* variable disables SQL access
 * instead of silently widening it.
 */
const oracledb = require('oracledb');

const appUser = process.env.ORACLE_APP_USER;
const appPassword = process.env.ORACLE_APP_PASSWORD;
const dvUser = process.env.ORACLE_DV_USER || `${appUser}DV`;
const connectString = process.env.ORACLE_CONNECT_STRING;

const positiveInt = (name, fallback) => {
  const value = Number.parseInt(process.env[name], 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
};

const POOL_MAX = positiveInt('ORACLE_POOL_MAX', 6);
// The pool opens a missing connection per waiting request, one after another
// (about a second each against a cloud database), so a burst of parallel queries
// on a cold pool is serialised. The database pages fan out up to six queries at
// once, so the whole pool is kept open.
const POOL_MIN = POOL_MAX;
const CALL_TIMEOUT_MS = positiveInt('ORACLE_CALL_TIMEOUT_MS', 15000);
// Waiting for a pooled connection longer than this means the pool is saturated;
// failing fast beats a request that hangs behind a stuck statement.
const QUEUE_TIMEOUT_MS = 10000;
const DEFAULT_MAX_ROWS = 1000;

let poolPromise = null;

const isConfigured = () => Boolean(appUser && appPassword && connectString);

const getPool = async () => {
  if (!isConfigured()) {
    const error = new Error(
      'Oracle SQL access is not configured. Set ORACLE_APP_USER / ORACLE_APP_PASSWORD / ORACLE_CONNECT_STRING in server/.env.'
    );
    error.status = 503;
    error.code = 'ORACLE_NOT_CONFIGURED';
    error.expose = true;
    throw error;
  }
  if (!poolPromise) {
    poolPromise = oracledb
      .createPool({
        user: appUser,
        password: appPassword,
        connectString,
        poolMin: POOL_MIN,
        poolMax: POOL_MAX,
        poolIncrement: 1,
        poolTimeout: 300,
        queueTimeout: QUEUE_TIMEOUT_MS,
        // The descriptor in .env retries for minutes; these bound a single attempt
        // so an unreachable database fails the request instead of hanging it.
        transportConnectTimeout: 10,
        connectTimeout: 20
      })
      .catch((error) => {
        poolPromise = null;
        throw error;
      });
  }
  return poolPromise;
};

// CLOBs (Select AI's generated SQL, JSON_SERIALIZE output) arrive as Lob objects,
// which carry connection descriptors and cannot be serialised to JSON. `fetchAsString`
// does not convert them on every driver/pool combination, so read them explicitly.
const resolveLobs = async (rows) =>
  Promise.all(
    rows.map(async (row) => {
      if (!row || typeof row !== 'object') return row;
      const values = Object.values(row);
      if (!values.some((value) => value instanceof oracledb.Lob)) return row;
      const resolved = {};
      for (const [key, value] of Object.entries(row)) {
        resolved[key] = value instanceof oracledb.Lob ? await value.getData() : value;
      }
      return resolved;
    })
  );

/**
 * Runs one statement on a pooled connection. `options.callTimeout` (ms) and
 * `options.maxRows` override the defaults; everything else goes to execute().
 */
const query = async (sql, binds = {}, options = {}) => {
  const { callTimeout = CALL_TIMEOUT_MS, ...executeOptions } = options;
  const pool = await getPool();
  const connection = await pool.getConnection();
  try {
    // Set on every call: a pooled connection keeps the value of its last user.
    connection.callTimeout = callTimeout;
    const result = await connection.execute(sql, binds, {
      outFormat: oracledb.OUT_FORMAT_OBJECT,
      maxRows: DEFAULT_MAX_ROWS,
      ...executeOptions
    });
    return resolveLobs(result.rows || []);
  } finally {
    await connection.close();
  }
};

/** Drains the pool; safe to call when SQL access was never used. */
const close = async () => {
  const pending = poolPromise;
  poolPromise = null;
  if (!pending) return;
  const pool = await pending.catch(() => null);
  await pool?.close(5);
};

const schema = {
  app: appUser,
  dv: dvUser
};

module.exports = { getPool, query, close, isConfigured, schema };
