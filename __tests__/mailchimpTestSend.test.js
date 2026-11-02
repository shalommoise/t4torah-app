const { sendTestEmail } = require('../src/services/mailchimp/testSend');

const MAILCHIMP = { audienceId: 'list1', fromName: 'Time4Mishna', replyTo: 'info@example.org' };

const message = (overrides) => ({
  date: '2026-10-29',
  program: 'time4mishna',
  email: { subject: 'Time4Mishna – Thursday 29 Oct', html: '<p>Hi</p><a href="*|UNSUB|*">unsubscribe</a>', text: 'Hi' },
  whatsapp: { text: '', attachments: [] },
  ...overrides,
});

const fakeClient = (overrides) => ({
  createCampaign: jest.fn().mockResolvedValue({ id: 'c1' }),
  setContent: jest.fn().mockResolvedValue({}),
  sendTestEmail: jest.fn().mockResolvedValue({}),
  deleteCampaign: jest.fn().mockResolvedValue({}),
  scheduleCampaign: jest.fn(),
  sendCampaign: jest.fn(),
  ...overrides,
});

const send = (client, overrides) =>
  sendTestEmail({ message: message(), emails: ['me@example.org'], mailchimp: MAILCHIMP, client, ...overrides });

describe('sendTestEmail', () => {
  test('creates a TEST draft, sends the test to the given addresses, then deletes the draft', async () => {
    const client = fakeClient();
    await expect(send(client)).resolves.toEqual({ ok: true, campaignId: 'c1' });

    expect(client.createCampaign.mock.calls[0][0].settings.title).toBe('TEST time4mishna 2026-10-29');
    expect(client.setContent).toHaveBeenCalledWith('c1', { html: message().email.html, plain_text: 'Hi' });
    expect(client.sendTestEmail).toHaveBeenCalledWith('c1', ['me@example.org']);
    expect(client.deleteCampaign).toHaveBeenCalledWith('c1');
  });

  test('never schedules or sends the campaign to the audience', async () => {
    const client = fakeClient();
    await send(client);
    expect(client.scheduleCampaign).not.toHaveBeenCalled();
    expect(client.sendCampaign).not.toHaveBeenCalled();
  });

  test('still deletes the draft when the test send fails', async () => {
    const client = fakeClient({ sendTestEmail: jest.fn().mockRejectedValue(new Error('bad address')) });
    await expect(send(client)).resolves.toEqual({ ok: false, error: 'bad address' });
    expect(client.deleteCampaign).toHaveBeenCalledWith('c1');
  });

  test('reports a draft it could not delete', async () => {
    const client = fakeClient({ deleteCampaign: jest.fn().mockRejectedValue(new Error('timeout')) });
    const result = await send(client);
    expect(result.ok).toBe(true);
    expect(result.cleanupError).toBe('draft campaign c1 left unsent in Mailchimp: timeout');
  });

  test('refuses before calling Mailchimp without addresses or the unsubscribe tag', async () => {
    const client = fakeClient();
    await expect(send(client, { emails: [] })).resolves.toEqual({ ok: false, error: 'No test email addresses given' });
    const noUnsub = message({ email: { subject: 's', html: '<p>Hi</p>', text: 'Hi' } });
    expect((await send(client, { message: noUnsub })).error).toContain('*|UNSUB|*');
    expect(client.createCampaign).not.toHaveBeenCalled();
  });
});
