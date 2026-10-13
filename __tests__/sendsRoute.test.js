const request = require('supertest');
const app = require('../src/app');
const { getSendPreview } = require('../src/services/sendPreviewService');
const { getSendLog } = require('../src/services/sendLogService');

jest.mock('../src/services/sendPreviewService', () => ({
  getSendPreview: jest.fn(),
}));

jest.mock('../src/services/sendLogService', () => ({
  getSendLog: jest.fn(),
}));

const httpError = (status, message) => Object.assign(new Error(message), { status });

// The sends routes require a bearer token (G3; see sendsAuth.test.js).
const TOKEN = 'test-sends-admin-token';
const originalToken = process.env.SENDS_ADMIN_TOKEN;
beforeAll(() => {
  process.env.SENDS_ADMIN_TOKEN = TOKEN;
});
afterAll(() => {
  if (originalToken === undefined) {
    delete process.env.SENDS_ADMIN_TOKEN;
  } else {
    process.env.SENDS_ADMIN_TOKEN = originalToken;
  }
});
const authed = (method, url) => request(app)[method](url).set('Authorization', `Bearer ${TOKEN}`);

const preview = {
  date: '2026-09-28',
  program: 'time4mishna',
  sendDay: true,
  email: { subject: 'Time4Mishna – Monday 28 Sep | 17 Tishrei', html: '<html><body>Brachos</body></html>', text: 'Brachos' },
  whatsapp: { text: '*Brachos*' },
};

let consoleError;
beforeEach(() => {
  jest.clearAllMocks();
  // The error middleware logs every error; keep test output clean.
  consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => consoleError.mockRestore());

describe('GET /api/v1/sends/preview', () => {
  test('returns the rendered preview as JSON', async () => {
    getSendPreview.mockResolvedValue(preview);

    const res = await authed('get', '/api/v1/sends/preview?date=2026-09-28&channel=email&program=time4mishna');

    expect(res.status).toBe(200);
    expect(res.body).toEqual(preview);
    expect(getSendPreview).toHaveBeenCalledWith({ date: '2026-09-28', program: 'time4mishna', channel: 'email' });
  });

  test('passes undefined for omitted program and channel', async () => {
    getSendPreview.mockResolvedValue(preview);
    await authed('get', '/api/v1/sends/preview?date=2026-09-28');
    expect(getSendPreview).toHaveBeenCalledWith({ date: '2026-09-28', program: undefined, channel: undefined });
  });

  test('a repeated query parameter is passed as invalid, not as an array', async () => {
    getSendPreview.mockRejectedValue(httpError(400, 'channel must be one of: email, whatsapp'));
    const res = await authed('get', '/api/v1/sends/preview?date=2026-09-28&channel=email&channel=whatsapp');
    expect(res.status).toBe(400);
    expect(getSendPreview).toHaveBeenCalledWith({ date: '2026-09-28', program: undefined, channel: '' });
  });

  test('400 on a bad date', async () => {
    getSendPreview.mockRejectedValue(httpError(400, 'gregorianDate must be a valid date in YYYY-MM-DD format'));
    const res = await authed('get', '/api/v1/sends/preview?date=28-09-2026');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'gregorianDate must be a valid date in YYYY-MM-DD format' });
  });

  test('404 when there is no date row', async () => {
    getSendPreview.mockRejectedValue(httpError(404, 'No date row for 2030-01-01'));
    const res = await authed('get', '/api/v1/sends/preview?date=2030-01-01');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'No date row for 2030-01-01' });
  });
});

describe('GET /api/v1/sends/preview.html', () => {
  test('returns the email HTML directly', async () => {
    getSendPreview.mockResolvedValue(preview);

    const res = await authed('get', '/api/v1/sends/preview.html?date=2026-09-28&program=time4nach');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/^text\/html/);
    expect(res.text).toBe('<html><body>Brachos</body></html>');
    expect(getSendPreview).toHaveBeenCalledWith({ date: '2026-09-28', program: 'time4nach', channel: 'email' });
  });

  test('400 and 404 come back as JSON errors', async () => {
    getSendPreview.mockRejectedValueOnce(httpError(400, 'bad date'));
    expect((await authed('get', '/api/v1/sends/preview.html?date=x')).status).toBe(400);

    getSendPreview.mockRejectedValueOnce(httpError(404, 'No date row for 2030-01-01'));
    expect((await authed('get', '/api/v1/sends/preview.html?date=2030-01-01')).status).toBe(404);
  });
});

describe('GET /api/v1/sends/log', () => {
  test('returns the send log for a date', async () => {
    const log = {
      date: '2026-09-28',
      entries: [
        {
          id: 1,
          program: 'time4mishna',
          channel: 'email',
          mode: 'dry-run',
          status: 'sent',
          providerMessageId: 'console-email-time4mishna-2026-09-28',
          createdAt: '2026-09-28T04:00:00.000Z',
        },
      ],
    };
    getSendLog.mockResolvedValue(log);

    const res = await authed('get', '/api/v1/sends/log?date=2026-09-28');

    expect(res.status).toBe(200);
    expect(res.body).toEqual(log);
    expect(getSendLog).toHaveBeenCalledWith({ date: '2026-09-28' });
  });

  test('returns an empty list when nothing was sent', async () => {
    getSendLog.mockResolvedValue({ date: '2026-09-29', entries: [] });
    const res = await authed('get', '/api/v1/sends/log?date=2026-09-29');
    expect(res.status).toBe(200);
    expect(res.body.entries).toEqual([]);
  });

  test('400 on a bad or missing date', async () => {
    getSendLog.mockRejectedValue(httpError(400, 'date must be a valid date in YYYY-MM-DD format'));
    const res = await authed('get', '/api/v1/sends/log');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'date must be a valid date in YYYY-MM-DD format' });
    expect(getSendLog).toHaveBeenCalledWith({ date: undefined });
  });

  test.each(['post', 'put', 'patch', 'delete'])('is read-only: %s is not routed', async (method) => {
    const res = await authed(method, '/api/v1/sends/log?date=2026-09-28');
    expect(res.status).toBe(404);
    expect(getSendLog).not.toHaveBeenCalled();
  });
});
