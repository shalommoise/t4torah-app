const request = require('supertest');
const app = require('../src/app');
const { exportCalendarAssets } = require('../src/services/calendarExportService');
const { requireAdminToken } = require('../src/middleware/requireAdminToken');

jest.mock('../src/services/calendarService', () => ({
  generateCalendarAssets: jest.fn().mockResolvedValue({ html: '<html></html>' }),
  parseMonthYear: jest.fn().mockReturnValue({ monthNumber: 4, yearNumber: 2026, monthPadded: '04' }),
}));

jest.mock('../src/services/calendarExportService', () => ({
  exportCalendarAssets: jest.fn(),
}));

const TOKEN = 'admin-token-for-tests-0123456789';
const EXPORT_URL = '/calendar/export?month=4&year=2026&format=all';

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
  exportCalendarAssets.mockResolvedValue({ pdfPath: '/tmp/a.pdf', pngPath: '/tmp/a.png' });
});

afterAll(() => setToken(originalToken));

describe('when SENDS_ADMIN_TOKEN is not configured', () => {
  test.each([
    ['unset', undefined],
    ['empty', ''],
    ['whitespace', '   '],
  ])('%s → 503, even with a token', async (_name, value) => {
    setToken(value);
    const res = await request(app).get(EXPORT_URL).set('Authorization', `Bearer ${TOKEN}`);

    expect(res.status).toBe(503);
    expect(res.body).toEqual({ error: 'Admin API is not configured (SENDS_ADMIN_TOKEN is not set)' });
    expect(exportCalendarAssets).not.toHaveBeenCalled();
  });
});

describe('when SENDS_ADMIN_TOKEN is configured', () => {
  beforeEach(() => setToken(TOKEN));

  test('200 with the right token', async () => {
    const res = await request(app).get(EXPORT_URL).set('Authorization', `Bearer ${TOKEN}`);
    expect(res.status).toBe(200);
  });

  test('the Bearer scheme is case-insensitive', async () => {
    const res = await request(app).get(EXPORT_URL).set('Authorization', `bearer ${TOKEN}`);
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
  ])('401 for %s', async (_name, header) => {
    const req = request(app).get(EXPORT_URL);
    const res = await (header === undefined ? req : req.set('Authorization', header));

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Unauthorized' });
    expect(res.headers['www-authenticate']).toBe('Bearer');
    expect(exportCalendarAssets).not.toHaveBeenCalled();
  });

  test('public routes do not need the token', async () => {
    expect((await request(app).get('/api/v1/health')).status).toBe(200);
    expect((await request(app).get('/calendar?month=4&year=2026')).status).toBe(200);
  });
});

describe('requireAdminToken', () => {
  const run = (getToken, authorization) => {
    const req = { get: (name) => (name.toLowerCase() === 'authorization' ? authorization : undefined) };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis(), set: jest.fn().mockReturnThis() };
    const next = jest.fn();
    requireAdminToken({ getToken })(req, res, next);
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
