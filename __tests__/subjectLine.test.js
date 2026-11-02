const { SUBJECT_FORMAT, buildSubject } = require('../src/services/render/subjectLine');

const dateRow = (overrides) => ({
  gregorian_date: '2026-10-28',
  hebrew_date: '17 Cheshvan 5787',
  ...overrides,
});

describe('buildSubject', () => {
  test('uses the documented format', () => {
    expect(SUBJECT_FORMAT).toBe('{shiur} ({weekday} {day} {month}) | {specialDate}');
  });

  test('matches the manual send: shiur label and short date', () => {
    expect(buildSubject(dateRow(), 'time4mishna', ['Shabbos 17.3-17.6'])).toBe('Shabbos 17.3-17.6 (Wed 28 Oct)');
  });

  test('joins several labels, skipping empty ones', () => {
    expect(buildSubject(dateRow(), 'combined', ['Shabbos 17.3-17.6', null, 'Tehillim 42'])).toBe(
      'Shabbos 17.3-17.6 & Tehillim 42 (Wed 28 Oct)'
    );
  });

  test.each([
    ['time4mishna', 'Time4Mishna (Wed 28 Oct)'],
    ['time4nach', 'Time4Nach (Wed 28 Oct)'],
    ['combined', 'Time4Mishna & Time4Nach (Wed 28 Oct)'],
  ])('%s falls back to the program title without labels', (program, expected) => {
    expect(buildSubject(dateRow(), program)).toBe(expected);
  });

  test('uses "Sep" regardless of ICU month abbreviations', () => {
    expect(buildSubject(dateRow({ gregorian_date: '2026-09-28' }), 'time4mishna', ['Sukkah 2.1-2.4'])).toBe(
      'Sukkah 2.1-2.4 (Mon 28 Sep)'
    );
  });

  test('is deterministic across time zones and DST', () => {
    expect(buildSubject(dateRow({ gregorian_date: '2026-10-25' }), 'time4nach')).toMatch(/\(Sun 25 Oct\)/);
    expect(buildSubject(dateRow({ gregorian_date: '2027-01-01' }), 'time4nach')).toMatch(/\(Fri 1 Jan\)/);
  });

  test('appends the special date when present', () => {
    expect(
      buildSubject(dateRow({ gregorian_date: '2026-09-28', special_date: 'Chol HaMoed Sukkos' }), 'time4mishna', [
        'Sukkah 2.1-2.4',
      ])
    ).toBe('Sukkah 2.1-2.4 (Mon 28 Sep) | Chol HaMoed Sukkos');
  });

  test('removes links from the special date and drops it if nothing is left', () => {
    expect(buildSubject(dateRow({ special_date: 'Hoshana Rabbah https://x.com' }), 'time4nach')).toBe(
      'Time4Nach (Wed 28 Oct) | Hoshana Rabbah'
    );
    expect(buildSubject(dateRow({ special_date: 'https://x.com' }), 'time4nach')).toBe('Time4Nach (Wed 28 Oct)');
  });

  test('throws for an unknown program or a bad date row', () => {
    expect(() => buildSubject(dateRow(), 'other')).toThrow('Unknown program');
    expect(() => buildSubject(dateRow({ gregorian_date: '08/10/2026' }), 'time4mishna')).toThrow();
    expect(() => buildSubject(null, 'time4mishna')).toThrow();
  });
});
