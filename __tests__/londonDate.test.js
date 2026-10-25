const { TIME_ZONE, londonToday, londonTomorrow, addDays, zonedTimeToUtc } = require('../src/utils/londonDate');

// 2026 clock changes in the UK:
//   29 Mar 01:00 GMT → 02:00 BST
//   25 Oct 02:00 BST → 01:00 GMT (a 25-hour day)
const at = (iso) => new Date(iso);

describe('londonToday', () => {
  test('uses Europe/London', () => {
    expect(TIME_ZONE).toBe('Europe/London');
  });

  test.each([
    // Late-October change (BST → GMT)
    ['2026-10-24T22:59:59Z', '2026-10-24'], // 23:59:59 BST
    ['2026-10-24T23:00:00Z', '2026-10-25'], // 00:00 BST: midnight is at 23:00 UTC in summer
    ['2026-10-25T00:30:00Z', '2026-10-25'], // 01:30 BST (first 01:30)
    ['2026-10-25T01:30:00Z', '2026-10-25'], // 01:30 GMT (second 01:30)
    ['2026-10-25T23:59:59Z', '2026-10-25'], // 23:59:59 GMT
    ['2026-10-26T00:00:00Z', '2026-10-26'], // 00:00 GMT: midnight is at 00:00 UTC in winter
    // Late-March change (GMT → BST)
    ['2026-03-28T23:30:00Z', '2026-03-28'], // 23:30 GMT
    ['2026-03-29T00:59:59Z', '2026-03-29'], // 00:59:59 GMT
    ['2026-03-29T01:00:00Z', '2026-03-29'], // 02:00 BST
    ['2026-03-29T23:30:00Z', '2026-03-30'], // 00:30 BST next day
    // Year boundary in winter
    ['2026-12-31T23:59:59Z', '2026-12-31'],
    ['2027-01-01T00:00:00Z', '2027-01-01'],
  ])('%s → %s', (iso, expected) => {
    expect(londonToday(at(iso))).toBe(expected);
  });

  test('defaults to now', () => {
    jest.useFakeTimers({ now: at('2026-07-01T23:30:00Z') });
    try {
      expect(londonToday()).toBe('2026-07-02');
    } finally {
      jest.useRealTimers();
    }
  });

  test('throws on an invalid Date', () => {
    expect(() => londonToday(new Date('nope'))).toThrow(TypeError);
    expect(() => londonToday('2026-10-25')).toThrow(TypeError);
  });
});

describe('londonTomorrow', () => {
  test.each([
    // 00:30 BST on the 25-hour day. Adding 24 hours would land on
    // 2026-10-25T23:30Z = 23:30 GMT on the 25th, i.e. the same day.
    ['2026-10-24T23:30:00Z', '2026-10-26'],
    ['2026-10-25T01:30:00Z', '2026-10-26'], // 01:30 GMT
    ['2026-10-25T23:30:00Z', '2026-10-26'], // 23:30 GMT
    ['2026-10-24T12:00:00Z', '2026-10-25'], // noon BST the day before
    // 23:30 GMT before the 23-hour day in March
    ['2026-03-28T23:30:00Z', '2026-03-29'],
    ['2026-03-29T12:00:00Z', '2026-03-30'],
  ])('%s → %s', (iso, expected) => {
    expect(londonTomorrow(at(iso))).toBe(expected);
  });

  test('+24h would be wrong on the 25-hour day (why calendar arithmetic is used)', () => {
    const instant = at('2026-10-24T23:30:00Z');
    expect(londonToday(new Date(instant.getTime() + 24 * 60 * 60 * 1000))).toBe('2026-10-25');
    expect(londonTomorrow(instant)).toBe('2026-10-26');
  });

  test('rolls over month and year ends', () => {
    expect(londonTomorrow(at('2026-12-31T12:00:00Z'))).toBe('2027-01-01');
    expect(londonTomorrow(at('2026-09-30T12:00:00Z'))).toBe('2026-10-01');
  });
});

describe('addDays', () => {
  test.each([
    ['2026-10-25', 1, '2026-10-26'],
    ['2026-10-25', -1, '2026-10-24'],
    ['2026-10-25', 0, '2026-10-25'],
    ['2028-02-28', 1, '2028-02-29'],
    ['2027-02-28', 1, '2027-03-01'],
    ['2026-12-31', 1, '2027-01-01'],
    ['2026-01-01', -1, '2025-12-31'],
    ['2026-10-01', 31, '2026-11-01'],
  ])('%s %+d → %s', (date, days, expected) => {
    expect(addDays(date, days)).toBe(expected);
  });

  test('throws on bad input', () => {
    expect(() => addDays('25/10/2026', 1)).toThrow(TypeError);
    expect(() => addDays('2026-10-25', 1.5)).toThrow(TypeError);
    expect(() => addDays(undefined, 1)).toThrow(TypeError);
  });
});

describe('zonedTimeToUtc', () => {
  test.each([
    ['2026-01-15', '05:15', '2026-01-15T05:15:00.000Z'], // GMT
    ['2026-07-01', '05:15', '2026-07-01T04:15:00.000Z'], // BST
    ['2026-03-29', '05:15', '2026-03-29T04:15:00.000Z'], // clocks went forward at 01:00 GMT
    ['2026-10-25', '05:15', '2026-10-25T05:15:00.000Z'], // clocks went back at 02:00 BST
    ['2026-03-28', '05:15', '2026-03-28T05:15:00.000Z'], // the day before BST
    ['2026-10-24', '05:15', '2026-10-24T04:15:00.000Z'], // the last BST morning
  ])('%s %s Europe/London → %s', (date, time, expected) => {
    expect(zonedTimeToUtc(date, time).toISOString()).toBe(expected);
  });

  test('defaults to Europe/London and accepts other zones', () => {
    expect(zonedTimeToUtc('2026-07-01', '05:15', TIME_ZONE).toISOString()).toBe('2026-07-01T04:15:00.000Z');
    expect(zonedTimeToUtc('2026-07-01', '05:15', 'Asia/Jerusalem').toISOString()).toBe('2026-07-01T02:15:00.000Z');
  });

  test('throws on bad input', () => {
    expect(() => zonedTimeToUtc('2026-07-01', '5:15')).toThrow(TypeError);
    expect(() => zonedTimeToUtc('01/07/2026', '05:15')).toThrow(TypeError);
  });
});
