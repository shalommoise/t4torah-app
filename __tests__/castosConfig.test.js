const { getCastosConfig } = require('../src/config/castos');

const env = (overrides = {}) => ({ CASTOS_API_KEY: 'key-abc', CASTOS_PODCAST_ID: '72963', ...overrides });

describe('getCastosConfig', () => {
  test('reads the settings, with defaults', () => {
    expect(getCastosConfig(env())).toEqual({
      apiKey: 'key-abc',
      testPodcastId: '72963',
      livePodcastId: null,
      publishTime: '05:15',
      timeZone: 'Europe/London',
    });
  });

  test('reads the live show, publish time and time zone', () => {
    expect(
      getCastosConfig(
        env({ CASTOS_LIVE_PODCAST_ID: ' 33558 ', CASTOS_PUBLISH_TIME: '05:05', SEND_TIMEZONE: 'America/New_York' })
      )
    ).toMatchObject({ livePodcastId: '33558', publishTime: '05:05', timeZone: 'America/New_York' });
  });

  test('lists every problem at once, without the key value', () => {
    let message = '';
    try {
      getCastosConfig({
        CASTOS_PODCAST_ID: 'abc',
        CASTOS_LIVE_PODCAST_ID: 'x',
        CASTOS_PUBLISH_TIME: '5:15',
        SEND_TIMEZONE: 'Mars/Base',
      });
    } catch (error) {
      ({ message } = error);
    }
    expect(message).toMatch(/CASTOS_API_KEY is required/);
    expect(message).toMatch(/CASTOS_PODCAST_ID must be a number/);
    expect(message).toMatch(/CASTOS_LIVE_PODCAST_ID must be a number/);
    expect(message).toMatch(/CASTOS_PUBLISH_TIME must be HH:MM/);
    expect(message).toMatch(/SEND_TIMEZONE must be an IANA time zone/);
  });

  test('requires the test podcast', () => {
    expect(() => getCastosConfig(env({ CASTOS_PODCAST_ID: '' }))).toThrow(/CASTOS_PODCAST_ID \(the test show\) is required/);
  });

  test('test and live must be different shows', () => {
    expect(() => getCastosConfig(env({ CASTOS_LIVE_PODCAST_ID: '72963' }))).toThrow(/must be different shows/);
  });

  test('never includes the key in an error', () => {
    expect(() => getCastosConfig(env({ CASTOS_API_KEY: 'super-secret', CASTOS_PODCAST_ID: 'bad' }))).toThrow(
      expect.objectContaining({ message: expect.not.stringContaining('super-secret') })
    );
  });
});
