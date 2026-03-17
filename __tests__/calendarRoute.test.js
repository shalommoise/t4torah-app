const request = require('supertest');
const app = require('../src/app');
const { generateCalendarAssets, parseMonthYear } = require('../src/services/calendarService');

jest.mock('../src/services/calendarService', () => ({
  generateCalendarAssets: jest.fn(),
  parseMonthYear: jest.fn(),
}));

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
      assetBasePath: '/calendar-files',
    });
  });

  test('returns 400 for invalid month/year', async () => {
    parseMonthYear.mockImplementation(() => {
      const error = new Error('month must be 1-12 and year must be a positive number');
      error.status = 400;
      throw error;
    });

    const res = await request(app).get('/calendar?month=13&year=2026');

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: 'month must be 1-12 and year must be a positive number',
    });
  });
});
