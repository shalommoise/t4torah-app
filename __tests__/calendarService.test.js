jest.mock('../src/config/env', () => ({ query: jest.fn() }));
jest.mock('../src/models/datesModel', () => ({ selectTime4MishnaScheduleByDateId: jest.fn() }));

const { query } = require('../src/config/env');
const { parseMonthYear, buildCalendarJson, MIN_YEAR, MAX_YEAR } = require('../src/services/calendarService');

describe('parseMonthYear', () => {
  test('accepts a month and year inside the range', () => {
    expect(parseMonthYear({ month: '4', year: '2026' })).toEqual({
      monthNumber: 4,
      yearNumber: 2026,
      monthPadded: '04',
    });
  });

  test('accepts the first and last allowed years', () => {
    expect(parseMonthYear({ month: 1, year: MIN_YEAR }).yearNumber).toBe(2000);
    expect(parseMonthYear({ month: 12, year: MAX_YEAR }).yearNumber).toBe(2100);
  });

  test.each([
    ['a huge year', { month: 4, year: 999999 }],
    ['the year before the range', { month: 4, year: 1999 }],
    ['the year after the range', { month: 4, year: 2101 }],
    ['year 1', { month: 4, year: 1 }],
    ['a fractional year', { month: 4, year: 2026.5 }],
    ['a non-numeric year', { month: 4, year: 'abc' }],
    ['month 0', { month: 0, year: 2026 }],
    ['month 13', { month: 13, year: 2026 }],
  ])('rejects %s with a 400', (label, input) => {
    expect(() => parseMonthYear(input)).toThrow(
      expect.objectContaining({ status: 400, message: 'month must be 1-12 and year must be 2000-2100' })
    );
  });
});

describe('buildCalendarJson', () => {
  test('rejects an out-of-range year before querying the database', async () => {
    await expect(buildCalendarJson({ month: 4, year: 999999 })).rejects.toMatchObject({ status: 400 });
    expect(query).not.toHaveBeenCalled();
  });
});
