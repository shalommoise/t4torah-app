const fs = require('fs');
const os = require('os');
const path = require('path');
const { createMailchimpSender, createMailchimpPreviewSender } = require('../src/services/senders/mailchimpSender');
const { assertSender } = require('../src/services/senders');
const { MailchimpError } = require('../src/services/mailchimp/client');

// Never reach the real API, even if a test forgets to inject a client.
jest.mock('axios', () => ({ request: jest.fn(() => Promise.reject(new Error('network disabled in tests'))) }));

const MAILCHIMP = {
  apiKey: 'secret-us21',
  serverPrefix: 'us21',
  audienceId: 'list1',
  fromName: 'Time4Mishna',
  replyTo: 'info@example.org',
  sendTime: '05:15',
  sendTimeZone: 'Europe/London',
};

// 03:30 UTC on 19 Oct 2026 is 04:30 BST: 45 minutes before the send.
const EARLY = new Date('2026-10-19T03:30:00Z');
const SEND_AT = new Date('2026-10-19T04:15:00Z');

const message = (overrides) => ({
  date: '2026-10-19',
  program: 'time4mishna',
  email: { subject: 'Time4Mishna – Monday 19 Oct', html: '<p>Shiur</p><a href="*|UNSUB|*">u</a>', text: 'Shiur' },
  whatsapp: { text: 'w', attachments: [] },
  ...overrides,
});

const fakeClient = (overrides) => ({
  createCampaign: jest.fn().mockResolvedValue({ id: 'c1' }),
  setContent: jest.fn().mockResolvedValue({}),
  scheduleCampaign: jest.fn().mockResolvedValue(undefined),
  sendCampaign: jest.fn().mockResolvedValue(undefined),
  getCampaign: jest.fn().mockResolvedValue({ id: 'c1', status: 'schedule', recipients: { recipient_count: 2431 } }),
  ...overrides,
});

const makeSender = (client, now = EARLY) => {
  const logger = { log: jest.fn() };
  const sender = createMailchimpSender({ mailchimp: MAILCHIMP, mailchimpClient: client, now: () => now, logger });
  return { sender, logger };
};

describe('createMailchimpSender', () => {
  test('implements the Sender interface and needs Mailchimp config', () => {
    expect(assertSender(makeSender(fakeClient()).sender)).toMatchObject({ name: 'mailchimp-email', channel: 'email' });
    expect(() => createMailchimpSender({})).toThrow('Mailchimp sender needs config.mailchimp');
  });

  test('creates, fills, schedules for 05:15 London and verifies; returns the campaign id', async () => {
    const client = fakeClient();
    const { sender, logger } = makeSender(client);

    await expect(sender.send(message())).resolves.toEqual({ ok: true, id: 'c1' });

    expect(client.createCampaign).toHaveBeenCalledWith({
      type: 'regular',
      recipients: { list_id: 'list1' },
      settings: {
        subject_line: 'Time4Mishna – Monday 19 Oct',
        title: 'time4mishna 2026-10-19',
        from_name: 'Time4Mishna',
        reply_to: 'info@example.org',
      },
    });
    expect(client.setContent).toHaveBeenCalledWith('c1', {
      html: '<p>Shiur</p><a href="*|UNSUB|*">u</a>',
      plain_text: 'Shiur',
    });
    expect(client.scheduleCampaign).toHaveBeenCalledWith('c1', SEND_AT);
    expect(client.sendCampaign).not.toHaveBeenCalled();
    expect(client.getCampaign).toHaveBeenCalledWith('c1');
    expect(logger.log).toHaveBeenCalledWith(
      '[live] mailchimp time4mishna 2026-10-19: campaign c1 scheduled for 2026-10-19T04:15:00.000Z (status schedule, 2431 recipients)'
    );
  });

  test('a run late on the day sends at once instead of scheduling', async () => {
    const client = fakeClient({ getCampaign: jest.fn().mockResolvedValue({ status: 'sending' }) });
    const { sender, logger } = makeSender(client, new Date('2026-10-19T07:00:00Z'));

    await expect(sender.send(message())).resolves.toEqual({ ok: true, id: 'c1' });
    expect(client.sendCampaign).toHaveBeenCalledWith('c1');
    expect(client.scheduleCampaign).not.toHaveBeenCalled();
    expect(logger.log.mock.calls[0][0]).toContain('sent now (late; send time was 2026-10-19T04:15:00.000Z)');
  });

  describe('fails before touching Mailchimp', () => {
    test.each([
      ['a non-Mailchimp program', message({ program: 'time4nach' }), 'Mailchimp sends only time4mishna'],
      [
        'an email without the unsubscribe tag',
        message({ email: { subject: 's', html: '<p>x</p>', text: 'x' } }),
        'Email has no *|UNSUB|* link',
      ],
      ['a date that has passed', message({ date: '2026-10-18' }), '2026-10-18 has passed in Europe/London'],
      ['an invalid message', { date: 'bad' }, 'DailyMessage.date must be a YYYY-MM-DD string'],
    ])('%s', async (_label, msg, error) => {
      const client = fakeClient();
      const result = await makeSender(client).sender.send(msg);
      expect(result.ok).toBe(false);
      expect(result.error).toContain(error);
      expect(result).not.toHaveProperty('uncertain');
      expect(client.createCampaign).not.toHaveBeenCalled();
    });
  });

  test('a create failure is a definite failure', async () => {
    const client = fakeClient({ createCampaign: jest.fn().mockRejectedValue(new MailchimpError('Mailchimp POST /campaigns returned 400: Invalid Resource')) });
    await expect(makeSender(client).sender.send(message())).resolves.toEqual({
      ok: false,
      error: 'Mailchimp POST /campaigns returned 400: Invalid Resource',
    });
  });

  test('a content failure names the draft left behind and never schedules', async () => {
    const client = fakeClient({ setContent: jest.fn().mockRejectedValue(new Error('content 500')) });
    await expect(makeSender(client).sender.send(message())).resolves.toEqual({
      ok: false,
      error: 'content 500 (draft campaign c1 left unsent)',
    });
    expect(client.scheduleCampaign).not.toHaveBeenCalled();
  });

  test('a campaign without an id is a failure', async () => {
    const client = fakeClient({ createCampaign: jest.fn().mockResolvedValue({}) });
    await expect(makeSender(client).sender.send(message())).resolves.toEqual({
      ok: false,
      error: 'Mailchimp created a campaign without an id',
    });
  });

  describe('schedule call fails', () => {
    const scheduleError = () => jest.fn().mockRejectedValue(new Error('schedule 503'));

    test('but Mailchimp shows it scheduled: ok', async () => {
      const client = fakeClient({ scheduleCampaign: scheduleError() });
      await expect(makeSender(client).sender.send(message())).resolves.toEqual({ ok: true, id: 'c1' });
    });

    test('and the campaign is still a draft: definite failure (safe to retry)', async () => {
      const client = fakeClient({
        scheduleCampaign: scheduleError(),
        getCampaign: jest.fn().mockResolvedValue({ status: 'save' }),
      });
      await expect(makeSender(client).sender.send(message())).resolves.toEqual({
        ok: false,
        error: 'schedule 503 (campaign c1); campaign status is save, nothing sent',
      });
    });

    test('and the status cannot be read: uncertain', async () => {
      const client = fakeClient({
        scheduleCampaign: scheduleError(),
        getCampaign: jest.fn().mockRejectedValue(new Error('timeout')),
      });
      await expect(makeSender(client).sender.send(message())).resolves.toEqual({
        ok: false,
        uncertain: true,
        error: 'schedule 503 (campaign c1); status check failed: timeout',
      });
    });

    test('and the status is unexpected: uncertain', async () => {
      const client = fakeClient({
        scheduleCampaign: scheduleError(),
        getCampaign: jest.fn().mockResolvedValue({ status: 'archived' }),
      });
      const result = await makeSender(client).sender.send(message());
      expect(result).toMatchObject({ ok: false, uncertain: true });
    });
  });

  describe('verifying after a successful schedule call', () => {
    test('status unreadable: still ok (the call succeeded), logged as not verified', async () => {
      const client = fakeClient({ getCampaign: jest.fn().mockRejectedValue(new Error('timeout')) });
      const { sender, logger } = makeSender(client);
      await expect(sender.send(message())).resolves.toEqual({ ok: true, id: 'c1' });
      expect(logger.log.mock.calls[0][0]).toContain('status not verified: timeout');
    });

    test('status still a draft: failure', async () => {
      const client = fakeClient({ getCampaign: jest.fn().mockResolvedValue({ status: 'save' }) });
      await expect(makeSender(client).sender.send(message())).resolves.toEqual({
        ok: false,
        error: 'Campaign c1 has status save after schedule',
      });
    });

    test('unexpected status: uncertain', async () => {
      const client = fakeClient({ getCampaign: jest.fn().mockResolvedValue({ status: 'weird' }) });
      await expect(makeSender(client).sender.send(message())).resolves.toMatchObject({ ok: false, uncertain: true });
    });
  });
});

describe('createMailchimpPreviewSender', () => {
  let outboxDir;

  beforeEach(() => {
    outboxDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mailchimp-preview-test-'));
  });

  afterEach(() => {
    fs.rmSync(outboxDir, { recursive: true, force: true });
  });

  const preview = (now = EARLY) =>
    createMailchimpPreviewSender({ mailchimp: MAILCHIMP, outboxDir, now: () => now });

  const readPreview = (id) => JSON.parse(fs.readFileSync(id, 'utf8'));

  test('writes the full request plan to the outbox, without the API key', async () => {
    const result = await preview().send(message());

    expect(result).toEqual({ ok: true, id: path.join(outboxDir, '2026-10-19', 'email-time4mishna.mailchimp.json') });
    const written = readPreview(result.id);
    expect(written.server).toBe('https://us21.api.mailchimp.com/3.0');
    expect(written.delivery).toEqual({ action: 'schedule', at: '2026-10-19T04:15:00.000Z' });
    expect(written.requests.map((r) => `${r.method} ${r.path}`)).toEqual([
      'POST /campaigns',
      'PUT /campaigns/{id}/content',
      'POST /campaigns/{id}/actions/schedule',
      'GET /campaigns/{id}',
    ]);
    expect(written.requests[0].body.recipients).toEqual({ list_id: 'list1' });
    expect(written.requests[2].body).toEqual({ schedule_time: '2026-10-19T04:15:00.000Z' });
    expect(fs.readFileSync(result.id, 'utf8')).not.toContain('secret-us21');
  });

  test('a past date is still previewed, with the delivery problem noted', async () => {
    const result = await preview(new Date('2026-10-25T12:00:00Z')).send(message());
    const written = readPreview(result.id);
    expect(result.ok).toBe(true);
    expect(written.delivery).toEqual({
      action: 'none',
      error: '2026-10-19 has passed in Europe/London; not sending a stale email',
    });
    expect(written.requests.map((r) => r.path)).not.toContain('/campaigns/{id}/actions/schedule');
  });

  test('fails like the live sender would on a content problem', async () => {
    await expect(preview().send(message({ program: 'time4nach' }))).resolves.toEqual({
      ok: false,
      error: 'Mailchimp sends only time4mishna (got time4nach)',
    });
    expect(fs.readdirSync(outboxDir)).toEqual([]);
  });
});
