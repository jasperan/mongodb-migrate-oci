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
 * Falling back to ORACLE_USER/ORACLE_PASSWORD (the admin connection) keeps the
 * legacy .env files working.
 */
const oracledb = require('oracledb');

const appUser = process.env.ORACLE_APP_USER || process.env.ORACLE_USER;
const appPassword = process.env.ORACLE_APP_PASSWORD || process.env.ORACLE_PASSWORD;
const dvUser = process.env.ORACLE_DV_USER || `${appUser}DV`;
const connectString = process.env.ORACLE_CONNECT_STRING;

let poolPromise = null;

const isConfigured = () => Boolean(appUser && appPassword && connectString);

const getPool = async () => {
  if (!isConfigured()) {
    throw new Error(
      'Oracle SQL access is not configured. Set ORACLE_APP_USER / ORACLE_APP_PASSWORD / ORACLE_CONNECT_STRING in server/.env.'
    );
  }
  if (!poolPromise) {
    poolPromise = oracledb.createPool({
      user: appUser,
      password: appPassword,
      connectString,
      poolMin: 1,
      poolMax: 4,
      poolIncrement: 1,
      poolTimeout: 60
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

const query = async (sql, binds = {}, options = {}) => {
  const pool = await getPool();
  const connection = await pool.getConnection();
  try {
    const result = await connection.execute(sql, binds, {
      outFormat: oracledb.OUT_FORMAT_OBJECT,
      ...options
    });
    return resolveLobs(result.rows || []);
  } finally {
    await connection.close();
  }
};

const schema = {
  app: appUser,
  dv: dvUser
};

module.exports = { getPool, query, isConfigured, schema };
