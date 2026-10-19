const { DEFAULTS, getSendConfig } = require('../src/config/send');
const { getSenders } = require('../src/services/senders');

const MAILCHIMP = {
  apiKey: 'key-us21',
  serverPrefix: 'us21',
  audienceId: 'list1',
  fromName: 'Time4Mishna',
  replyTo: 'info@example.org',
  sendTime: '05:15',
  sendTimeZone: 'Europe/London',
};

describe('getSendConfig', () => {
  test('defaults to dry-run on all channels and both programs', () => {
    expect(getSendConfig({})).toEqual({
      mode: 'dry-run',
      channels: ['email', 'whatsapp'],
      programs: ['time4mishna', 'time4nach'],
      outboxDir: 'outbox',
    });
    expect(DEFAULTS.SEND_MODE).toBe('dry-run');
  });

  test('treats blank values as unset', () => {
    expect(
      getSendConfig({ SEND_MODE: '  ', SEND_CHANNELS: '', SEND_PROGRAMS: ' ', OUTBOX_DIR: '' })
    ).toEqual(getSendConfig({}));
  });

  test('reads every variable', () => {
    expect(
      getSendConfig({
        SEND_MODE: 'live',
        SEND_CHANNELS: 'whatsapp',
        SEND_PROGRAMS: 'combined',
        OUTBOX_DIR: '/var/outbox',
      })
    ).toEqual({ mode: 'live', channels: ['whatsapp'], programs: ['combined'], outboxDir: '/var/outbox' });
  });

  test('trims and de-duplicates lists', () => {
    const config = getSendConfig({ SEND_CHANNELS: ' email , email,whatsapp ,', SEND_PROGRAMS: 'time4nach, ' });
    expect(config.channels).toEqual(['email', 'whatsapp']);
    expect(config.programs).toEqual(['time4nach']);
  });

  test.each(['Live', 'LIVE', 'production', 'dryrun'])('throws on SEND_MODE=%s', (mode) => {
    expect(() => getSendConfig({ SEND_MODE: mode })).toThrow('SEND_MODE must be one of: dry-run, live');
  });

  test('throws on unknown channels or programs', () => {
    expect(() => getSendConfig({ SEND_CHANNELS: 'email,sms' })).toThrow('SEND_CHANNELS has unknown value(s): sms');
    expect(() => getSendConfig({ SEND_PROGRAMS: 'daf-yomi' })).toThrow('SEND_PROGRAMS has unknown value(s): daf-yomi');
  });

  test('throws on a list with no entries', () => {
    expect(() => getSendConfig({ SEND_CHANNELS: ',' })).toThrow('SEND_CHANNELS must list at least one of');
  });

  test('reads process.env by default', () => {
    const original = process.env.SEND_CHANNELS;
    process.env.SEND_CHANNELS = 'whatsapp';
    try {
      expect(getSendConfig().channels).toEqual(['whatsapp']);
    } finally {
      if (original === undefined) {
        delete process.env.SEND_CHANNELS;
      } else {
        process.env.SEND_CHANNELS = original;
      }
    }
  });

  test('output plugs into getSenders', () => {
    const names = (config) => getSenders({ ...config, logger: { log: jest.fn() } }).map((s) => s.name);
    expect(names(getSendConfig({ SEND_CHANNELS: 'email' }))).toEqual(['console-email', 'file-email']);
    expect(names({ ...getSendConfig({ SEND_MODE: 'live' }), mailchimp: MAILCHIMP })).toEqual([
      'mailchimp-email',
      'whatsappProviderSender',
    ]);
  });
});
