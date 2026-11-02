const { NO_EXTRAS, fileExists, getEmailExtras } = require('../src/services/emailExtrasService');

const BUCKET = 'https://bucket.test/t4t';

const mishnaRow = (overrides) => ({
  shiur_type: 'regular',
  start_masechta_name: 'Shabbos',
  end_masechta_name: 'Shabbos',
  ...overrides,
});

const content = (overrides) => ({
  date: { gregorian_date: '2026-10-26' },
  time4mishna: [mishnaRow()],
  time4nach: [],
  ...overrides,
});

// A fake HEAD request: 200 for the given URLs, 404 for anything else.
const requestFor = (existing) =>
  jest.fn(async ({ url }) => ({ status: existing.includes(url) ? 200 : 404 }));

describe('fileExists', () => {
  test('sends a HEAD request with a timeout and accepts any 2xx', async () => {
    const request = jest.fn().mockResolvedValue({ status: 204 });
    await expect(fileExists('https://x.test/a.pdf', request)).resolves.toBe(true);
    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'HEAD', url: 'https://x.test/a.pdf', timeout: expect.any(Number) })
    );
  });

  test.each([403, 404, 500])('treats status %p as missing', async (status) => {
    await expect(fileExists('https://x.test/a.pdf', jest.fn().mockResolvedValue({ status }))).resolves.toBe(false);
  });

  test('treats a network error or timeout as missing', async () => {
    await expect(fileExists('https://x.test/a.pdf', jest.fn().mockRejectedValue(new Error('timeout')))).resolves.toBe(false);
  });
});

describe('getEmailExtras', () => {
  const calendar = `${BUCKET}/mishna/calendars/T4M-10-26.png`;
  const overview = `${BUCKET}/mishna/summaries/Shabbos-Overview.pdf`;
  const keyTerms = `${BUCKET}/mishna/summaries/Shabbos-Key-Terms.pdf`;

  test('returns the calendar and summaries that exist', async () => {
    const request = requestFor([calendar, overview, keyTerms]);
    await expect(getEmailExtras(content(), { bucketUrl: BUCKET }, { request })).resolves.toEqual({
      calendarUrl: calendar,
      summaryUrls: [overview, keyTerms],
    });
    expect(request).toHaveBeenCalledTimes(3);
  });

  test('leaves out files that are missing', async () => {
    const request = requestFor([keyTerms]);
    await expect(getEmailExtras(content(), { bucketUrl: BUCKET }, { request })).resolves.toEqual({
      calendarUrl: null,
      summaryUrls: [keyTerms],
    });
  });

  test('checks each masechta once, and both masechtos when a shiur crosses into the next', async () => {
    const request = requestFor([]);
    await getEmailExtras(
      content({ time4mishna: [mishnaRow(), mishnaRow({ end_masechta_name: 'Eruvin' }), mishnaRow({ shiur_type: 'chazara' })] }),
      { bucketUrl: BUCKET },
      { request }
    );
    expect(request.mock.calls.map(([config]) => config.url)).toEqual([
      calendar,
      overview,
      keyTerms,
      `${BUCKET}/mishna/summaries/Eruvin-Overview.pdf`,
      `${BUCKET}/mishna/summaries/Eruvin-Key-Terms.pdf`,
    ]);
  });

  test('makes no requests without a bucket URL', async () => {
    const request = jest.fn();
    await expect(getEmailExtras(content(), { bucketUrl: null }, { request })).resolves.toEqual(NO_EXTRAS);
    expect(request).not.toHaveBeenCalled();
  });
});
