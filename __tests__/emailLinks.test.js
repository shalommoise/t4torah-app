const { getCalendarUrl, getSummaryLinks } = require('../src/services/render/emailLinks');

const BUCKET = 'https://bucket.test/t4t';

describe('getCalendarUrl', () => {
  test('uses the month and two-digit year', () => {
    expect(getCalendarUrl('2026-10-26', BUCKET)).toBe(`${BUCKET}/mishna/calendars/T4M-10-26.png`);
    expect(getCalendarUrl('2027-01-03', BUCKET)).toBe(`${BUCKET}/mishna/calendars/T4M-01-27.png`);
  });

  test('is null without a bucket URL or a valid date', () => {
    expect(getCalendarUrl('2026-10-26', null)).toBeNull();
    expect(getCalendarUrl('26/10/2026', BUCKET)).toBeNull();
  });
});

describe('getSummaryLinks', () => {
  const row = (overrides) => ({
    shiur_type: 'regular',
    start_masechta_name: 'Shabbos',
    end_masechta_name: 'Shabbos',
    ...overrides,
  });

  test('Overview and Key Terms for the masechta', () => {
    expect(getSummaryLinks(row(), BUCKET)).toEqual([
      { label: 'Shabbos Overview', url: `${BUCKET}/mishna/summaries/Shabbos-Overview.pdf` },
      { label: 'Shabbos Key Terms', url: `${BUCKET}/mishna/summaries/Shabbos-Key-Terms.pdf` },
    ]);
  });

  test('hyphenates multi-word masechta names', () => {
    const [overview] = getSummaryLinks(row({ start_masechta_name: 'Bava Kama', end_masechta_name: 'Bava Kama' }), BUCKET);
    expect(overview.url).toBe(`${BUCKET}/mishna/summaries/Bava-Kama-Overview.pdf`);
  });

  test('links both masechtos when a shiur crosses into the next', () => {
    expect(getSummaryLinks(row({ start_masechta_name: 'Brachos', end_masechta_name: 'Peah' }), BUCKET).map((l) => l.label)).toEqual([
      'Brachos Overview',
      'Brachos Key Terms',
      'Peah Overview',
      'Peah Key Terms',
    ]);
  });

  test('none for chazara or without a bucket URL', () => {
    expect(getSummaryLinks(row({ shiur_type: 'chazara' }), BUCKET)).toEqual([]);
    expect(getSummaryLinks(row(), null)).toEqual([]);
  });
});
