const { parseArgs, formatReport, londonToday, main, UsageError, USAGE } = require('../jobs/dailySend');

const { getMailchimpConfig, hasMailchimpConfig } = require('../src/config/mailchimp');

const today = '2026-09-28';

const MAILCHIMP_ENV = {
  MAILCHIMP_API_KEY: 'key-us21',
  MAILCHIMP_AUDIENCE_ID: 'list1',
  MAILCHIMP_FROM_NAME: 'Time4Mishna',
  MAILCHIMP_REPLY_TO: 'info@example.org',
};

describe('parseArgs', () => {
  test('defaults: today, dry-run, no channel override, no force', () => {
    expect(parseArgs([], { today })).toEqual({ help: false, date: today, dryRun: true, force: false });
  });

  test('reads every flag', () => {
    expect(
      parseArgs(['--date=2026-10-01', '--dry-run=false', '--channel=whatsapp', '--force'], { today })
    ).toEqual({ help: false, date: '2026-10-01', dryRun: false, channels: ['whatsapp'], force: true });
  });

  test('--dry-run alone and --dry-run=true mean dry-run', () => {
    expect(parseArgs(['--dry-run'], { today }).dryRun).toBe(true);
    expect(parseArgs(['--dry-run=true'], { today }).dryRun).toBe(true);
  });

  test('--channel accepts a comma list and de-duplicates', () => {
    expect(parseArgs(['--channel=email, whatsapp,email'], { today }).channels).toEqual(['email', 'whatsapp']);
  });

  test('--help', () => {
    expect(parseArgs(['--help'], { today }).help).toBe(true);
  });

  test.each([
    [['--date=28/09/2026'], '--date must be YYYY-MM-DD'],
    [['--date'], '--date must be YYYY-MM-DD'],
    [['--dry-run=no'], '--dry-run must be true or false'],
    [['--dry-run=False'], '--dry-run must be true or false'],
    [['--force=yes'], '--force must be true or false'],
    [['--channel=sms'], '--channel must be one or more of: email, whatsapp'],
    [['--channel='], '--channel must be one or more of'],
    [['--live'], 'Unknown option: --live'],
    [['2026-09-28'], 'Unexpected argument: 2026-09-28'],
    [['-f'], 'Unexpected argument: -f'],
    [['--date=2026-09-28', '--date=2026-09-29'], '--date given more than once'],
  ])('%p throws a UsageError', (argv, message) => {
    expect(() => parseArgs(argv, { today })).toThrow(UsageError);
    expect(() => parseArgs(argv, { today })).toThrow(message);
  });
});

describe('londonToday', () => {
  test('uses the Europe/London calendar date', () => {
    expect(londonToday(new Date('2026-07-01T23:30:00Z'))).toBe('2026-07-02'); // BST: 00:30 next day
    expect(londonToday(new Date('2026-12-01T23:30:00Z'))).toBe('2026-12-01'); // GMT
  });
});

describe('formatReport', () => {
  test('formats each result', () => {
    expect(
      formatReport({
        date: today,
        mode: 'dry-run',
        status: 'partial',
        ok: false,
        results: [
          { program: 'time4mishna', channel: 'email', sender: 'file-email', ok: true, id: 'outbox/x.html' },
          { program: 'time4mishna', channel: 'whatsapp', sender: 'file-whatsapp', ok: true, skipped: true },
          { program: 'time4nach', channel: 'email', sender: null, ok: false, error: 'Render failed: x' },
          { program: 'time4nach', channel: 'whatsapp', sender: 'w', ok: true, logError: 'Send log write failed: y' },
        ],
      })
    ).toEqual([
      '[dry-run] 2026-09-28: partial',
      '  time4mishna email file-email: ok outbox/x.html',
      '  time4mishna whatsapp file-whatsapp: skipped (already sent)',
      '  time4nach email -: FAILED: Render failed: x',
      '  time4nach whatsapp w: ok [Send log write failed: y]',
    ]);
  });

  test('includes the reason when nothing was sent', () => {
    expect(
      formatReport({ date: today, mode: 'dry-run', status: 'skipped', ok: true, reason: 'No send on Shabbos or Yom Tov', results: [] })
    ).toEqual(['[dry-run] 2026-09-28: skipped (No send on Shabbos or Yom Tov)']);
  });
});

describe('main', () => {
  const okReport = { date: today, mode: 'dry-run', status: 'sent', ok: true, results: [] };

  const makeDeps = (overrides) => ({
    env: {},
    now: new Date('2026-09-28T04:00:00Z'),
    getSendConfig: jest.fn(() => ({
      mode: 'dry-run',
      channels: ['email', 'whatsapp'],
      programs: ['time4mishna', 'time4nach'],
      outboxDir: 'outbox',
    })),
    getMailchimpConfig,
    hasMailchimpConfig,
    runDailySend: jest.fn().mockResolvedValue(okReport),
    closePool: jest.fn().mockResolvedValue(),
    log: jest.fn(),
    error: jest.fn(),
    ...overrides,
  });

  test('runs a dry-run for London today with config defaults, then closes the pool', async () => {
    const deps = makeDeps();
    await expect(main([], deps)).resolves.toBe(0);
    expect(deps.runDailySend).toHaveBeenCalledWith({
      date: '2026-09-28',
      dryRun: true,
      channels: ['email', 'whatsapp'],
      programs: ['time4mishna', 'time4nach'],
      outboxDir: 'outbox',
      force: false,
      logger: { log: deps.log },
    });
    expect(deps.closePool).toHaveBeenCalledTimes(1);
    expect(deps.log).toHaveBeenCalledWith('[dry-run] 2026-09-28: sent');
  });

  test('--channel and --force override config', async () => {
    const deps = makeDeps();
    await main(['--channel=whatsapp', '--force', '--date=2026-10-01'], deps);
    expect(deps.runDailySend).toHaveBeenCalledWith(
      expect.objectContaining({ date: '2026-10-01', channels: ['whatsapp'], force: true })
    );
  });

  test('exits 1 when the report is not ok, printing to stderr', async () => {
    const deps = makeDeps({
      runDailySend: jest.fn().mockResolvedValue({ ...okReport, status: 'failed', ok: false }),
    });
    await expect(main([], deps)).resolves.toBe(1);
    expect(deps.error).toHaveBeenCalledWith('[dry-run] 2026-09-28: failed');
    expect(deps.closePool).toHaveBeenCalledTimes(1);
  });

  test('exits 1 and still closes the pool when the send throws', async () => {
    const deps = makeDeps({ runDailySend: jest.fn().mockRejectedValue(new Error('ECONNREFUSED')) });
    await expect(main([], deps)).resolves.toBe(1);
    expect(deps.error).toHaveBeenCalledWith('Daily send failed: ECONNREFUSED');
    expect(deps.closePool).toHaveBeenCalledTimes(1);
  });

  test('exits 2 on an invalid date from the service', async () => {
    const deps = makeDeps({
      runDailySend: jest.fn().mockRejectedValue(Object.assign(new Error('bad date'), { status: 400 })),
    });
    await expect(main(['--date=2026-02-30'], deps)).resolves.toBe(2);
  });

  test('a pool close failure is reported but keeps the exit code', async () => {
    const deps = makeDeps({ closePool: jest.fn().mockRejectedValue(new Error('already closed')) });
    await expect(main([], deps)).resolves.toBe(0);
    expect(deps.error).toHaveBeenCalledWith('Closing the DB pool failed: already closed');
  });

  test('exits 2 on bad arguments without sending', async () => {
    const deps = makeDeps();
    await expect(main(['--channel=sms'], deps)).resolves.toBe(2);
    expect(deps.error).toHaveBeenCalledWith(USAGE);
    expect(deps.runDailySend).not.toHaveBeenCalled();
  });

  test('exits 2 on invalid config without sending', async () => {
    const deps = makeDeps({
      getSendConfig: jest.fn(() => {
        throw new Error('SEND_MODE must be one of: dry-run, live (got "Live")');
      }),
    });
    await expect(main([], deps)).resolves.toBe(2);
    expect(deps.runDailySend).not.toHaveBeenCalled();
  });

  test('--help prints usage and does not send', async () => {
    const deps = makeDeps();
    await expect(main(['--help'], deps)).resolves.toBe(0);
    expect(deps.log).toHaveBeenCalledWith(USAGE);
    expect(deps.runDailySend).not.toHaveBeenCalled();
    expect(deps.getSendConfig).not.toHaveBeenCalled();
  });

  describe('going live needs SEND_MODE=live and --dry-run=false', () => {
    const liveConfig = () => ({ mode: 'live', channels: ['email'], programs: ['time4nach'], outboxDir: 'outbox' });

    test('--dry-run=false without SEND_MODE=live is a usage error', async () => {
      const deps = makeDeps();
      await expect(main(['--dry-run=false'], deps)).resolves.toBe(2);
      expect(deps.error).toHaveBeenCalledWith('--dry-run=false needs SEND_MODE=live');
      expect(deps.runDailySend).not.toHaveBeenCalled();
    });

    test('SEND_MODE=live alone stays dry-run', async () => {
      const deps = makeDeps({ getSendConfig: jest.fn(liveConfig) });
      await main([], deps);
      expect(deps.runDailySend).toHaveBeenCalledWith(expect.objectContaining({ dryRun: true }));
    });

    test('both together go live, with the validated Mailchimp config', async () => {
      const deps = makeDeps({ env: MAILCHIMP_ENV, getSendConfig: jest.fn(liveConfig) });
      await expect(main(['--dry-run=false'], deps)).resolves.toBe(0);
      expect(deps.runDailySend).toHaveBeenCalledWith(
        expect.objectContaining({
          dryRun: false,
          mailchimp: expect.objectContaining({ audienceId: 'list1', serverPrefix: 'us21', sendTime: '05:15' }),
        })
      );
    });

    test('live email with missing Mailchimp config exits 2 before sending', async () => {
      const deps = makeDeps({ getSendConfig: jest.fn(liveConfig) });
      await expect(main(['--dry-run=false'], deps)).resolves.toBe(2);
      expect(deps.error).toHaveBeenCalledWith(expect.stringContaining('MAILCHIMP_API_KEY is required'));
      expect(deps.error).not.toHaveBeenCalledWith(USAGE);
      expect(deps.runDailySend).not.toHaveBeenCalled();
      expect(deps.closePool).not.toHaveBeenCalled();
    });

    test('live WhatsApp only does not need Mailchimp config', async () => {
      const deps = makeDeps({ getSendConfig: jest.fn(liveConfig) });
      await expect(main(['--dry-run=false', '--channel=whatsapp'], deps)).resolves.toBe(0);
      expect(deps.runDailySend.mock.calls[0][0]).not.toHaveProperty('mailchimp');
    });
  });

  describe('Mailchimp config in dry-run', () => {
    test('unset: dry-run runs without it', async () => {
      const deps = makeDeps();
      await expect(main([], deps)).resolves.toBe(0);
      expect(deps.runDailySend.mock.calls[0][0]).not.toHaveProperty('mailchimp');
    });

    test('set: validated and passed on for the payload preview', async () => {
      const deps = makeDeps({ env: MAILCHIMP_ENV });
      await expect(main([], deps)).resolves.toBe(0);
      expect(deps.runDailySend.mock.calls[0][0].mailchimp).toMatchObject({ audienceId: 'list1' });
    });

    test('set but invalid: exits 2', async () => {
      const deps = makeDeps({ env: { MAILCHIMP_AUDIENCE_ID: 'list1' } });
      await expect(main([], deps)).resolves.toBe(2);
      expect(deps.runDailySend).not.toHaveBeenCalled();
    });
  });
});
