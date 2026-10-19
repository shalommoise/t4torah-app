const {
  DEFAULTS,
  getMailchimpConfig,
  hasMailchimpConfig,
  serverPrefixFromKey,
} = require('../src/config/mailchimp');

const validEnv = (overrides) => ({
  MAILCHIMP_API_KEY: 'abc123-us21',
  MAILCHIMP_AUDIENCE_ID: 'list1',
  MAILCHIMP_FROM_NAME: 'Time4Mishna',
  MAILCHIMP_REPLY_TO: 'info@example.org',
  ...overrides,
});

describe('getMailchimpConfig', () => {
  test('reads a valid config, deriving the server prefix and defaulting the send time', () => {
    expect(getMailchimpConfig(validEnv())).toEqual({
      apiKey: 'abc123-us21',
      serverPrefix: 'us21',
      audienceId: 'list1',
      fromName: 'Time4Mishna',
      replyTo: 'info@example.org',
      sendTime: '05:15',
      sendTimeZone: 'Europe/London',
    });
    expect(DEFAULTS).toEqual({ SEND_TIME: '05:15', SEND_TIMEZONE: 'Europe/London' });
  });

  test('an explicit MAILCHIMP_SERVER_PREFIX wins over the key suffix', () => {
    expect(getMailchimpConfig(validEnv({ MAILCHIMP_SERVER_PREFIX: 'us6' })).serverPrefix).toBe('us6');
    expect(
      getMailchimpConfig(validEnv({ MAILCHIMP_API_KEY: 'nosuffix', MAILCHIMP_SERVER_PREFIX: 'us6' })).serverPrefix
    ).toBe('us6');
  });

  test('lists every missing required variable in one error', () => {
    expect(() => getMailchimpConfig({})).toThrow(
      'Invalid Mailchimp config: MAILCHIMP_API_KEY is required; MAILCHIMP_AUDIENCE_ID is required; ' +
        'MAILCHIMP_FROM_NAME is required; MAILCHIMP_REPLY_TO is required'
    );
  });

  test('treats blank values as missing', () => {
    expect(() => getMailchimpConfig(validEnv({ MAILCHIMP_AUDIENCE_ID: '  ' }))).toThrow(
      'MAILCHIMP_AUDIENCE_ID is required'
    );
  });

  test('needs a server prefix when the key has none', () => {
    expect(() => getMailchimpConfig(validEnv({ MAILCHIMP_API_KEY: 'nosuffix' }))).toThrow(
      'MAILCHIMP_SERVER_PREFIX is required'
    );
    expect(() => getMailchimpConfig(validEnv({ MAILCHIMP_SERVER_PREFIX: 'us21.example' }))).toThrow(
      'MAILCHIMP_SERVER_PREFIX must look like us21'
    );
  });

  test('rejects a reply-to that is not an email address', () => {
    expect(() => getMailchimpConfig(validEnv({ MAILCHIMP_REPLY_TO: 'nope' }))).toThrow(
      'MAILCHIMP_REPLY_TO must be an email address'
    );
  });

  test.each(['5:15', '05:10', '24:00', '05:15:00'])('rejects SEND_TIME %p', (sendTime) => {
    expect(() => getMailchimpConfig(validEnv({ SEND_TIME: sendTime }))).toThrow('SEND_TIME must be HH:MM');
  });

  test('accepts another quarter-hour time and time zone', () => {
    expect(getMailchimpConfig(validEnv({ SEND_TIME: '06:45', SEND_TIMEZONE: 'Asia/Jerusalem' }))).toMatchObject({
      sendTime: '06:45',
      sendTimeZone: 'Asia/Jerusalem',
    });
  });

  test('rejects an unknown time zone', () => {
    expect(() => getMailchimpConfig(validEnv({ SEND_TIMEZONE: 'Mars/Olympus' }))).toThrow(
      'SEND_TIMEZONE must be an IANA time zone'
    );
  });
});

describe('hasMailchimpConfig', () => {
  test('is true only when a MAILCHIMP_* variable is set', () => {
    expect(hasMailchimpConfig({})).toBe(false);
    expect(hasMailchimpConfig({ SEND_TIME: '05:15', MAILCHIMP_API_KEY: ' ' })).toBe(false);
    expect(hasMailchimpConfig({ MAILCHIMP_AUDIENCE_ID: 'list1' })).toBe(true);
  });
});

describe('serverPrefixFromKey', () => {
  test('takes the -<prefix> suffix', () => {
    expect(serverPrefixFromKey('abc-us21')).toBe('us21');
    expect(serverPrefixFromKey('abc')).toBeNull();
    expect(serverPrefixFromKey(undefined)).toBeNull();
  });
});
