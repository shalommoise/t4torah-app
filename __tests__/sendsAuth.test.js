const request = require('supertest');
const app = require('../src/app');
const { getSendPreview } = require('../src/services/sendPreviewService');
const { getSendLog } = require('../src/services/sendLogService');
const { requireSendsAdminToken } = require('../src/middleware/requireSendsAdminToken');

jest.mock('../src/services/sendPreviewService', () => ({
  getSendPreview: jest.fn(),
}));

jest.mock('../src/services/sendLogService', () => ({
  getSendLog: jest.fn(),
}));

const TOKEN = 'correct-horse-battery-staple-0123456789';
const ROUTES = [
  '/api/v1/sends/preview?date=2026-09-28',
  '/api/v1/sends/preview.html?date=2026-09-28',
  '/api/v1/sends/log?date=2026-09-28',
];

const originalToken = process.env.SENDS_ADMIN_TOKEN;
const setToken = (value) => {
  if (value === undefined) {
    delete process.env.SENDS_ADMIN_TOKEN;
  } else {
    process.env.SENDS_ADMIN_TOKEN = value;
  }
};

beforeEach(() => {
  jest.clearAllMocks();
  getSendPreview.mockResolvedValue({
    date: '2026-09-28',
    program: 'time4mishna',
    sendDay: true,
    email: { subject: 's', html: '<p>ok</p>', text: 'ok' },
    whatsapp: { text: 'ok' },
  });
  getSendLog.mockResolvedValue({ date: '2026-09-28', entries: [] });
});

afterAll(() => setToken(originalToken));

const servicesNotCalled = () => {
  expect(getSendPreview).not.toHaveBeenCalled();
  expect(getSendLog).not.toHaveBeenCalled();
};

describe('when SENDS_ADMIN_TOKEN is not configured', () => {
  test.each([
    ['unset', undefined],
    ['empty', ''],
    ['whitespace', '   '],
  ])('%s → 503 on every sends route, even with a token', async (_name, value) => {
    setToken(value);
    for (const url of ROUTES) {
      const res = await request(app).get(url).set('Authorization', `Bearer ${TOKEN}`);
      expect(res.status).toBe(503);
      expect(res.body).toEqual({ error: 'Sends admin API is not configured (SENDS_ADMIN_TOKEN is not set)' });
    }
    servicesNotCalled();
  });
});

describe('when SENDS_ADMIN_TOKEN is configured', () => {
  beforeEach(() => setToken(TOKEN));

  test.each(ROUTES)('200 with the right token: %s', async (url) => {
    const res = await request(app).get(url).set('Authorization', `Bearer ${TOKEN}`);
    expect(res.status).toBe(200);
  });

  test('the Bearer scheme is case-insensitive', async () => {
    const res = await request(app).get(ROUTES[2]).set('Authorization', `bearer ${TOKEN}`);
    expect(res.status).toBe(200);
  });

  test.each([
    ['no Authorization header', undefined],
    ['empty header', ''],
    ['wrong token', 'Bearer wrong-token'],
    ['token prefix', `Bearer ${TOKEN.slice(0, -1)}`],
    ['token with extra suffix', `Bearer ${TOKEN}x`],
    ['different case', `Bearer ${TOKEN.toUpperCase()}`],
    ['no scheme', TOKEN],
    ['Basic scheme', `Basic ${Buffer.from(`admin:${TOKEN}`).toString('base64')}`],
    ['Bearer with no token', 'Bearer '],
    ['two tokens', `Bearer ${TOKEN} ${TOKEN}`],
  ])('401 for %s on every sends route', async (_name, header) => {
    for (const url of ROUTES) {
      const req = request(app).get(url);
      const res = await (header === undefined ? req : req.set('Authorization', header));
      expect(res.status).toBe(401);
      expect(res.body).toEqual({ error: 'Unauthorized' });
      expect(res.headers['www-authenticate']).toBe('Bearer');
    }
    servicesNotCalled();
  });

  test('unknown sends paths are also behind the token', async () => {
    expect((await request(app).get('/api/v1/sends/anything')).status).toBe(401);
  });

  test('other API routes are not affected', async () => {
    const res = await request(app).get('/api/v1/sends-like/nothing');
    expect(res.status).toBe(404);
    const health = await request(app).get('/api/v1/health');
    expect(health.status).not.toBe(401);
    expect(health.status).not.toBe(503);
  });
});

describe('requireSendsAdminToken', () => {
  const run = (getToken, authorization) => {
    const req = { get: (name) => (name.toLowerCase() === 'authorization' ? authorization : undefined) };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis(), set: jest.fn().mockReturnThis() };
    const next = jest.fn();
    requireSendsAdminToken({ getToken })(req, res, next);
    return { res, next };
  };

  test('calls next only for a matching token', () => {
    expect(run(() => 'abc', 'Bearer abc').next).toHaveBeenCalledTimes(1);
    expect(run(() => 'abc', 'Bearer abd').next).not.toHaveBeenCalled();
  });

  test('reads the token on every request (so it can be rotated without a restart)', () => {
    let token = 'first';
    const getToken = () => token;
    expect(run(getToken, 'Bearer first').next).toHaveBeenCalled();
    token = 'second';
    expect(run(getToken, 'Bearer first').res.status).toHaveBeenCalledWith(401);
    expect(run(getToken, 'Bearer second').next).toHaveBeenCalled();
  });

  test('a non-string token is treated as not configured', () => {
    expect(run(() => 123, 'Bearer 123').res.status).toHaveBeenCalledWith(503);
  });
});
