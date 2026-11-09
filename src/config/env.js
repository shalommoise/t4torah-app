require('dotenv').config();
const mysql = require('mysql2/promise');

const port = process.env.PORT || 3000;

const DATABASE_ROLES = ['write', 'read'];

const isBlank = (value) => value === undefined || value === null || String(value).trim() === '';

/**
 * Connection settings for a role. `read` uses the DATABASE_READ_* variables
 * (host and name default to the write ones); when DATABASE_READ_USER is unset
 * it falls back to the write user so an existing .env keeps working.
 *
 * @param {'write'|'read'} role
 * @param {Record<string, string|undefined>} [env]
 * @returns {{ host?: string, user?: string, password?: string, database?: string, usingReadUser: boolean }}
 */
const getDatabaseSettings = (role, env = process.env) => {
  const write = {
    host: env.DATABASE_HOST,
    user: env.DATABASE_USER,
    password: env.DATABASE_PASSWORD,
    database: env.DATABASE_NAME,
  };
  if (role !== 'read' || isBlank(env.DATABASE_READ_USER)) {
    return { ...write, usingReadUser: false };
  }
  return {
    host: isBlank(env.DATABASE_READ_HOST) ? write.host : env.DATABASE_READ_HOST,
    user: env.DATABASE_READ_USER,
    password: env.DATABASE_READ_PASSWORD,
    database: isBlank(env.DATABASE_READ_NAME) ? write.database : env.DATABASE_READ_NAME,
    usingReadUser: true,
  };
};

let role = 'write';
let pool = null;

/**
 * Picks which DB user this process connects as. The API server calls
 * useDatabaseRole('read') before loading the app; jobs keep the default 'write'.
 * Must run before the first query, since the pool is created then.
 *
 * @param {'write'|'read'} nextRole
 */
const useDatabaseRole = (nextRole) => {
  if (!DATABASE_ROLES.includes(nextRole)) {
    throw new Error(`Unknown database role "${nextRole}" (expected write or read)`);
  }
  if (pool && nextRole !== role) {
    throw new Error('useDatabaseRole must be called before the first query');
  }
  role = nextRole;
};

const getDatabaseRole = () => role;

const getPool = () => {
  if (!pool) {
    const { usingReadUser, ...settings } = getDatabaseSettings(role);
    if (role === 'read' && !usingReadUser) {
      // eslint-disable-next-line no-console
      console.warn('DATABASE_READ_USER is not set; the API server is connecting as the write user');
    }
    pool = mysql.createPool({
      ...settings,
      charset: 'utf8mb4',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    });
  }
  return pool;
};

const getConnection = () => getPool().getConnection(); // gets a single connection (needs release)
const query = (sql, params) => getPool().query(sql, params); // runs query & auto-releases

/** Ends the pool if one was created; a no-op otherwise. */
const closePool = async () => {
  if (pool) {
    const current = pool;
    pool = null;
    await current.end();
  }
};

module.exports = {
  port,
  getConnection,
  query,
  closePool,
  useDatabaseRole,
  getDatabaseRole,
  getDatabaseSettings,
  // Kept for callers that end the pool directly (integration tests).
  get pool() {
    return getPool();
  },
};
