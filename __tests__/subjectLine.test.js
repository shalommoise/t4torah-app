const { SUBJECT_FORMAT, buildSubject, stripHebrewYear } = require('../src/services/render/subjectLine');

const dateRow = (overrides) => ({
  gregorian_date: '2026-10-08',
  hebrew_date: '26 Tishrei 5787',
  ...overrides,
});

describe('buildSubject', () => {
  test('uses the documented format', () => {
    expect(SUBJECT_FORMAT).toBe('{program} – {weekday} {day} {month} | {hebrewDate}');
  });

  test.each([
    ['time4mishna', 'Time4Mishna – Thursday 8 Oct | 26 Tishrei'],
    ['time4nach', 'Time4Nach – Thursday 8 Oct | 26 Tishrei'],
    ['combined', 'Time4Mishna & Time4Nach – Thursday 8 Oct | 26 Tishrei'],
  ])('%s', (program, expected) => {
    expect(buildSubject(dateRow(), program)).toBe(expected);
  });

  test('uses "Sep" regardless of ICU month abbreviations', () => {
    expect(buildSubject(dateRow({ gregorian_date: '2026-09-28', hebrew_date: '17 Tishrei 5787' }), 'time4mishna')).toBe(
      'Time4Mishna – Monday 28 Sep | 17 Tishrei'
    );
  });

  test('is deterministic across time zones and DST', () => {
    expect(buildSubject(dateRow({ gregorian_date: '2026-10-25' }), 'time4nach')).toMatch(/Sunday 25 Oct/);
    expect(buildSubject(dateRow({ gregorian_date: '2027-01-01' }), 'time4nach')).toMatch(/Friday 1 Jan/);
  });

  test('drops the Hebrew date part when there is none', () => {
    expect(buildSubject(dateRow({ hebrew_date: null }), 'time4mishna')).toBe('Time4Mishna – Thursday 8 Oct');
  });

  test('throws for an unknown program or a bad date row', () => {
    expect(() => buildSubject(dateRow(), 'other')).toThrow('Unknown program');
    expect(() => buildSubject(dateRow({ gregorian_date: '08/10/2026' }), 'time4mishna')).toThrow();
    expect(() => buildSubject(null, 'time4mishna')).toThrow();
  });
});

describe('stripHebrewYear', () => {
  test('removes a trailing 4-digit year', () => {
    expect(stripHebrewYear('26 Tishrei 5787')).toBe('26 Tishrei');
    expect(stripHebrewYear('1 Adar II 5787')).toBe('1 Adar II');
  });

  test('leaves dates without a year alone and returns null for empty', () => {
    expect(stripHebrewYear('26 Tishrei')).toBe('26 Tishrei');
    expect(stripHebrewYear('')).toBeNull();
    expect(stripHebrewYear(undefined)).toBeNull();
  });
});
