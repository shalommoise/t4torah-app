const request = require('supertest');
const app = require('../src/app');
const { generateCalendarAssets, parseMonthYear } = require('../src/services/calendarService');
const { exportCalendarAssets } = require('../src/services/calendarExportService');

jest.mock('../src/services/calendarService', () => ({
  generateCalendarAssets: jest.fn(),
  parseMonthYear: jest.fn(),
}));

jest.mock('../src/services/calendarExportService', () => ({
  exportCalendarAssets: jest.fn(),
}));

const TOKEN = 'calendar-export-test-token';

describe('GET /calendar/maker', () => {
  test('returns the calendar maker form', async () => {
    const res = await request(app).get('/calendar/maker');

    expect(res.status).toBe(200);
    expect(res.text).toContain('<form action="/calendar" method="get">');
  });
});

describe('GET /calendar', () => {
  test('returns generated calendar html', async () => {
    parseMonthYear.mockReturnValue({ monthNumber: 4, yearNumber: 2026, monthPadded: '04' });
    generateCalendarAssets.mockResolvedValue({
      html: '<html><body>April calendar</body></html>',
    });

    const res = await request(app).get('/calendar?month=4&year=2026');

    expect(res.status).toBe(200);
    expect(res.text).toContain('April calendar');
    expect(parseMonthYear).toHaveBeenCalledWith({ month: '4', year: '2026' });
    expect(generateCalendarAssets).toHaveBeenCalledWith({
      month: 4,
      year: 2026,
      assetBasePath: '/imgs',
    });
  });

  test('returns 400 for invalid month/year', async () => {
    parseMonthYear.mockImplementation(() => {
      const error = new Error('month must be 1-12 and year must be 2000-2100');
      error.status = 400;
      throw error;
    });

    const res = await request(app).get('/calendar?month=13&year=2026');

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: 'month must be 1-12 and year must be 2000-2100',
    });
  });
});

describe('GET /calendar/export', () => {
  const originalToken = process.env.SENDS_ADMIN_TOKEN;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.SENDS_ADMIN_TOKEN = TOKEN;
    parseMonthYear.mockReturnValue({ monthNumber: 4, yearNumber: 2026, monthPadded: '04' });
    generateCalendarAssets.mockResolvedValue({ html: '<html></html>' });
    exportCalendarAssets.mockResolvedValue({
      pdfPath: '/tmp/calendar_04_2026.pdf',
      pngPath: '/tmp/T4M-04-26.png',
    });
  });

  afterAll(() => {
    if (originalToken === undefined) {
      delete process.env.SENDS_ADMIN_TOKEN;
    } else {
      process.env.SENDS_ADMIN_TOKEN = originalToken;
    }
  });

  test('returns 401 without a token and does not export', async () => {
    const res = await request(app).get('/calendar/export?month=4&year=2026&format=all');

    expect(res.status).toBe(401);
    expect(parseMonthYear).not.toHaveBeenCalled();
    expect(generateCalendarAssets).not.toHaveBeenCalled();
    expect(exportCalendarAssets).not.toHaveBeenCalled();
  });

  test('returns 401 with a wrong token', async () => {
    const res = await request(app)
      .get('/calendar/export?month=4&year=2026&format=all')
      .set('Authorization', 'Bearer wrong-token');

    expect(res.status).toBe(401);
    expect(exportCalendarAssets).not.toHaveBeenCalled();
  });

  test('fails closed with 503 when SENDS_ADMIN_TOKEN is unset', async () => {
    delete process.env.SENDS_ADMIN_TOKEN;

    const res = await request(app)
      .get('/calendar/export?month=4&year=2026&format=all')
      .set('Authorization', `Bearer ${TOKEN}`);

    expect(res.status).toBe(503);
    expect(exportCalendarAssets).not.toHaveBeenCalled();
  });

  test('exports with the admin token', async () => {
    const res = await request(app)
      .get('/calendar/export?month=4&year=2026&format=all')
      .set('Authorization', `Bearer ${TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      month: '04',
      year: 2026,
      pdf: '/tmp/calendar_04_2026.pdf',
      png: '/tmp/T4M-04-26.png',
    });
  });

  test('returns 400 for an out-of-range year even with the token', async () => {
    parseMonthYear.mockImplementation(() => {
      const error = new Error('month must be 1-12 and year must be 2000-2100');
      error.status = 400;
      throw error;
    });

    const res = await request(app)
      .get('/calendar/export?month=4&year=999999&format=all')
      .set('Authorization', `Bearer ${TOKEN}`);

    expect(res.status).toBe(400);
    expect(exportCalendarAssets).not.toHaveBeenCalled();
  });
});
