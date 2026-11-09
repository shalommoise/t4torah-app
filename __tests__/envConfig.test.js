const mockCreatePool = jest.fn();
jest.mock('mysql2/promise', () => ({ createPool: (...args) => mockCreatePool(...args) }));
jest.mock('dotenv', () => ({ config: jest.fn() }));

const DB_KEYS = [
  'DATABASE_HOST',
  'DATABASE_USER',
  'DATABASE_PASSWORD',
  'DATABASE_NAME',
  'DATABASE_READ_HOST',
  'DATABASE_READ_USER',
  'DATABASE_READ_PASSWORD',
  'DATABASE_READ_NAME',
];
const WRITE_ENV = {
  DATABASE_HOST: 'db.internal',
  DATABASE_USER: 'app_write',
  DATABASE_PASSWORD: 'write-pass',
  DATABASE_NAME: 'time4torah_db',
};

let savedEnv;
let fakePool;

/** A fresh copy of src/config/env.js, so its pool and role start unset. */
const loadEnv = (env) => {
  DB_KEYS.forEach((key) => delete process.env[key]);
  Object.assign(process.env, env);
  let mod;
  jest.isolateModules(() => {
    mod = require('../src/config/env');
  });
  return mod;
};

beforeEach(() => {
  savedEnv = Object.fromEntries(DB_KEYS.map((key) => [key, process.env[key]]));
  fakePool = { query: jest.fn().mockResolvedValue([[]]), getConnection: jest.fn(), end: jest.fn() };
  mockCreatePool.mockReset().mockReturnValue(fakePool);
});

afterEach(() => {
  DB_KEYS.forEach((key) => {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  });
  jest.restoreAllMocks();
});

describe('getDatabaseSettings', () => {
  const { getDatabaseSettings } = loadEnv({});

  test('write uses the DATABASE_* variables', () => {
    expect(getDatabaseSettings('write', { ...WRITE_ENV, DATABASE_READ_USER: 'app_read' })).toEqual({
      host: 'db.internal',
      user: 'app_write',
      password: 'write-pass',
      database: 'time4torah_db',
      usingReadUser: false,
    });
  });

  test('read uses DATABASE_READ_*, with host and name from the write settings', () => {
    expect(
      getDatabaseSettings('read', { ...WRITE_ENV, DATABASE_READ_USER: 'app_read', DATABASE_READ_PASSWORD: 'read-pass' })
    ).toEqual({
      host: 'db.internal',
      user: 'app_read',
      password: 'read-pass',
      database: 'time4torah_db',
      usingReadUser: true,
    });
  });

  test('read can override host and name', () => {
    expect(
      getDatabaseSettings('read', {
        ...WRITE_ENV,
        DATABASE_READ_HOST: 'replica.internal',
        DATABASE_READ_USER: 'app_read',
        DATABASE_READ_PASSWORD: 'read-pass',
        DATABASE_READ_NAME: 'time4torah_replica',
      })
    ).toMatchObject({ host: 'replica.internal', database: 'time4torah_replica' });
  });

  test('read falls back to the write user when DATABASE_READ_USER is blank', () => {
    expect(getDatabaseSettings('read', { ...WRITE_ENV, DATABASE_READ_USER: '  ' })).toMatchObject({
      user: 'app_write',
      password: 'write-pass',
      usingReadUser: false,
    });
  });
});

describe('pool and role', () => {
  test('jobs connect as the write user by default, and only on the first query', async () => {
    const env = loadEnv({ ...WRITE_ENV, DATABASE_READ_USER: 'app_read', DATABASE_READ_PASSWORD: 'read-pass' });

    expect(env.getDatabaseRole()).toBe('write');
    expect(mockCreatePool).not.toHaveBeenCalled();

    await env.query('SELECT 1', []);

    expect(mockCreatePool).toHaveBeenCalledTimes(1);
    expect(mockCreatePool.mock.calls[0][0]).toMatchObject({ user: 'app_write', password: 'write-pass' });
    expect(fakePool.query).toHaveBeenCalledWith('SELECT 1', []);
  });

  test('the read role connects as the read user', async () => {
    const env = loadEnv({ ...WRITE_ENV, DATABASE_READ_USER: 'app_read', DATABASE_READ_PASSWORD: 'read-pass' });

    env.useDatabaseRole('read');
    await env.query('SELECT 1', []);

    expect(mockCreatePool.mock.calls[0][0]).toMatchObject({
      host: 'db.internal',
      user: 'app_read',
      password: 'read-pass',
      database: 'time4torah_db',
      charset: 'utf8mb4',
    });
    expect(mockCreatePool.mock.calls[0][0]).not.toHaveProperty('usingReadUser');
  });

  test('the read role warns and uses the write user when no read user is set', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const env = loadEnv(WRITE_ENV);

    env.useDatabaseRole('read');
    await env.query('SELECT 1', []);

    expect(mockCreatePool.mock.calls[0][0]).toMatchObject({ user: 'app_write' });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('DATABASE_READ_USER is not set'));
  });

  test('refuses to change role after the pool exists', async () => {
    const env = loadEnv(WRITE_ENV);
    await env.query('SELECT 1', []);

    expect(() => env.useDatabaseRole('read')).toThrow('useDatabaseRole must be called before the first query');
    expect(() => env.useDatabaseRole('write')).not.toThrow();
  });

  test('rejects an unknown role', () => {
    const env = loadEnv(WRITE_ENV);

    expect(() => env.useDatabaseRole('admin')).toThrow('Unknown database role "admin"');
  });

  test('closePool ends the pool once and is a no-op without one', async () => {
    const env = loadEnv(WRITE_ENV);

    await env.closePool();
    expect(fakePool.end).not.toHaveBeenCalled();

    await env.query('SELECT 1', []);
    await env.closePool();
    await env.closePool();
    expect(fakePool.end).toHaveBeenCalledTimes(1);
  });
});

describe('src/server.js', () => {
  test('sets the read role before loading the app', () => {
    const order = [];
    const listen = jest.fn();
    jest.isolateModules(() => {
      jest.doMock('http', () => ({ createServer: jest.fn(() => ({ listen })) }));
      jest.doMock('../src/config/env', () => ({
        port: 3999,
        useDatabaseRole: jest.fn((role) => order.push(`role:${role}`)),
      }));
      jest.doMock('../src/app', () => {
        order.push('app');
        return {};
      });
      require('../src/server');
    });

    expect(order).toEqual(['role:read', 'app']);
    expect(listen).toHaveBeenCalledWith(3999, expect.any(Function));
  });
});
