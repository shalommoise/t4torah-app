const {
  UNSUBSCRIBE_TAG,
  getCampaignProblem,
  buildCampaignRequests,
  planDelivery,
} = require('../src/services/mailchimp/campaign');

const message = (overrides) => ({
  date: '2026-10-19',
  program: 'time4mishna',
  email: {
    subject: 'Time4Mishna – Monday 19 Oct | 8 Cheshvan',
    html: `<p>Shiur</p><a href="${UNSUBSCRIBE_TAG}">unsubscribe</a>`,
    text: 'Shiur',
  },
  whatsapp: { text: 'w', attachments: [] },
  ...overrides,
});

const CONFIG = { audienceId: 'list1', fromName: 'Time4Mishna', replyTo: 'info@example.org' };

describe('getCampaignProblem', () => {
  test('accepts a Time4Mishna email with the unsubscribe merge tag', () => {
    expect(UNSUBSCRIBE_TAG).toBe('*|UNSUB|*');
    expect(getCampaignProblem(message())).toBeNull();
  });

  test.each(['time4nach', 'combined'])('refuses %s (only Time4Mishna goes to the audience)', (program) => {
    expect(getCampaignProblem(message({ program }))).toBe(`Mailchimp sends only time4mishna (got ${program})`);
  });

  test('refuses an email without the unsubscribe merge tag', () => {
    const noUnsub = message({ email: { subject: 's', html: '<p>Shiur</p>', text: 'Shiur' } });
    expect(getCampaignProblem(noUnsub)).toBe('Email has no *|UNSUB|* link; set EMAIL_UNSUBSCRIBE_URL=*|UNSUB|*');
  });
});

describe('buildCampaignRequests', () => {
  test('targets the whole audience (no segment) with the rendered subject, HTML and text', () => {
    const msg = message();
    expect(buildCampaignRequests(msg, CONFIG)).toEqual({
      campaign: {
        type: 'regular',
        recipients: { list_id: 'list1' },
        settings: {
          subject_line: 'Time4Mishna – Monday 19 Oct | 8 Cheshvan',
          title: 'time4mishna 2026-10-19',
          from_name: 'Time4Mishna',
          reply_to: 'info@example.org',
        },
      },
      content: { html: msg.email.html, plain_text: 'Shiur' },
    });
  });

  test('keeps the special date that the subject builder put in the subject', () => {
    const msg = message({
      email: { subject: 'Time4Mishna – Monday 28 Sep | 17 Tishrei | Chol HaMoed Sukkos', html: '*|UNSUB|*', text: '' },
    });
    expect(buildCampaignRequests(msg, CONFIG).campaign.settings.subject_line).toBe(
      'Time4Mishna – Monday 28 Sep | 17 Tishrei | Chol HaMoed Sukkos'
    );
  });
});

describe('planDelivery', () => {
  const plan = (date, now) =>
    planDelivery({ date, now: new Date(now), sendTime: '05:15', sendTimeZone: 'Europe/London' });

  test('schedules for 05:15 London in BST (04:15 UTC)', () => {
    expect(plan('2026-07-01', '2026-07-01T03:30:00Z')).toEqual({
      action: 'schedule',
      at: new Date('2026-07-01T04:15:00Z'),
    });
  });

  test('schedules for 05:15 London in GMT (05:15 UTC)', () => {
    expect(plan('2026-12-01', '2026-12-01T04:30:00Z')).toEqual({
      action: 'schedule',
      at: new Date('2026-12-01T05:15:00Z'),
    });
  });

  test('schedules a future date', () => {
    expect(plan('2026-10-20', '2026-10-19T12:00:00Z').action).toBe('schedule');
  });

  test('sends at once, flagged late, when run less than 5 minutes before or after the send time that day', () => {
    expect(plan('2026-07-01', '2026-07-01T04:12:00Z')).toEqual({
      action: 'send',
      late: true,
      at: new Date('2026-07-01T04:15:00Z'),
    });
    expect(plan('2026-07-01', '2026-07-01T09:00:00Z').action).toBe('send');
  });

  test('uses the London date, not the UTC date, to decide "today"', () => {
    // 23:30 UTC on 30 June is 00:30 BST on 1 July.
    expect(() => plan('2026-06-30', '2026-06-30T23:30:00Z')).toThrow('2026-06-30 has passed in Europe/London');
  });

  test('refuses a date that has passed', () => {
    expect(() => plan('2026-07-01', '2026-07-02T03:00:00Z')).toThrow(
      '2026-07-01 has passed in Europe/London; not sending a stale email'
    );
  });
});
