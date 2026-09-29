const {
  CHANNELS,
  DEFAULT_MODE,
  assertSender,
  getSenders,
} = require('../src/services/senders');

const fakeSender = (name, channel) => ({
  name,
  channel,
  send: jest.fn().mockResolvedValue({ ok: true, id: `${name}-1` }),
});

const registry = () => ({
  'dry-run': {
    email: [() => fakeSender('dry-email', 'email')],
    whatsapp: [() => fakeSender('dry-whatsapp', 'whatsapp')],
  },
  live: {
    email: [() => fakeSender('live-email', 'email')],
    whatsapp: [() => fakeSender('live-whatsapp', 'whatsapp')],
  },
});

describe('assertSender', () => {
  test('accepts a valid sender', () => {
    const sender = fakeSender('x', 'email');
    expect(assertSender(sender)).toBe(sender);
  });

  test.each([
    ['missing', undefined],
    ['no name', { channel: 'email', send: () => {} }],
    ['unknown channel', { name: 'x', channel: 'sms', send: () => {} }],
    ['no send', { name: 'x', channel: 'email' }],
  ])('rejects %s', (_name, sender) => {
    expect(() => assertSender(sender)).toThrow(TypeError);
  });
});

describe('getSenders', () => {
  test('defaults to dry-run on all channels', () => {
    expect(DEFAULT_MODE).toBe('dry-run');
    expect(CHANNELS).toEqual(['email', 'whatsapp']);
    expect(getSenders({}, registry()).map((s) => s.name)).toEqual(['dry-email', 'dry-whatsapp']);
    expect(getSenders(undefined, registry()).map((s) => s.name)).toEqual(['dry-email', 'dry-whatsapp']);
  });

  test('only uses live senders when mode is exactly "live"', () => {
    expect(getSenders({ mode: 'live' }, registry()).map((s) => s.name)).toEqual([
      'live-email',
      'live-whatsapp',
    ]);
  });

  test('filters by channel', () => {
    expect(getSenders({ channels: ['whatsapp'] }, registry()).map((s) => s.name)).toEqual(['dry-whatsapp']);
    expect(getSenders({ channels: [] }, registry())).toEqual([]);
  });

  test('passes config to each factory', () => {
    const factory = jest.fn(() => fakeSender('dry-email', 'email'));
    const config = { channels: ['email'], outboxDir: '/tmp/outbox' };
    getSenders(config, { 'dry-run': { email: [factory], whatsapp: [] } });
    expect(factory).toHaveBeenCalledWith(config);
  });

  test('throws on an unknown mode or channel', () => {
    expect(() => getSenders({ mode: 'LIVE' }, registry())).toThrow('Unknown send mode: LIVE');
    expect(() => getSenders({ mode: '' }, registry())).toThrow('Unknown send mode');
    expect(() => getSenders({ channels: ['sms'] }, registry())).toThrow('Unknown channel: sms');
  });

  test('throws when a factory returns an invalid sender or the wrong channel', () => {
    expect(() => getSenders({}, { 'dry-run': { email: [() => ({ name: 'x' })], whatsapp: [] } })).toThrow(TypeError);
    expect(() =>
      getSenders({}, { 'dry-run': { email: [() => fakeSender('x', 'whatsapp')], whatsapp: [] } })
    ).toThrow('registered for email but has channel whatsapp');
  });
});
