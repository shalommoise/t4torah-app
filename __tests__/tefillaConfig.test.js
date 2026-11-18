const {
  getMaxTefillaMode,
  getAllowedTefillaModes,
  getTefillaConfig,
  getTefillaRunConfig,
} = require('../src/config/tefilla');

const fullEnv = (overrides = {}) => ({
  CASTOS_API_KEY: 'castos-key',
  CASTOS_PODCAST_ID: '100',
  CASTOS_TEFILLA_PODCAST_ID: '300',
  MAILCHIMP_API_KEY: 'abc-us21',
  MAILCHIMP_TEFILLA_AUDIENCE_ID: 'tefilla-list',
  MAILCHIMP_TEST_AUDIENCE_ID: 'test-list',
  MAILCHIMP_TEFILLA_FROM_NAME: 'Time4Tefilla',
  MAILCHIMP_TEFILLA_REPLY_TO: 'tefilla@time4torah.org',
  ...overrides,
});

describe('modes', () => {
  test('dry-run by default; each mode allows itself and the safer ones', () => {
    expect(getMaxTefillaMode({})).toBe('dry-run');
    expect(getAllowedTefillaModes({})).toEqual(['dry-run']);
    expect(getAllowedTefillaModes({ TEFILLA_SEND_MODE: 'test' })).toEqual(['dry-run', 'test']);
    expect(getAllowedTefillaModes({ TEFILLA_SEND_MODE: 'live' })).toEqual(['dry-run', 'test', 'live']);
  });

  test('a typo fails loudly', () => {
    expect(() => getMaxTefillaMode({ TEFILLA_SEND_MODE: 'Live' })).toThrow('TEFILLA_SEND_MODE must be one of');
  });
});

describe('getTefillaConfig', () => {
  test('dry-run needs no keys, and uses the daily send times', () => {
    expect(getTefillaConfig('dry-run', {})).toEqual({
      mode: 'dry-run',
      timeZone: 'Europe/London',
      publishTime: '05:15',
      sendTime: '05:15',
      nextDayAfter: '16:00',
      outboxDir: 'outbox',
      castos: null,
      mailchimp: null,
    });
  });

  test('live: the Time4Tefilla show and audience', () => {
    const config = getTefillaConfig('live', fullEnv());
    expect(config.castos).toEqual({ apiKey: 'castos-key', podcastId: '300' });
    expect(config.mailchimp).toMatchObject({
      apiKey: 'abc-us21',
      serverPrefix: 'us21',
      audienceId: 'tefilla-list',
      fromName: 'Time4Tefilla',
      replyTo: 'tefilla@time4torah.org',
    });
  });

  test('test: the Castos test show and the test audience', () => {
    const config = getTefillaConfig('test', fullEnv({ CASTOS_TEFILLA_PODCAST_ID: '' }));
    expect(config.castos.podcastId).toBe('100');
    expect(config.mailchimp.audienceId).toBe('test-list');
  });

  test('live lists every missing variable', () => {
    expect(() => getTefillaConfig('live', {})).toThrow(
      /CASTOS_API_KEY is required.*CASTOS_TEFILLA_PODCAST_ID .* is required for a live send.*MAILCHIMP_TEFILLA_AUDIENCE_ID is required.*MAILCHIMP_TEFILLA_FROM_NAME is required.*MAILCHIMP_TEFILLA_REPLY_TO is required.*MAILCHIMP_API_KEY is required/
    );
  });

  test('TEFILLA_NEXT_DAY_AFTER can move the cutoff', () => {
    expect(getTefillaConfig('live', fullEnv({ TEFILLA_NEXT_DAY_AFTER: '21:00' })).nextDayAfter).toBe('21:00');
  });

  test('test needs the test audience', () => {
    expect(() => getTefillaConfig('test', fullEnv({ MAILCHIMP_TEST_AUDIENCE_ID: '' }))).toThrow(
      'MAILCHIMP_TEST_AUDIENCE_ID is required for a test send'
    );
  });

  test.each([
    ['the test audience is the live one', { MAILCHIMP_TEST_AUDIENCE_ID: 'tefilla-list' }, 'must not be the Time4Tefilla audience'],
    ['the test show is the live one', { CASTOS_TEFILLA_PODCAST_ID: '100' }, 'must be different shows'],
    ['the show id is not a number', { CASTOS_TEFILLA_PODCAST_ID: 'abc' }, 'CASTOS_TEFILLA_PODCAST_ID must be a number'],
    ['a bad reply-to', { MAILCHIMP_TEFILLA_REPLY_TO: 'nope' }, 'MAILCHIMP_TEFILLA_REPLY_TO must be an email address'],
    [
      'the episode would come out after the email',
      { CASTOS_PUBLISH_TIME: '05:30', SEND_TIME: '05:15' },
      'CASTOS_PUBLISH_TIME (05:30) must not be later than SEND_TIME (05:15)',
    ],
    ['a bad next-day cutoff', { TEFILLA_NEXT_DAY_AFTER: '4pm' }, 'TEFILLA_NEXT_DAY_AFTER must be HH:MM, e.g. 16:00 (got "4pm")'],
    [
      'the next-day cutoff is before the send time',
      { TEFILLA_NEXT_DAY_AFTER: '05:00' },
      'TEFILLA_NEXT_DAY_AFTER (05:00) must be later than SEND_TIME (05:15)',
    ],
  ])('refuses when %s', (_name, overrides, message) => {
    expect(() => getTefillaConfig('live', fullEnv(overrides))).toThrow(message);
  });

  test('never puts an API key in an error', () => {
    try {
      getTefillaConfig('live', fullEnv({ MAILCHIMP_TEFILLA_AUDIENCE_ID: '', MAILCHIMP_API_KEY: 'secret-key-us21' }));
      throw new Error('expected a config error');
    } catch (error) {
      expect(error.message).not.toContain('secret-key');
      expect(error.message).not.toContain('castos-key');
    }
  });
});

describe('getTefillaRunConfig', () => {
  test('defaults to dry-run', () => {
    expect(getTefillaRunConfig(undefined, {}).mode).toBe('dry-run');
    expect(getTefillaRunConfig('', {}).mode).toBe('dry-run');
  });

  test('403 for a mode above TEFILLA_SEND_MODE', () => {
    expect(() => getTefillaRunConfig('live', fullEnv({ TEFILLA_SEND_MODE: 'test' }))).toThrow(
      expect.objectContaining({ status: 403, message: 'mode "live" is not allowed on this server (TEFILLA_SEND_MODE is "test")' })
    );
  });

  test('400 for an unknown mode', () => {
    expect(() => getTefillaRunConfig('production', {})).toThrow(expect.objectContaining({ status: 400 }));
  });

  test('503 for a server config problem', () => {
    expect(() => getTefillaRunConfig('live', { TEFILLA_SEND_MODE: 'live' })).toThrow(expect.objectContaining({ status: 503 }));
    expect(() => getTefillaRunConfig('dry-run', { TEFILLA_SEND_MODE: 'oops' })).toThrow(expect.objectContaining({ status: 503 }));
  });
});
