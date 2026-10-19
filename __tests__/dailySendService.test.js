const fs = require('fs');
const os = require('os');
const path = require('path');
const { getDailyContent } = require('../src/services/dailyContentService');
const { getSenders } = require('../src/services/senders');
const { runDailySend } = require('../src/services/dailySendService');
const {
  claimSendLog,
  reclaimFailedSendLog,
  forceClaimSendLog,
  finishSendLog,
  selectSendLog,
} = require('../src/models/sendLogModel');

const LIVE_EMAIL_CONFIG = { bucketUrl: 'https://bucket.test', assetsUrl: null, unsubscribeUrl: null };

jest.mock('../src/services/dailyContentService', () => ({
  getDailyContent: jest.fn(),
}));

jest.mock('../src/models/sendLogModel', () => ({
  claimSendLog: jest.fn(),
  reclaimFailedSendLog: jest.fn(),
  forceClaimSendLog: jest.fn(),
  finishSendLog: jest.fn(),
  selectSendLog: jest.fn(),
}));

const sendLogFns = () => [claimSendLog, reclaimFailedSendLog, forceClaimSendLog, finishSendLog, selectSendLog];

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
  // Default: nothing logged yet, so every claim succeeds and every finish lands.
  claimSendLog.mockResolvedValue(true);
  reclaimFailedSendLog.mockResolvedValue(false);
  forceClaimSendLog.mockResolvedValue(true);
  finishSendLog.mockResolvedValue(true);
  selectSendLog.mockResolvedValue([]);
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
    const report = await runDailySend({ date: '2026-09-28', dryRun: false, emailConfig: LIVE_EMAIL_CONFIG });
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

describe('runDailySend invalid calendar rows (G1)', () => {
  test.each([
    [{ day_of_week: null }, 'invalid calendar row: unrecognised day_of_week: null'],
    [{ day_of_week: 'Saturday' }, 'invalid calendar row: unrecognised day_of_week: "Saturday"'],
    [{ is_yom_tov: null }, 'invalid calendar row: unrecognised is_yom_tov: null'],
    [{ day_of_week: null, is_yom_tov: null }, 'invalid calendar row: unrecognised day_of_week: null'],
  ])('%p is reported as an error, not a skip, and nothing is sent', async (overrides, reason) => {
    getDailyContent.mockResolvedValue(content({ date: dateRow(overrides) }));
    getSenders.mockReturnValue([fakeSender('x', 'email')]);

    await expect(runDailySend({ date: '2026-09-28' })).resolves.toEqual({
      date: '2026-09-28',
      mode: 'dry-run',
      status: 'invalid-calendar-row',
      ok: false,
      reason,
      results: [],
    });
    expect(getSenders).not.toHaveBeenCalled();
    sendLogFns().forEach((fn) => expect(fn).not.toHaveBeenCalled());
  });

  test('an invalid row is an error even with force', async () => {
    getDailyContent.mockResolvedValue(content({ date: dateRow({ is_yom_tov: undefined }) }));
    getSenders.mockReturnValue([fakeSender('x', 'email')]);
    const report = await runDailySend({ date: '2026-09-28', force: true });
    expect(report).toMatchObject({ status: 'invalid-calendar-row', ok: false });
    expect(getSenders).not.toHaveBeenCalled();
  });
});

const NEEDS_ATTENTION =
  'needs attention: possibly sent (send_log row is still claimed by another run or an interrupted one); use --force to resend';

const key = (program, channel, mode = 'dry-run') => ({ date: '2026-09-28', program, channel, mode });

describe('runDailySend send claim (G2)', () => {
  test('claims, sends, then finishes each program/channel for the date and mode', async () => {
    getDailyContent.mockResolvedValue(content());
    getSenders.mockReturnValue([
      fakeSender('console-email', 'email'),
      fakeSender('file-email', 'email'),
      fakeSender('fake-whatsapp', 'whatsapp'),
    ]);

    const report = await runDailySend({ date: '2026-09-28', programs: ['time4mishna'] });

    expect(report).toMatchObject({ status: 'sent', ok: true });
    expect(claimSendLog.mock.calls).toEqual([[key('time4mishna', 'email')], [key('time4mishna', 'whatsapp')]]);
    expect(finishSendLog.mock.calls).toEqual([
      [key('time4mishna', 'email'), { status: 'sent', providerMessageId: 'console-email-time4mishna, file-email-time4mishna' }],
      [key('time4mishna', 'whatsapp'), { status: 'sent', providerMessageId: 'fake-whatsapp-time4mishna' }],
    ]);
    expect(reclaimFailedSendLog).not.toHaveBeenCalled();
    expect(forceClaimSendLog).not.toHaveBeenCalled();
  });

  test('claims before sending', async () => {
    getDailyContent.mockResolvedValue(content());
    const order = [];
    claimSendLog.mockImplementation(async () => {
      order.push('claim');
      return true;
    });
    finishSendLog.mockImplementation(async () => {
      order.push('finish');
      return true;
    });
    getSenders.mockReturnValue([
      fakeSender('fake-email', 'email', async () => {
        order.push('send');
        return { ok: true, id: 'x' };
      }),
    ]);

    await runDailySend({ date: '2026-09-28', programs: ['time4nach'] });

    expect(order).toEqual(['claim', 'send', 'finish']);
  });

  test('skips a program/channel already sent, still sending the rest', async () => {
    getDailyContent.mockResolvedValue(content());
    const email = fakeSender('fake-email', 'email');
    const whatsapp = fakeSender('fake-whatsapp', 'whatsapp');
    getSenders.mockReturnValue([email, whatsapp]);
    claimSendLog.mockImplementation(async (k) => !(k.program === 'time4mishna' && k.channel === 'email'));
    selectSendLog.mockResolvedValue([{ status: 'sent' }]);

    const report = await runDailySend({ date: '2026-09-28' });

    expect(report).toMatchObject({ status: 'sent', ok: true });
    expect(report.results).toEqual([
      { program: 'time4mishna', channel: 'email', sender: 'fake-email', ok: true, skipped: true },
      { program: 'time4mishna', channel: 'whatsapp', sender: 'fake-whatsapp', ok: true, id: 'fake-whatsapp-time4mishna' },
      { program: 'time4nach', channel: 'email', sender: 'fake-email', ok: true, id: 'fake-email-time4nach' },
      { program: 'time4nach', channel: 'whatsapp', sender: 'fake-whatsapp', ok: true, id: 'fake-whatsapp-time4nach' },
    ]);
    expect(email.send).toHaveBeenCalledTimes(1);
    expect(email.send.mock.calls[0][0].program).toBe('time4nach');
    expect(finishSendLog).toHaveBeenCalledTimes(3);
  });

  test('a failed row is retried via an atomic reclaim', async () => {
    getDailyContent.mockResolvedValue(content());
    const email = fakeSender('fake-email', 'email');
    getSenders.mockReturnValue([email]);
    claimSendLog.mockResolvedValue(false);
    reclaimFailedSendLog.mockResolvedValue(true);

    const report = await runDailySend({ date: '2026-09-28', programs: ['time4nach'] });

    expect(reclaimFailedSendLog).toHaveBeenCalledWith(key('time4nach', 'email'));
    expect(email.send).toHaveBeenCalledTimes(1);
    expect(report).toMatchObject({ status: 'sent', ok: true });
  });

  test('a row left claimed is never auto-resent and needs attention', async () => {
    getDailyContent.mockResolvedValue(content());
    const email = fakeSender('fake-email', 'email');
    getSenders.mockReturnValue([email]);
    claimSendLog.mockResolvedValue(false);
    reclaimFailedSendLog.mockResolvedValue(false);
    selectSendLog.mockResolvedValue([{ status: 'claimed' }]);

    const report = await runDailySend({ date: '2026-09-28', programs: ['time4nach'] });

    expect(email.send).not.toHaveBeenCalled();
    expect(finishSendLog).not.toHaveBeenCalled();
    expect(report).toMatchObject({ status: 'failed', ok: false });
    expect(report.results).toEqual([
      { program: 'time4nach', channel: 'email', sender: 'fake-email', ok: false, error: NEEDS_ATTENTION },
    ]);
  });

  test('a claim that loses the row entirely is a failure, not a send', async () => {
    getDailyContent.mockResolvedValue(content());
    const email = fakeSender('fake-email', 'email');
    getSenders.mockReturnValue([email]);
    claimSendLog.mockResolvedValue(false);
    selectSendLog.mockResolvedValue([]);

    const report = await runDailySend({ date: '2026-09-28', programs: ['time4nach'] });

    expect(email.send).not.toHaveBeenCalled();
    expect(report.results[0]).toMatchObject({ ok: false, error: 'Send log claim failed: unexpected row status null' });
  });

  test.each([['sent'], ['claimed'], ['failed']])('force claims and sends regardless of a %s row', async (status) => {
    getDailyContent.mockResolvedValue(content());
    const email = fakeSender('fake-email', 'email');
    getSenders.mockReturnValue([email]);
    selectSendLog.mockResolvedValue([{ status }]);

    const report = await runDailySend({ date: '2026-09-28', programs: ['time4nach'], force: true });

    expect(forceClaimSendLog).toHaveBeenCalledWith(key('time4nach', 'email'));
    expect(claimSendLog).not.toHaveBeenCalled();
    expect(reclaimFailedSendLog).not.toHaveBeenCalled();
    expect(email.send).toHaveBeenCalledTimes(1);
    expect(finishSendLog).toHaveBeenCalledTimes(1);
    expect(report.results[0]).not.toHaveProperty('skipped');
  });

  test('records failed when any sender on the channel fails', async () => {
    getDailyContent.mockResolvedValue(content());
    getSenders.mockReturnValue([
      fakeSender('ok-email', 'email'),
      fakeSender('bad-email', 'email', async () => {
        throw new Error('boom');
      }),
    ]);

    await runDailySend({ date: '2026-09-28', programs: ['time4nach'] });

    expect(finishSendLog).toHaveBeenCalledWith(key('time4nach', 'email'), {
      status: 'failed',
      providerMessageId: 'ok-email-time4nach',
    });
  });

  test('an uncertain outcome leaves the row claimed (never failed, so never auto-retried)', async () => {
    getDailyContent.mockResolvedValue(content());
    getSenders.mockReturnValue([
      fakeSender('maybe-email', 'email', async () => ({ ok: false, uncertain: true, error: 'schedule timed out' })),
    ]);

    const report = await runDailySend({ date: '2026-09-28', programs: ['time4mishna'] });

    expect(claimSendLog).toHaveBeenCalledWith(key('time4mishna', 'email'));
    expect(finishSendLog).not.toHaveBeenCalled();
    expect(report).toMatchObject({ status: 'failed', ok: false });
    expect(report.results).toEqual([
      {
        program: 'time4mishna',
        channel: 'email',
        sender: 'maybe-email',
        ok: false,
        uncertain: true,
        error: 'schedule timed out; outcome unknown, send_log left claimed: check the provider before using --force',
      },
    ]);
  });

  test('a definite failure has no uncertain flag and is recorded as failed', async () => {
    getDailyContent.mockResolvedValue(content());
    getSenders.mockReturnValue([fakeSender('bad-email', 'email', async () => ({ ok: false, error: 'draft only' }))]);

    const report = await runDailySend({ date: '2026-09-28', programs: ['time4mishna'] });

    expect(report.results[0]).not.toHaveProperty('uncertain');
    expect(finishSendLog).toHaveBeenCalledWith(key('time4mishna', 'email'), { status: 'failed', providerMessageId: null });
  });

  test('uses the mode in the key, so a dry-run does not block live', async () => {
    getDailyContent.mockResolvedValue(content());
    getSenders.mockReturnValue([fakeSender('live-email', 'email')]);

    await runDailySend({ date: '2026-09-28', programs: ['time4nach'], dryRun: false, emailConfig: LIVE_EMAIL_CONFIG });

    expect(claimSendLog).toHaveBeenCalledWith(key('time4nach', 'email', 'live'));
    expect(finishSendLog).toHaveBeenCalledWith(key('time4nach', 'email', 'live'), expect.any(Object));
  });

  test('a send_log error while claiming blocks that channel only', async () => {
    getDailyContent.mockResolvedValue(content());
    const email = fakeSender('fake-email', 'email');
    const whatsapp = fakeSender('fake-whatsapp', 'whatsapp');
    getSenders.mockReturnValue([email, whatsapp]);
    claimSendLog.mockImplementation(async (k) => {
      if (k.channel === 'email') throw new Error('connection refused');
      return true;
    });

    const report = await runDailySend({ date: '2026-09-28', programs: ['time4nach'] });

    expect(report.status).toBe('partial');
    expect(report.results[0]).toEqual({
      program: 'time4nach',
      channel: 'email',
      sender: 'fake-email',
      ok: false,
      error: 'Send log claim failed: connection refused',
    });
    expect(email.send).not.toHaveBeenCalled();
    expect(whatsapp.send).toHaveBeenCalledTimes(1);
  });

  test.each([
    ['throws', () => finishSendLog.mockRejectedValue(new Error('disk full')), 'Send log write failed: disk full'],
    ['finds the row no longer claimed', () => finishSendLog.mockResolvedValue(false), 'Send log write failed: row was no longer claimed'],
  ])('a finish that %s is reported and makes the run not ok', async (_name, arrange, logError) => {
    getDailyContent.mockResolvedValue(content());
    getSenders.mockReturnValue([fakeSender('fake-email', 'email')]);
    arrange();

    const report = await runDailySend({ date: '2026-09-28', programs: ['time4nach'] });

    expect(report).toMatchObject({ status: 'failed', ok: false });
    expect(report.results).toEqual([
      { program: 'time4nach', channel: 'email', sender: 'fake-email', ok: true, id: 'fake-email-time4nach', logError },
    ]);
  });

  test('truncates a long provider id list to the column size', async () => {
    getDailyContent.mockResolvedValue(content());
    getSenders.mockReturnValue([fakeSender('a'.repeat(200), 'email'), fakeSender('b'.repeat(200), 'email')]);

    await runDailySend({ date: '2026-09-28', programs: ['time4nach'] });

    expect(finishSendLog.mock.calls[0][1].providerMessageId).toHaveLength(255);
  });

  test('skipped Shabbos and missing dates never touch the send log', async () => {
    getSenders.mockReturnValue([fakeSender('x', 'email')]);
    getDailyContent.mockResolvedValue(content({ date: dateRow({ day_of_week: 'Shabbos' }) }));
    await runDailySend({ date: '2026-10-03' });
    getDailyContent.mockResolvedValue(null);
    await runDailySend({ date: '2030-01-01' });
    sendLogFns().forEach((fn) => expect(fn).not.toHaveBeenCalled());
  });
});

describe('runDailySend concurrency (G2)', () => {
  // In-memory send_log with the same unique-key semantics as the MySQL table.
  // Every call yields first, so concurrent runs interleave as they would over a network.
  const installFakeSendLog = () => {
    const rows = new Map();
    const id = (k) => [k.date, k.program, k.channel, k.mode].join('|');
    const tick = () => new Promise((resolve) => setImmediate(resolve));

    claimSendLog.mockImplementation(async (k) => {
      await tick();
      if (rows.has(id(k))) return false;
      rows.set(id(k), { status: 'claimed', attempts: 1 });
      return true;
    });
    reclaimFailedSendLog.mockImplementation(async (k) => {
      await tick();
      const row = rows.get(id(k));
      if (!row || row.status !== 'failed') return false;
      row.status = 'claimed';
      row.attempts += 1;
      return true;
    });
    finishSendLog.mockImplementation(async (k, { status }) => {
      await tick();
      const row = rows.get(id(k));
      if (!row || row.status !== 'claimed') return false;
      row.status = status;
      return true;
    });
    selectSendLog.mockImplementation(async (k) => {
      await tick();
      return rows.has(id(k)) ? [{ ...rows.get(id(k)) }] : [];
    });
    return rows;
  };

  test('two concurrent runs send each program/channel exactly once', async () => {
    getDailyContent.mockResolvedValue(content());
    const rows = installFakeSendLog();
    const email = fakeSender('fake-email', 'email', async (message) => {
      // A slow provider call, so the other run reaches the same key mid-send.
      await new Promise((resolve) => setTimeout(resolve, 5));
      return { ok: true, id: `id-${message.program}` };
    });
    getSenders.mockReturnValue([email]);

    const reports = await Promise.all([
      runDailySend({ date: '2026-09-28' }),
      runDailySend({ date: '2026-09-28' }),
    ]);

    // Each program was sent once in total, by whichever run claimed it.
    expect(email.send.mock.calls.map(([message]) => message.program).sort()).toEqual(['time4mishna', 'time4nach']);
    const all = reports.flatMap((report) => report.results);
    for (const program of ['time4mishna', 'time4nach']) {
      const forProgram = all.filter((result) => result.program === program);
      expect(forProgram.filter((result) => result.ok && !result.skipped)).toHaveLength(1);
      expect(forProgram.filter((result) => !result.ok || result.skipped)).toHaveLength(1);
    }
    expect([...rows.values()].map((row) => row.status)).toEqual(['sent', 'sent']);
  });

  test('a run after a completed run skips everything', async () => {
    getDailyContent.mockResolvedValue(content());
    installFakeSendLog();
    const email = fakeSender('fake-email', 'email');
    getSenders.mockReturnValue([email]);

    await runDailySend({ date: '2026-09-28' });
    const second = await runDailySend({ date: '2026-09-28' });

    expect(email.send).toHaveBeenCalledTimes(2);
    expect(second).toMatchObject({ status: 'sent', ok: true });
    expect(second.results.every((result) => result.skipped)).toBe(true);
  });

  test('a failed run is retried once by the next run, with attempts counted', async () => {
    getDailyContent.mockResolvedValue(content());
    const rows = installFakeSendLog();
    let fail = true;
    const email = fakeSender('fake-email', 'email', async (message) =>
      fail ? { ok: false, error: 'provider down' } : { ok: true, id: `id-${message.program}` }
    );
    getSenders.mockReturnValue([email]);

    const first = await runDailySend({ date: '2026-09-28', programs: ['time4nach'] });
    fail = false;
    const second = await runDailySend({ date: '2026-09-28', programs: ['time4nach'] });

    expect(first).toMatchObject({ status: 'failed', ok: false });
    expect(second).toMatchObject({ status: 'sent', ok: true });
    expect([...rows.values()]).toEqual([{ status: 'sent', attempts: 2 }]);
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
    const report = await runDailySend({ date: '2026-09-28', dryRun: false, outboxDir, emailConfig: LIVE_EMAIL_CONFIG });
    expect(report).toMatchObject({ mode: 'live', status: 'failed', ok: false });
    expect(report.results).toHaveLength(4);
    report.results.forEach((result) => expect(result.error).toBe('Not implemented: provider not chosen'));
    expect(fs.readdirSync(outboxDir)).toEqual([]);
  });
});

describe('runDailySend live email config', () => {
  test('refuses a live send without BUCKET_PATH, before reading content', async () => {
    await expect(
      runDailySend({ date: '2026-09-28', dryRun: false, emailConfig: { bucketUrl: null, assetsUrl: null, unsubscribeUrl: null } })
    ).rejects.toThrow('BUCKET_PATH must be set for a live send');
  });
});
