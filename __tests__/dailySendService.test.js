const fs = require('fs');
const os = require('os');
const path = require('path');
const { getDailyContent } = require('../src/services/dailyContentService');
const { getSenders } = require('../src/services/senders');
const { runDailySend } = require('../src/services/dailySendService');

jest.mock('../src/services/dailyContentService', () => ({
  getDailyContent: jest.fn(),
}));

jest.mock('../src/services/senders', () => ({
  ...jest.requireActual('../src/services/senders'),
  getSenders: jest.fn(),
}));

const dateRow = (overrides) => ({
  date_id: 1,
  gregorian_date: '2026-09-28',
  hebrew_date: '17 Tishrei 5787',
  hebrew_date_he: 'י״ז תשרי תשפ״ז',
  day_of_week: 'Monday',
  is_yom_tov: 0,
  special_date: null,
  ...overrides,
});

const content = (overrides) => ({
  date: dateRow(),
  time4mishna: [
    {
      shiur_type: 'regular',
      start_masechta_id: 1,
      start_masechta_name: 'Brachos',
      start_perek: 1,
      start_mishna_number: 1,
      end_masechta_id: 1,
      end_masechta_name: 'Brachos',
      end_perek: 1,
      end_mishna_number: 4,
      additional_notice: null,
    },
  ],
  time4nach: [{ shiur_type: 'regular', sefer_name: 'Tehillim', perek: 42, additional_notice: null }],
  ...overrides,
});

const fakeSender = (name, channel, send) => ({
  name,
  channel,
  send: jest.fn(send || (async (message) => ({ ok: true, id: `${name}-${message.program}` }))),
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('runDailySend', () => {
  test('renders each program once and sends it via every sender', async () => {
    getDailyContent.mockResolvedValue(content());
    const email = fakeSender('fake-email', 'email');
    const whatsapp = fakeSender('fake-whatsapp', 'whatsapp');
    getSenders.mockReturnValue([email, whatsapp]);

    const report = await runDailySend({ date: '2026-09-28' });

    expect(getDailyContent).toHaveBeenCalledWith('2026-09-28');
    expect(report).toEqual({
      date: '2026-09-28',
      mode: 'dry-run',
      status: 'sent',
      ok: true,
      results: [
        { program: 'time4mishna', channel: 'email', sender: 'fake-email', ok: true, id: 'fake-email-time4mishna' },
        { program: 'time4mishna', channel: 'whatsapp', sender: 'fake-whatsapp', ok: true, id: 'fake-whatsapp-time4mishna' },
        { program: 'time4nach', channel: 'email', sender: 'fake-email', ok: true, id: 'fake-email-time4nach' },
        { program: 'time4nach', channel: 'whatsapp', sender: 'fake-whatsapp', ok: true, id: 'fake-whatsapp-time4nach' },
      ],
    });

    const mishnaMessage = email.send.mock.calls[0][0];
    expect(mishnaMessage).toMatchObject({ date: '2026-09-28', program: 'time4mishna' });
    expect(mishnaMessage.email.subject).toBe('Time4Mishna – Monday 28 Sep | 17 Tishrei');
    expect(mishnaMessage.email.html).toContain('Brachos 1:1–1:4');
    expect(mishnaMessage.whatsapp.text).toContain('*Brachos 1:1–1:4*');
    expect(whatsapp.send.mock.calls[0][0]).toBe(mishnaMessage);
  });

  test('defaults to dry-run and passes options to getSenders', async () => {
    getDailyContent.mockResolvedValue(content());
    getSenders.mockReturnValue([]);
    const logger = { log: jest.fn() };

    await runDailySend({ date: '2026-09-28', channels: ['email'], outboxDir: '/tmp/x', logger });

    expect(getSenders).toHaveBeenCalledWith({ mode: 'dry-run', channels: ['email'], outboxDir: '/tmp/x', logger });
  });

  test.each([undefined, true, 'false', 0, null])('dryRun=%p stays dry-run', async (dryRun) => {
    getDailyContent.mockResolvedValue(content());
    getSenders.mockReturnValue([]);
    const report = await runDailySend({ date: '2026-09-28', dryRun });
    expect(report.mode).toBe('dry-run');
    expect(getSenders.mock.calls[0][0].mode).toBe('dry-run');
  });

  test('dryRun=false selects live mode', async () => {
    getDailyContent.mockResolvedValue(content());
    getSenders.mockReturnValue([]);
    const report = await runDailySend({ date: '2026-09-28', dryRun: false });
    expect(report.mode).toBe('live');
    expect(getSenders.mock.calls[0][0].mode).toBe('live');
  });

  test('only sends the requested programs', async () => {
    getDailyContent.mockResolvedValue(content());
    const sender = fakeSender('fake-email', 'email');
    getSenders.mockReturnValue([sender]);

    const report = await runDailySend({ date: '2026-09-28', programs: ['combined'] });

    expect(report.results).toEqual([
      { program: 'combined', channel: 'email', sender: 'fake-email', ok: true, id: 'fake-email-combined' },
    ]);
    expect(sender.send.mock.calls[0][0].email.subject).toMatch(/^Time4Mishna & Time4Nach – /);
  });

  test('one sender rejecting or reporting failure does not stop the others', async () => {
    getDailyContent.mockResolvedValue(content());
    const rejecting = fakeSender('rejecting', 'email', async () => {
      throw new Error('Not implemented: provider not chosen');
    });
    const failing = fakeSender('failing', 'whatsapp', async () => ({ ok: false, error: 'quota exceeded' }));
    const empty = fakeSender('empty', 'whatsapp', async () => undefined);
    const working = fakeSender('working', 'email');
    getSenders.mockReturnValue([rejecting, failing, empty, working]);

    const report = await runDailySend({ date: '2026-09-28', programs: ['time4mishna'] });

    expect(report.status).toBe('partial');
    expect(report.ok).toBe(false);
    expect(report.results).toEqual([
      { program: 'time4mishna', channel: 'email', sender: 'rejecting', ok: false, error: 'Not implemented: provider not chosen' },
      { program: 'time4mishna', channel: 'whatsapp', sender: 'failing', ok: false, error: 'quota exceeded' },
      { program: 'time4mishna', channel: 'whatsapp', sender: 'empty', ok: false, error: 'Sender reported failure' },
      { program: 'time4mishna', channel: 'email', sender: 'working', ok: true, id: 'working-time4mishna' },
    ]);
    expect(working.send).toHaveBeenCalledTimes(1);
  });

  test('status is failed when every send fails', async () => {
    getDailyContent.mockResolvedValue(content());
    getSenders.mockReturnValue([fakeSender('x', 'email', async () => ({ ok: false, error: 'nope' }))]);
    const report = await runDailySend({ date: '2026-09-28', programs: ['time4nach'] });
    expect(report).toMatchObject({ status: 'failed', ok: false });
  });

  test('status is failed when there are no senders', async () => {
    getDailyContent.mockResolvedValue(content());
    getSenders.mockReturnValue([]);
    const report = await runDailySend({ date: '2026-09-28' });
    expect(report).toMatchObject({ status: 'failed', ok: false, results: [] });
  });

  test('a render failure fails that program only', async () => {
    // An unknown program fails to render; the next program still sends.
    getDailyContent.mockResolvedValue(content());
    const sender = fakeSender('fake-email', 'email');
    getSenders.mockReturnValue([sender]);

    const report = await runDailySend({ date: '2026-09-28', programs: ['daf-yomi', 'time4nach'] });

    expect(report.status).toBe('partial');
    expect(report.results).toEqual([
      { program: 'daf-yomi', channel: 'email', sender: null, ok: false, error: expect.stringMatching(/^Render failed: /) },
      { program: 'time4nach', channel: 'email', sender: 'fake-email', ok: true, id: 'fake-email-time4nach' },
    ]);
    expect(sender.send).toHaveBeenCalledTimes(1);
  });

  test('skips Shabbos and Yom Tov without calling senders', async () => {
    getSenders.mockReturnValue([fakeSender('x', 'email')]);

    getDailyContent.mockResolvedValue(content({ date: dateRow({ day_of_week: 'Shabbos' }) }));
    await expect(runDailySend({ date: '2026-10-03' })).resolves.toEqual({
      date: '2026-10-03',
      mode: 'dry-run',
      status: 'skipped',
      ok: true,
      reason: 'No send on Shabbos or Yom Tov',
      results: [],
    });

    getDailyContent.mockResolvedValue(content({ date: dateRow({ is_yom_tov: 1 }) }));
    await expect(runDailySend({ date: '2026-10-03' })).resolves.toMatchObject({ status: 'skipped', ok: true });

    expect(getSenders).not.toHaveBeenCalled();
  });

  test('reports a date missing from dates_table as not ok', async () => {
    getDailyContent.mockResolvedValue(null);
    await expect(runDailySend({ date: '2030-01-01' })).resolves.toEqual({
      date: '2030-01-01',
      mode: 'dry-run',
      status: 'no-date',
      ok: false,
      reason: '2030-01-01 is not in dates_table',
      results: [],
    });
    expect(getSenders).not.toHaveBeenCalled();
  });

  test('propagates an invalid-date error', async () => {
    const error = Object.assign(new Error('bad date'), { status: 400 });
    getDailyContent.mockRejectedValue(error);
    await expect(runDailySend({ date: 'nope' })).rejects.toBe(error);
  });
});

describe('runDailySend with the real dry-run senders', () => {
  let outboxDir;

  beforeEach(() => {
    outboxDir = fs.mkdtempSync(path.join(os.tmpdir(), 'daily-send-test-'));
    getSenders.mockImplementation(jest.requireActual('../src/services/senders').getSenders);
  });

  afterEach(() => {
    fs.rmSync(outboxDir, { recursive: true, force: true });
  });

  test('writes every channel/program to the outbox and logs to the logger', async () => {
    getDailyContent.mockResolvedValue(content());
    const logger = { log: jest.fn() };

    const report = await runDailySend({ date: '2026-09-28', outboxDir, logger });

    expect(report).toMatchObject({ status: 'sent', ok: true, mode: 'dry-run' });
    expect(report.results).toHaveLength(8);
    expect(fs.readdirSync(path.join(outboxDir, '2026-09-28')).sort()).toEqual([
      'email-time4mishna.html',
      'email-time4mishna.txt',
      'email-time4nach.html',
      'email-time4nach.txt',
      'whatsapp-time4mishna.txt',
      'whatsapp-time4nach.txt',
    ]);
    expect(logger.log).toHaveBeenCalledTimes(4);
  });

  test('live mode fails every send loudly via the provider stubs', async () => {
    getDailyContent.mockResolvedValue(content());
    const report = await runDailySend({ date: '2026-09-28', dryRun: false, outboxDir });
    expect(report).toMatchObject({ mode: 'live', status: 'failed', ok: false });
    expect(report.results).toHaveLength(4);
    report.results.forEach((result) => expect(result.error).toBe('Not implemented: provider not chosen'));
    expect(fs.readdirSync(outboxDir)).toEqual([]);
  });
});
