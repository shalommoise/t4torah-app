const { parseArgs, resolvePodcastId, formatResult, main, UsageError } = require('../jobs/publishCastosEpisode');

const TODAY = '2026-11-02';

describe('parseArgs', () => {
  test('defaults: today, dry run, test show', () => {
    expect(parseArgs([], { today: TODAY })).toEqual({ help: false, date: TODAY, dryRun: true, podcast: 'test' });
  });

  test('reads every option', () => {
    expect(parseArgs(['--date=2026-11-03', '--dry-run=false', '--podcast=live'], { today: TODAY })).toEqual({
      help: false,
      date: '2026-11-03',
      dryRun: false,
      podcast: 'live',
    });
    expect(parseArgs(['--dry-run'], { today: TODAY }).dryRun).toBe(true);
  });

  test.each([['--date=3 Nov'], ['--dry-run=no'], ['--podcast=prod'], ['--force'], ['extra']])('%s is a usage error', (arg) => {
    expect(() => parseArgs([arg], { today: TODAY })).toThrow(UsageError);
  });
});

describe('resolvePodcastId', () => {
  test('test → CASTOS_PODCAST_ID; live → CASTOS_LIVE_PODCAST_ID', () => {
    expect(resolvePodcastId('test', { testPodcastId: '72963', livePodcastId: '33558' })).toBe('72963');
    expect(resolvePodcastId('live', { testPodcastId: '72963', livePodcastId: '33558' })).toBe('33558');
  });

  test('live without CASTOS_LIVE_PODCAST_ID is a usage error', () => {
    expect(() => resolvePodcastId('live', { testPodcastId: '72963', livePodcastId: null })).toThrow(UsageError);
  });
});

describe('formatResult', () => {
  const context = { date: '2026-11-03', podcast: 'test', dryRun: false, timeZone: 'Europe/London' };
  const audio = { filename: 'shabbos_20.2-20.5.mp3', format: 'mp3', bytes: 7340032, tagged: true };

  test('created and scheduled', () => {
    expect(
      formatResult(
        { status: 'created', title: 'Shabbos 20.2-20.5', episodeId: 9, plan: { mode: 'schedule', post_date: '2026-11-03 05:15:00' }, audio },
        context
      )
    ).toBe(
      '[live] castos test 2026-11-03 "Shabbos 20.2-20.5": episode 9 scheduled for 2026-11-03 05:15:00 (Europe/London); ' +
        'audio shabbos_20.2-20.5.mp3 (mp3, 7.0 MB, ID3 tagged)'
    );
  });

  test('dry run, publish now', () => {
    expect(
      formatResult({ status: 'dry-run', title: 'T', plan: { mode: 'publish_now' }, audio }, { ...context, dryRun: true })
    ).toMatch(/^\[dry-run\] castos test 2026-11-03 "T": would be published now; audio/);
  });

  test('skipped and exists', () => {
    expect(formatResult({ status: 'skipped', reason: 'Shabbos' }, context)).toBe('[live] castos test 2026-11-03: skipped, Shabbos');
    expect(formatResult({ status: 'exists', title: 'T', episodeId: 4 }, context)).toMatch(/already on Castos \(episode 4\)/);
  });
});

describe('main', () => {
  const content = { date: { gregorian_date: '2026-11-03' }, time4mishna: [], time4nach: [] };

  const makeDeps = (overrides = {}) => ({
    env: { BUCKET_PATH: 'https://bucket/' },
    now: new Date('2026-11-02T21:00:00Z'),
    getCastosConfig: jest.fn().mockReturnValue({
      apiKey: 'secret-key',
      testPodcastId: '72963',
      livePodcastId: null,
      publishTime: '05:15',
      timeZone: 'Europe/London',
    }),
    getEmailConfig: jest.fn().mockReturnValue({ bucketUrl: 'https://bucket' }),
    getDailyContent: jest.fn().mockResolvedValue(content),
    createCastosClient: jest.fn().mockReturnValue({ fake: true }),
    publishDailyEpisode: jest.fn().mockResolvedValue({ status: 'skipped', reason: 'chazara' }),
    closePool: jest.fn().mockResolvedValue(),
    log: jest.fn(),
    error: jest.fn(),
    ...overrides,
  });

  test('runs a dry run on the test show by default', async () => {
    const deps = makeDeps();
    await expect(main(['--date=2026-11-03'], deps)).resolves.toBe(0);
    expect(deps.createCastosClient).toHaveBeenCalledWith({ apiKey: 'secret-key' });
    expect(deps.publishDailyEpisode).toHaveBeenCalledWith(
      expect.objectContaining({ podcastId: '72963', dryRun: true, bucketUrl: 'https://bucket', publishTime: '05:15' })
    );
    expect(deps.log).toHaveBeenCalledWith('[dry-run] castos test 2026-11-03: skipped, chazara');
    expect(deps.closePool).toHaveBeenCalled();
  });

  test('never logs the API key', async () => {
    const deps = makeDeps({ publishDailyEpisode: jest.fn().mockRejectedValue(new Error('boom')) });
    await main(['--dry-run=false'], deps);
    const output = [...deps.log.mock.calls, ...deps.error.mock.calls].flat().join('\n');
    expect(output).not.toContain('secret-key');
  });

  test('--help prints usage without touching config', async () => {
    const deps = makeDeps();
    await expect(main(['--help'], deps)).resolves.toBe(0);
    expect(deps.getCastosConfig).not.toHaveBeenCalled();
    expect(deps.closePool).not.toHaveBeenCalled();
  });

  test('config error → exit 2', async () => {
    const deps = makeDeps({ getCastosConfig: jest.fn(() => { throw new Error('Invalid Castos config: x'); }) });
    await expect(main([], deps)).resolves.toBe(2);
    expect(deps.error).toHaveBeenCalledWith('Invalid Castos config: x');
  });

  test('--podcast=live without CASTOS_LIVE_PODCAST_ID → exit 2', async () => {
    const deps = makeDeps();
    await expect(main(['--podcast=live'], deps)).resolves.toBe(2);
    expect(deps.publishDailyEpisode).not.toHaveBeenCalled();
  });

  test('missing BUCKET_PATH → exit 2', async () => {
    const deps = makeDeps({ getEmailConfig: jest.fn().mockReturnValue({ bucketUrl: null }) });
    await expect(main([], deps)).resolves.toBe(2);
  });

  test('date not in dates_table → exit 1', async () => {
    const deps = makeDeps({ getDailyContent: jest.fn().mockResolvedValue(null) });
    await expect(main(['--date=2030-01-01'], deps)).resolves.toBe(1);
    expect(deps.closePool).toHaveBeenCalled();
  });

  test('failure → exit 1, including a Castos 400', async () => {
    const castos400 = Object.assign(new Error('Castos POST … returned 400'), { name: 'CastosError', status: 400 });
    const deps = makeDeps({ publishDailyEpisode: jest.fn().mockRejectedValue(castos400) });
    await expect(main(['--dry-run=false'], deps)).resolves.toBe(1);
    expect(deps.error).toHaveBeenCalledWith(expect.stringMatching(/^\[live\] castos test .* FAILED: Castos POST/));
  });
});
