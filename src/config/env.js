require('dotenv').config();
const { AsyncLocalStorage } = require('async_hooks');
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
const pools = new Map();
// Lets code inside runWithDatabaseRole use another role than the process
// default, e.g. the in-app scheduler writing send_log inside the read-only
// API server.
const roleContext = new AsyncLocalStorage();

const currentRole = () => roleContext.getStore() || role;

const assertRole = (value) => {
  if (!DATABASE_ROLES.includes(value)) {
    throw new Error(`Unknown database role "${value}" (expected write or read)`);
  }
};

/**
 * Picks which DB user this process connects as. The API server calls
 * useDatabaseRole('read') before loading the app; jobs keep the default 'write'.
 * Must run before the first query, since the pool is created then.
 *
 * @param {'write'|'read'} nextRole
 */
const useDatabaseRole = (nextRole) => {
  assertRole(nextRole);
  if (pools.size && nextRole !== role) {
    throw new Error('useDatabaseRole must be called before the first query');
  }
  role = nextRole;
};

/**
 * Runs `fn` with every query inside it (including awaited async work) using
 * `nextRole`'s pool, without changing the process default. Each role has its
 * own pool, created on its first query.
 *
 * @template T
 * @param {'write'|'read'} nextRole
 * @param {() => T} fn
 * @returns {T}
 */
const runWithDatabaseRole = (nextRole, fn) => {
  assertRole(nextRole);
  return roleContext.run(nextRole, fn);
};

const getDatabaseRole = () => currentRole();

const getPool = () => {
  const activeRole = currentRole();
  if (!pools.has(activeRole)) {
    const { usingReadUser, ...settings } = getDatabaseSettings(activeRole);
    if (activeRole === 'read' && !usingReadUser) {
      // eslint-disable-next-line no-console
      console.warn('DATABASE_READ_USER is not set; the API server is connecting as the write user');
    }
    pools.set(
      activeRole,
      mysql.createPool({
        ...settings,
        charset: 'utf8mb4',
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
      })
    );
  }
  return pools.get(activeRole);
};

const getConnection = () => getPool().getConnection(); // gets a single connection (needs release)
const query = (sql, params) => getPool().query(sql, params); // runs query & auto-releases

/** Ends every pool that was created; a no-op otherwise. */
const closePool = async () => {
  const current = [...pools.values()];
  pools.clear();
  await Promise.all(current.map((p) => p.end()));
};

module.exports = {
  port,
  getConnection,
  query,
  closePool,
  useDatabaseRole,
  runWithDatabaseRole,
  getDatabaseRole,
  getDatabaseSettings,
  // Kept for callers that end the pool directly (integration tests).
  get pool() {
    return getPool();
  },
};
