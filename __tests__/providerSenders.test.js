const { NOT_IMPLEMENTED, createWhatsappProviderSender } = require('../src/services/senders/providerSenders');
const { getSenders, assertSender } = require('../src/services/senders');

const MAILCHIMP = {
  apiKey: 'key-us21',
  serverPrefix: 'us21',
  audienceId: 'list1',
  fromName: 'Time4Mishna',
  replyTo: 'info@example.org',
  sendTime: '05:15',
  sendTimeZone: 'Europe/London',
};

const message = {
  date: '2026-09-28',
  program: 'time4mishna',
  email: { subject: 's', html: '<p>h</p>', text: 't' },
  whatsapp: { text: 'w' },
};

describe('provider stub senders', () => {
  test('the WhatsApp stub implements the Sender interface and always rejects', async () => {
    const sender = assertSender(createWhatsappProviderSender({}));
    expect(sender).toMatchObject({ name: 'whatsappProviderSender', channel: 'whatsapp' });
    await expect(sender.send(message)).rejects.toThrow('Not implemented: provider not chosen');
  });

  test('error message is the documented one', () => {
    expect(NOT_IMPLEMENTED).toBe('Not implemented: provider not chosen');
  });
});

describe('mode selection', () => {
  const originalSendMode = process.env.SEND_MODE;

  afterEach(() => {
    if (originalSendMode === undefined) {
      delete process.env.SEND_MODE;
    } else {
      process.env.SEND_MODE = originalSendMode;
    }
  });

  const names = (senders) => senders.map((s) => s.name);
  const logger = { log: jest.fn() };

  test('dry-run is the default and never includes provider senders', () => {
    expect(names(getSenders({ logger }))).toEqual([
      'console-email',
      'file-email',
      'console-whatsapp',
      'file-whatsapp',
    ]);
    expect(names(getSenders({ mode: 'dry-run', logger, mailchimp: MAILCHIMP }))).not.toContain('mailchimp-email');
  });

  test('dry-run adds the offline Mailchimp preview only when Mailchimp is configured', () => {
    expect(names(getSenders({ logger, channels: ['email'], mailchimp: MAILCHIMP }))).toEqual([
      'console-email',
      'file-email',
      'mailchimp-preview',
    ]);
  });

  test('SEND_MODE in the environment alone does not select live senders', () => {
    process.env.SEND_MODE = 'live';
    expect(names(getSenders({ logger, mailchimp: MAILCHIMP }))).not.toContain('mailchimp-email');
    expect(names(getSenders({ logger }))).not.toContain('whatsappProviderSender');
  });

  test('live mode selects Mailchimp for email and the stub for WhatsApp', () => {
    expect(names(getSenders({ mode: 'live', mailchimp: MAILCHIMP }))).toEqual([
      'mailchimp-email',
      'whatsappProviderSender',
    ]);
    expect(names(getSenders({ mode: 'live', channels: ['whatsapp'] }))).toEqual(['whatsappProviderSender']);
  });

  test('live email without Mailchimp config fails before anything is sent', () => {
    expect(() => getSenders({ mode: 'live', channels: ['email'] })).toThrow('Mailchimp sender needs config.mailchimp');
  });

  test('live WhatsApp without a provider fails loudly', async () => {
    const [sender] = getSenders({ mode: 'live', channels: ['whatsapp'] });
    await expect(sender.send(message)).rejects.toThrow(NOT_IMPLEMENTED);
  });
});
