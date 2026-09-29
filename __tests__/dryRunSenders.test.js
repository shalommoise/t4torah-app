const fs = require('fs');
const os = require('os');
const path = require('path');
const { createConsoleSender } = require('../src/services/senders/consoleSender');
const { createFileSender } = require('../src/services/senders/fileSender');
const { getSenders, assertSender } = require('../src/services/senders');

const message = (overrides) => ({
  date: '2026-09-28',
  program: 'time4mishna',
  email: { subject: 'Time4Mishna – Monday 28 Sep | 17 Tishrei', html: '<p>שלום</p>', text: 'Brachos 1:1–1:4\n' },
  whatsapp: { text: '*Time4Mishna*\n*Brachos 1:1–1:4*' },
  ...overrides,
});

describe('createConsoleSender', () => {
  test('logs an email summary and returns ok', async () => {
    const logger = { log: jest.fn() };
    const sender = assertSender(createConsoleSender('email', { logger }));
    expect(sender).toMatchObject({ name: 'console-email', channel: 'email' });

    await expect(sender.send(message())).resolves.toEqual({
      ok: true,
      id: 'console-email-time4mishna-2026-09-28',
    });
    expect(logger.log).toHaveBeenCalledWith(
      '[dry-run] email time4mishna 2026-09-28: "Time4Mishna – Monday 28 Sep | 17 Tishrei" (16 chars text, 11 chars html)'
    );
  });

  test('logs a WhatsApp summary', async () => {
    const logger = { log: jest.fn() };
    await createConsoleSender('whatsapp', { logger }).send(message());
    expect(logger.log).toHaveBeenCalledWith('[dry-run] whatsapp time4mishna 2026-09-28: (31 chars)');
  });

  test('returns ok: false instead of throwing on a malformed message', async () => {
    const logger = { log: jest.fn() };
    const result = await createConsoleSender('email', { logger }).send({ date: '2026-09-28' });
    expect(result.ok).toBe(false);
    expect(result.error).toEqual(expect.any(String));
    expect(logger.log).not.toHaveBeenCalled();
  });
});

describe('createFileSender', () => {
  let outboxDir;

  beforeEach(() => {
    outboxDir = fs.mkdtempSync(path.join(os.tmpdir(), 'outbox-test-'));
  });

  afterEach(() => {
    fs.rmSync(outboxDir, { recursive: true, force: true });
  });

  test('writes email html and txt to outbox/<date>/', async () => {
    const sender = assertSender(createFileSender('email', { outboxDir }));
    expect(sender).toMatchObject({ name: 'file-email', channel: 'email' });

    const result = await sender.send(message());
    const dayDir = path.join(outboxDir, '2026-09-28');
    expect(result).toEqual({ ok: true, id: path.join(dayDir, 'email-time4mishna.html') });
    expect(fs.readFileSync(path.join(dayDir, 'email-time4mishna.html'), 'utf8')).toBe('<p>שלום</p>');
    expect(fs.readFileSync(path.join(dayDir, 'email-time4mishna.txt'), 'utf8')).toBe(
      'Subject: Time4Mishna – Monday 28 Sep | 17 Tishrei\n\nBrachos 1:1–1:4\n'
    );
  });

  test('writes WhatsApp txt only', async () => {
    const result = await createFileSender('whatsapp', { outboxDir }).send(message({ program: 'combined' }));
    const dayDir = path.join(outboxDir, '2026-09-28');
    expect(result).toEqual({ ok: true, id: path.join(dayDir, 'whatsapp-combined.txt') });
    expect(fs.readdirSync(dayDir)).toEqual(['whatsapp-combined.txt']);
    expect(fs.readFileSync(result.id, 'utf8')).toBe('*Time4Mishna*\n*Brachos 1:1–1:4*');
  });

  test('overwrites on re-run', async () => {
    const sender = createFileSender('whatsapp', { outboxDir });
    await sender.send(message());
    const result = await sender.send(message({ whatsapp: { text: 'second' } }));
    expect(fs.readFileSync(result.id, 'utf8')).toBe('second');
  });

  test('refuses a date or program that would escape the outbox', async () => {
    const sender = createFileSender('whatsapp', { outboxDir });
    const badDate = await sender.send(message({ date: '../../etc' }));
    const badProgram = await sender.send(message({ program: '../x' }));
    expect(badDate.ok).toBe(false);
    expect(badProgram.ok).toBe(false);
    expect(fs.readdirSync(outboxDir)).toEqual([]);
  });

  test('defaults to ./outbox under the working directory', async () => {
    // outboxDir stands in for the working directory so nothing lands in the repo.
    const cwd = jest.spyOn(process, 'cwd').mockReturnValue(outboxDir);
    let sender;
    try {
      sender = createFileSender('whatsapp');
    } finally {
      cwd.mockRestore();
    }
    const result = await sender.send(message());
    expect(result).toEqual({
      ok: true,
      id: path.join(outboxDir, 'outbox', '2026-09-28', 'whatsapp-time4mishna.txt'),
    });
  });
});

describe('default registry', () => {
  test('dry-run (the default) uses console and file senders on both channels', () => {
    expect(getSenders({ logger: { log: jest.fn() } }).map((s) => s.name)).toEqual([
      'console-email',
      'file-email',
      'console-whatsapp',
      'file-whatsapp',
    ]);
  });
});
