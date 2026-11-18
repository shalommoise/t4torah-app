const { tidyTitle, shiurKeyFor, slugFor, buildEpisodeDescription, buildId3Tags } = require('../src/services/tefilla/shiur');
const { planTefillaSend, describePlan } = require('../src/services/tefilla/plan');

describe('shiur helpers', () => {
  test('tidyTitle collapses whitespace', () => {
    expect(tidyTitle('  877.  Which ‘Good Years’\nDo We Refer To?  ')).toBe('877. Which ‘Good Years’ Do We Refer To?');
    expect(tidyTitle(null)).toBe('');
  });

  test.each([
    ['877. Which ‘Good Years’ Do We Refer To?', '877'],
    ['877 - Which Good Years?', '877'],
    ['877) Which', '877'],
    ['Erev Shabbos Special', 'erev shabbos special'],
    ['2026 Plans', '2026 plans'],
  ])('shiurKeyFor(%j) = %j', (title, key) => {
    expect(shiurKeyFor(title)).toBe(key);
  });

  test('slugFor makes a safe file name', () => {
    expect(slugFor('877. Which ‘Good Years’ Do We Refer To?')).toBe('877-which-good-years-do-we-refer-to');
    expect(slugFor('???')).toBe('shiur');
  });

  test('the episode description escapes the title and has no Mailchimp merge tags', () => {
    const html = buildEpisodeDescription('878. <Kavana> & More');
    expect(html).toContain('<p>878. &lt;Kavana&gt; &amp; More</p>');
    expect(html).toContain('Support Time4Tefilla');
    expect(html).not.toContain('*|');
  });

  test('ID3 tags', () => {
    expect(buildId3Tags(' 877. x ', '2026-11-17')).toEqual({ title: '877. x', artist: 'Time4Tefilla', album: 'Time4Tefilla', year: '2026' });
  });
});

describe('planTefillaSend', () => {
  const plan = (iso, times = {}) =>
    planTefillaSend({ now: new Date(iso), timeZone: 'Europe/London', publishTime: '05:15', sendTime: '05:15', nextDayAfter: '16:00', ...times });

  test('before 05:15 (GMT): both scheduled for 05:15 that day', () => {
    const result = plan('2026-11-17T02:00:00Z');
    expect(result).toEqual({
      date: '2026-11-17',
      castos: { mode: 'schedule', post_date: '2026-11-17 05:15:00', at: new Date('2026-11-17T05:15:00Z') },
      email: { action: 'schedule', at: new Date('2026-11-17T05:15:00Z') },
    });
    expect(describePlan(result)).toBe('episode scheduled for 2026-11-17 05:15:00, email scheduled for 2026-11-17T05:15:00.000Z');
  });

  test('before 05:15 in summer time: 05:15 BST is 04:15Z', () => {
    const result = plan('2026-07-01T03:00:00Z');
    expect(result.email.at).toEqual(new Date('2026-07-01T04:15:00Z'));
    expect(result.castos.post_date).toBe('2026-07-01 05:15:00');
  });

  test('just after midnight London time is that day', () => {
    expect(plan('2026-11-17T00:10:00Z').date).toBe('2026-11-17');
  });

  test('between 05:15 and 16:00: both now', () => {
    const result = plan('2026-11-17T09:30:00Z');
    expect(result.date).toBe('2026-11-17');
    expect(result.castos).toEqual({ mode: 'publish_now' });
    expect(result.email).toMatchObject({ action: 'send', late: true });
    expect(describePlan(result)).toBe('episode published now, email sent now');
    expect(plan('2026-11-17T15:59:00Z').email.action).toBe('send');
  });

  test('from 16:00 to midnight: both scheduled for 05:15 the next morning', () => {
    for (const iso of ['2026-11-17T16:00:00Z', '2026-11-17T22:28:00Z', '2026-11-17T23:59:00Z']) {
      expect(plan(iso)).toEqual({
        date: '2026-11-18',
        castos: { mode: 'schedule', post_date: '2026-11-18 05:15:00', at: new Date('2026-11-18T05:15:00Z') },
        email: { action: 'schedule', at: new Date('2026-11-18T05:15:00Z') },
      });
    }
  });

  test('the 16:00 cutoff is London time: 15:30Z in summer is 16:30 BST', () => {
    const result = plan('2026-07-01T15:30:00Z');
    expect(result.date).toBe('2026-07-02');
    expect(result.email.at).toEqual(new Date('2026-07-02T04:15:00Z'));
  });

  test('the next day across a month end', () => {
    expect(plan('2026-11-30T20:00:00Z').castos.post_date).toBe('2026-12-01 05:15:00');
  });

  test('inside the 5 minutes Mailchimp needs: both now, never an email before its episode', () => {
    const result = plan('2026-11-17T05:11:00Z');
    expect(result.castos).toEqual({ mode: 'publish_now' });
    expect(result.email.action).toBe('send');
  });
});
