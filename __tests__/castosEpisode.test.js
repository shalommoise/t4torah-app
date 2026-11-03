const {
  getRegularShiur,
  buildEpisodeTitle,
  buildEpisodeDescription,
  findExistingEpisode,
  buildId3Tags,
  DONATE_URL,
} = require('../src/services/castos/episode');

const BUCKET = 'https://storage.googleapis.com/prod_time4mishna';

const shabbos = {
  shiur_type: 'regular',
  shiur_title: 'Shabbos 20.2-20.5',
  start_masechta_id: 12,
  end_masechta_id: 12,
  start_masechta_name: 'Shabbos',
  end_masechta_name: 'Shabbos',
  start_perek: 20,
  start_mishna_number: 2,
  end_perek: 20,
  end_mishna_number: 5,
};

describe('getRegularShiur', () => {
  test('returns the regular row', () => {
    expect(getRegularShiur({ time4mishna: [shabbos] })).toBe(shabbos);
  });

  test('null for chazara or no shiur', () => {
    expect(getRegularShiur({ time4mishna: [{ shiur_type: 'chazara' }] })).toBeNull();
    expect(getRegularShiur({ time4mishna: [] })).toBeNull();
    expect(getRegularShiur({})).toBeNull();
  });

  test('throws when there are several regular rows', () => {
    expect(() => getRegularShiur({ time4mishna: [shabbos, shabbos] })).toThrow(/found 2/);
  });
});

describe('buildEpisodeTitle', () => {
  test('is the dotted label used on the live show', () => {
    expect(buildEpisodeTitle(shabbos)).toBe('Shabbos 20.2-20.5');
  });

  test('crossing masechtos', () => {
    expect(
      buildEpisodeTitle({
        ...shabbos,
        end_masechta_id: 13,
        end_masechta_name: 'Eiruvin',
        start_perek: 24,
        start_mishna_number: 4,
        end_perek: 1,
        end_mishna_number: 2,
      })
    ).toBe('Shabbos 24.4 - Eiruvin 1.2');
  });

  test('null for chazara', () => {
    expect(buildEpisodeTitle({ shiur_type: 'chazara' })).toBeNull();
  });
});

describe('buildEpisodeDescription', () => {
  const base = { title: 'Shabbos 20.2-20.5', date: '2026-11-03', scheduleRow: shabbos, bucketUrl: BUCKET };

  test('links every file that was found, then the fixed lines', () => {
    const html = buildEpisodeDescription({
      ...base,
      textUrl: `${BUCKET}/mishna/texts/shabbos_20.2-20.5.pdf`,
      calendarUrl: `${BUCKET}/mishna/calendars/T4M-11-26.png`,
      summaryUrls: [`${BUCKET}/mishna/summaries/Shabbos-Overview.pdf`, `${BUCKET}/mishna/summaries/Shabbos-Key-Terms.pdf`],
    });
    expect(html.split('\n')).toEqual([
      `<p><a href="${BUCKET}/mishna/texts/shabbos_20.2-20.5.pdf" title="Shabbos 20.2-20.5 Text">Shabbos 20.2-20.5 Text</a></p>`,
      `<p><a href="${BUCKET}/mishna/summaries/Shabbos-Overview.pdf" title="Shabbos Overview">Shabbos Overview</a><br>` +
        `<a href="${BUCKET}/mishna/summaries/Shabbos-Key-Terms.pdf" title="Shabbos Key Terms">Shabbos Key Terms</a></p>`,
      `<p><a href="${BUCKET}/mishna/calendars/T4M-11-26.png" title="November Calendar">November Calendar</a></p>`,
      '<p><a href="https://time4torah.org/">Time4Torah</a></p>',
      '<p><em>Time4Torah is a member of the Jewish Futures family organisations</em>.</p>',
      `<p><a href="${DONATE_URL}" title="Support Time4Mishna">Support Time4Mishna</a></p>`,
    ]);
  });

  test('leaves out files that were not found', () => {
    const html = buildEpisodeDescription({
      ...base,
      textUrl: null,
      calendarUrl: null,
      summaryUrls: [`${BUCKET}/mishna/summaries/Shabbos-Key-Terms.pdf`],
    });
    expect(html).not.toMatch(/Text<|Calendar|Overview/);
    expect(html).toMatch(/Shabbos Key Terms/);
    expect(html).toMatch(/Support Time4Mishna/);
  });

  test('escapes HTML in titles', () => {
    expect(buildEpisodeDescription({ ...base, title: 'A <b> & "c"', textUrl: `${BUCKET}/t.pdf` })).toContain(
      'A &lt;b&gt; &amp; &quot;c&quot; Text'
    );
  });

  test('the donate link has no Mailchimp merge tags', () => {
    expect(DONATE_URL).not.toMatch(/\*\|/);
  });
});

describe('findExistingEpisode', () => {
  const episodes = [
    { id: 1, post_title: 'Shabbos 19.4-20.1', post_date: '2026-11-02 05:05:00' },
    { id: 2, post_title: ' shabbos  20.2-20.5 ', post_date: '2026-11-03 05:05:00' },
  ];

  test('matches by title, ignoring case and spacing', () => {
    expect(findExistingEpisode(episodes, 'Shabbos 20.2-20.5')).toBe(episodes[1]);
  });

  test('null when the title is new, even if the date matches', () => {
    expect(findExistingEpisode(episodes, 'Shabbos 20.6-21.1')).toBeNull();
    expect(findExistingEpisode([], 'x')).toBeNull();
    expect(findExistingEpisode(undefined, 'x')).toBeNull();
  });
});

test('buildId3Tags', () => {
  expect(buildId3Tags('Shabbos 20.2-20.5', '2026-11-03')).toEqual({
    title: 'Shabbos 20.2-20.5',
    artist: 'Time4Mishna',
    album: 'Time4Mishna',
    year: '2026',
  });
});
