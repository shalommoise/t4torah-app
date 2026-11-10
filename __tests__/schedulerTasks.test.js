const { createScheduledTasks, buildScheduledTasks } = require('../src/services/scheduler/tasks');

// 22:00 on Tue 10 Nov 2026 in London (GMT).
const NOW = new Date('2026-11-10T22:00:00Z');
const EMAIL_CONFIG = { bucketUrl: 'https://bucket.test', assetsUrl: null, unsubscribeUrl: '*|UNSUB|*' };
const CASTOS = { apiKey: 'key', testPodcastId: '1', livePodcastId: '2', publishTime: '05:15', timeZone: 'Europe/London' };

const okReport = (date) => ({ date, mode: 'live', status: 'sent', ok: true, results: [] });

const makeDeps = (overrides = {}) => ({
  live: true,
  sendConfig: { channels: ['email'], programs: ['time4mishna'], outboxDir: 'outbox' },
  mailchimp: { audienceId: 'a' },
  emailConfig: EMAIL_CONFIG,
  schedulerConfig: { castos: true, castosDays: 3 },
  castos: CASTOS,
  podcastId: '2',
  runDailySend: jest.fn(async ({ date }) => okReport(date)),
  formatSendReport: jest.fn((report) => [`email ${report.date} ${report.status}`]),
  getDailyContent: jest.fn(async (date) => ({ date: { gregorian_date: date } })),
  publishDailyEpisode: jest.fn(async () => ({ status: 'exists', title: 't', episodeId: 9 })),
  createCastosClient: jest.fn(() => ({})),
  formatCastosResult: jest.fn((result, { date }) => `castos ${date} ${result.status}`),
  logger: { log: jest.fn(), error: jest.fn() },
  now: () => NOW,
  ...overrides,
});

describe('createScheduledTasks', () => {
  test('evening: email for tomorrow, then Castos for tomorrow and the next days', async () => {
    const deps = makeDeps();
    const result = await createScheduledTasks(deps).evening();

    expect(result).toEqual({ ok: true, failures: [] });
    expect(deps.runDailySend).toHaveBeenCalledTimes(1);
    expect(deps.runDailySend).toHaveBeenCalledWith(
      expect.objectContaining({
        date: '2026-11-11',
        dryRun: false,
        channels: ['email'],
        programs: ['time4mishna'],
        emailConfig: EMAIL_CONFIG,
        mailchimp: { audienceId: 'a' },
      })
    );
    expect(deps.getDailyContent.mock.calls.map(([date]) => date)).toEqual(['2026-11-11', '2026-11-12', '2026-11-13']);
    expect(deps.publishDailyEpisode).toHaveBeenCalledWith(
      expect.objectContaining({ podcastId: '2', dryRun: false, now: NOW, publishTime: '05:15', bucketUrl: 'https://bucket.test' })
    );
  });

  test('morning: email and Castos for today', async () => {
    const deps = makeDeps();
    await createScheduledTasks(deps).morning();

    expect(deps.runDailySend.mock.calls[0][0].date).toBe('2026-11-10');
    expect(deps.getDailyContent.mock.calls.map(([date]) => date)).toEqual(['2026-11-10']);
  });

  test('dry-run mode runs both as dry runs', async () => {
    const deps = makeDeps({ live: false });
    await createScheduledTasks(deps).morning();

    expect(deps.runDailySend.mock.calls[0][0].dryRun).toBe(true);
    expect(deps.publishDailyEpisode.mock.calls[0][0].dryRun).toBe(true);
  });

  test('a failed step is logged and the rest still run', async () => {
    const deps = makeDeps({
      runDailySend: jest.fn(async ({ date }) => ({ date, status: 'failed', ok: false, results: [] })),
      publishDailyEpisode: jest
        .fn()
        .mockRejectedValueOnce(new Error('Castos down'))
        .mockResolvedValue({ status: 'created' }),
    });
    const result = await createScheduledTasks(deps).evening();

    expect(result.ok).toBe(false);
    expect(result.failures).toEqual(['email 2026-11-11: status failed', 'castos 2026-11-11: Castos down']);
    expect(deps.publishDailyEpisode).toHaveBeenCalledTimes(3);
    expect(deps.logger.error).toHaveBeenCalledWith('email 2026-11-11 failed');
    expect(deps.logger.error).toHaveBeenCalledWith('[scheduler] [live] castos 2026-11-11: Castos down');
  });

  test('a date missing from dates_table fails that Castos step', async () => {
    const deps = makeDeps({ getDailyContent: jest.fn(async () => null) });
    const result = await createScheduledTasks(deps).morning();
    expect(result.failures).toEqual(['castos 2026-11-10: 2026-11-10 is not in dates_table']);
  });

  test('skips Castos when it is off', async () => {
    const deps = makeDeps({ schedulerConfig: { castos: false, castosDays: 7 } });
    await createScheduledTasks(deps).evening();
    expect(deps.publishDailyEpisode).not.toHaveBeenCalled();
  });
});

describe('buildScheduledTasks', () => {
  const LIVE_ENV = {
    SEND_MODE: 'live',
    SEND_CHANNELS: 'email',
    SEND_PROGRAMS: 'time4mishna',
    BUCKET_PATH: 'https://bucket.test',
    CASTOS_API_KEY: 'key',
    CASTOS_PODCAST_ID: '1',
  };
  const schedulerConfig = { castos: true, castosDays: 7 };
  const logger = { log: jest.fn(), error: jest.fn() };

  test('needs BUCKET_PATH', () => {
    expect(() => buildScheduledTasks({ ...LIVE_ENV, BUCKET_PATH: '' }, schedulerConfig, logger)).toThrow('BUCKET_PATH');
  });

  test('live Castos needs the live show', () => {
    expect(() =>
      buildScheduledTasks({ ...LIVE_ENV, SEND_CHANNELS: 'whatsapp' }, schedulerConfig, logger)
    ).toThrow('CASTOS_LIVE_PODCAST_ID');
  });

  test('live email needs the Mailchimp config', () => {
    expect(() =>
      buildScheduledTasks({ ...LIVE_ENV, CASTOS_LIVE_PODCAST_ID: '2' }, schedulerConfig, logger)
    ).toThrow(/MAILCHIMP/);
  });
});
