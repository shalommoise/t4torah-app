const {
  NOT_IMPLEMENTED,
  createEmailProviderSender,
  createWhatsappProviderSender,
} = require('../src/services/senders/providerSenders');
const { getSenders, assertSender } = require('../src/services/senders');

const message = {
  date: '2026-09-28',
  program: 'time4mishna',
  email: { subject: 's', html: '<p>h</p>', text: 't' },
  whatsapp: { text: 'w' },
};

describe('provider stub senders', () => {
  test.each([
    [createEmailProviderSender, 'emailProviderSender', 'email'],
    [createWhatsappProviderSender, 'whatsappProviderSender', 'whatsapp'],
  ])('%p implements the Sender interface and always rejects', async (create, name, channel) => {
    const sender = assertSender(create({}));
    expect(sender).toMatchObject({ name, channel });
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
    expect(names(getSenders({ mode: 'dry-run', logger }))).not.toEqual(
      expect.arrayContaining(['emailProviderSender'])
    );
  });

  test('SEND_MODE in the environment alone does not select live senders', () => {
    process.env.SEND_MODE = 'live';
    expect(names(getSenders({ logger }))).not.toContain('emailProviderSender');
    expect(names(getSenders({ logger }))).not.toContain('whatsappProviderSender');
  });

  test('live mode selects only the provider stubs', () => {
    expect(names(getSenders({ mode: 'live' }))).toEqual(['emailProviderSender', 'whatsappProviderSender']);
    expect(names(getSenders({ mode: 'live', channels: ['whatsapp'] }))).toEqual(['whatsappProviderSender']);
  });

  test('live mode without a provider fails loudly on every send', async () => {
    const results = await Promise.allSettled(getSenders({ mode: 'live' }).map((s) => s.send(message)));
    expect(results.map((r) => r.status)).toEqual(['rejected', 'rejected']);
    results.forEach((r) => expect(r.reason.message).toBe(NOT_IMPLEMENTED));
  });
});
