const { parseArgs, main, UsageError } = require('../jobs/sendTest');

const today = '2026-10-28';

describe('parseArgs', () => {
  test('reads --to and --date, defaulting the date to today', () => {
    expect(parseArgs(['--to=a@example.org, b@example.org,a@example.org'], { today })).toEqual({
      help: false,
      date: today,
      to: ['a@example.org', 'b@example.org'],
    });
    expect(parseArgs(['--to=a@example.org', '--date=2026-10-29'], { today }).date).toBe('2026-10-29');
  });

  test.each([
    [[], '--to is required'],
    [['--to=not-an-email'], '--to must be one or more email addresses'],
    [['--to=a@example.org', '--date=29/10/2026'], '--date must be YYYY-MM-DD'],
    [['--to=a@example.org', '--live'], 'Unknown option: --live'],
  ])('%p throws a UsageError', (argv, text) => {
    expect(() => parseArgs(argv, { today })).toThrow(UsageError);
    expect(() => parseArgs(argv, { today })).toThrow(text);
  });
});

describe('main', () => {
  const deps = (overrides) => ({
    env: {},
    now: new Date('2026-10-28T12:00:00Z'),
    getMailchimpConfig: jest.fn(() => ({ audienceId: 'list1' })),
    getEmailConfig: jest.fn(() => ({ bucketUrl: 'https://bucket.test' })),
    getDailyContent: jest.fn().mockResolvedValue({ date: { gregorian_date: '2026-10-29' } }),
    getEmailExtras: jest.fn().mockResolvedValue({ calendarUrl: null, summaryUrls: [] }),
    getChazara: jest.fn().mockResolvedValue(null),
    renderDailyMessage: jest.fn(() => ({ email: { subject: 'Subject' } })),
    createMailchimpClient: jest.fn(() => 'client'),
    sendTestEmail: jest.fn().mockResolvedValue({ ok: true, campaignId: 'c1' }),
    closePool: jest.fn().mockResolvedValue(),
    log: jest.fn(),
    error: jest.fn(),
    ...overrides,
  });

  test('renders the Time4Mishna email with extras and sends it to the test addresses only', async () => {
    const d = deps();
    await expect(main(['--to=me@example.org', '--date=2026-10-29'], d)).resolves.toBe(0);
    expect(d.getDailyContent).toHaveBeenCalledWith('2026-10-29');
    expect(d.renderDailyMessage).toHaveBeenCalledWith(
      { date: { gregorian_date: '2026-10-29' } },
      'time4mishna',
      { bucketUrl: 'https://bucket.test' },
      { calendarUrl: null, summaryUrls: [] },
      null
    );
    expect(d.sendTestEmail).toHaveBeenCalledWith(
      expect.objectContaining({ emails: ['me@example.org'], client: 'client' })
    );
    expect(d.log).toHaveBeenCalledWith('[test] 2026-10-29 "Subject" sent to me@example.org');
    expect(d.closePool).toHaveBeenCalled();
  });

  test('passes the chazara to the renderer on a chazara Friday', async () => {
    const chazara = { range: 'Shabbos 18.3-22.5', perakim: 'Shabbos 5-6', links: {} };
    const d = deps({ getChazara: jest.fn().mockResolvedValue(chazara) });
    await expect(main(['--to=me@example.org', '--date=2026-10-29'], d)).resolves.toBe(0);
    expect(d.getChazara).toHaveBeenCalledWith({ date: { gregorian_date: '2026-10-29' } }, { bucketUrl: 'https://bucket.test' });
    expect(d.renderDailyMessage.mock.calls[0][4]).toBe(chazara);
  });

  test('exits 1 when a chazara PDF is missing', async () => {
    const d = deps({ getChazara: jest.fn().mockRejectedValue(new Error('Chazara PDF not found in the bucket: x')) });
    await expect(main(['--to=me@example.org', '--date=2026-10-29'], d)).resolves.toBe(1);
    expect(d.sendTestEmail).not.toHaveBeenCalled();
  });

  test('exits 1 on a failed send or a missing date', async () => {
    const failed = deps({ sendTestEmail: jest.fn().mockResolvedValue({ ok: false, error: 'nope' }) });
    await expect(main(['--to=me@example.org'], failed)).resolves.toBe(1);
    expect(failed.error).toHaveBeenCalledWith('[test] 2026-10-28 FAILED: nope');

    const missing = deps({ getDailyContent: jest.fn().mockResolvedValue(null) });
    await expect(main(['--to=me@example.org'], missing)).resolves.toBe(1);
    expect(missing.sendTestEmail).not.toHaveBeenCalled();
  });

  test('exits 2 on a usage or Mailchimp config error, before touching the database', async () => {
    const d = deps({ getMailchimpConfig: jest.fn(() => { throw new Error('MAILCHIMP_API_KEY is required'); }) });
    await expect(main(['--to=me@example.org'], d)).resolves.toBe(2);
    await expect(main([], d)).resolves.toBe(2);
    expect(d.getDailyContent).not.toHaveBeenCalled();
    expect(d.closePool).not.toHaveBeenCalled();
  });
});
