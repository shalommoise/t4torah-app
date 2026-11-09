const request = require('supertest');

jest.mock('../src/services/calendarService', () => ({
  generateCalendarAssets: jest.fn().mockResolvedValue({ html: '<html><body>calendar</body></html>' }),
  parseMonthYear: jest.fn().mockReturnValue({ monthNumber: 4, yearNumber: 2026, monthPadded: '04' }),
}));

const ENV_KEYS = ['RATE_LIMIT_WINDOW_MS', 'RATE_LIMIT_MAX', 'RATE_LIMIT_CALENDAR_MAX', 'TRUST_PROXY'];

/** Loads a fresh app (and so fresh rate-limit counters) with the given env. */
const loadApp = (env = {}) => {
  const saved = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
  ENV_KEYS.forEach((key) => delete process.env[key]);
  Object.assign(process.env, env);
  let app;
  jest.isolateModules(() => {
    app = require('../src/app');
  });
  ENV_KEYS.forEach((key) => {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  });
  return app;
};

const scriptSrc = (res) =>
  res.headers['content-security-policy']
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith('script-src '));

describe('security headers', () => {
  const app = loadApp();

  test('sets helmet headers on API responses', async () => {
    const res = await request(app).get('/api/v1/health');

    expect(res.status).toBe(200);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['strict-transport-security']).toMatch(/max-age=/);
    expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(scriptSrc(res)).toBe("script-src 'self'");
  });

  test('lets other origins embed images', async () => {
    const res = await request(app).get('/imgs/wholeHeader.png');

    expect(res.status).toBe(200);
    expect(res.headers['cross-origin-resource-policy']).toBe('cross-origin');
  });

  test('allows the inline script the calendar page needs', async () => {
    const res = await request(app).get('/calendar?month=4&year=2026');

    expect(res.status).toBe(200);
    expect(scriptSrc(res)).toBe("script-src 'self' 'unsafe-inline'");
  });

  test('keeps CORS open for the public read API', async () => {
    const res = await request(app).get('/api/v1/health').set('Origin', 'https://example.org');

    expect(res.headers['access-control-allow-origin']).toBe('*');
  });

  test('sends rate-limit headers', async () => {
    const res = await request(app).get('/api/v1/health');

    expect(res.headers.ratelimit).toMatch(/limit=300/);
  });
});

describe('rate limiting', () => {
  test('returns a JSON 429 once the global limit is reached', async () => {
    const app = loadApp({ RATE_LIMIT_MAX: '3' });

    for (let i = 0; i < 3; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      expect((await request(app).get('/api/v1/health')).status).toBe(200);
    }
    const res = await request(app).get('/api/v1/health');

    expect(res.status).toBe(429);
    expect(res.body).toEqual({ error: 'Too many requests, try again later' });
  });

  test('limits /calendar more tightly than the rest of the API', async () => {
    const app = loadApp({ RATE_LIMIT_CALENDAR_MAX: '2' });

    expect((await request(app).get('/calendar?month=4&year=2026')).status).toBe(200);
    expect((await request(app).get('/calendar?month=4&year=2026')).status).toBe(200);
    expect((await request(app).get('/calendar?month=4&year=2026')).status).toBe(429);
    expect((await request(app).get('/api/v1/health')).status).toBe(200);
  });

  test('counts unauthenticated /calendar/export attempts against the calendar limit', async () => {
    const app = loadApp({ RATE_LIMIT_CALENDAR_MAX: '1' });

    expect((await request(app).get('/calendar/export?month=4&year=2026')).status).not.toBe(429);
    expect((await request(app).get('/calendar/export?month=4&year=2026')).status).toBe(429);
  });

  test('with TRUST_PROXY set, counts each forwarded client separately', async () => {
    const app = loadApp({ RATE_LIMIT_MAX: '1', TRUST_PROXY: '1' });

    expect((await request(app).get('/api/v1/health').set('X-Forwarded-For', '203.0.113.1')).status).toBe(200);
    expect((await request(app).get('/api/v1/health').set('X-Forwarded-For', '203.0.113.2')).status).toBe(200);
    expect((await request(app).get('/api/v1/health').set('X-Forwarded-For', '203.0.113.1')).status).toBe(429);
  });
});
