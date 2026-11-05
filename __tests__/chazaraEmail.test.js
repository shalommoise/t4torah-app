const {
  isChazaraFriday,
  getChazaraParts,
  chazaraFileName,
  getChazaraLinks,
  perakimLabel,
  buildChazaraSubject,
  renderChazaraEmail,
} = require('../src/services/render/chazaraEmail');

const BUCKET = 'https://storage.googleapis.com/prod_time4mishna';

const dateRow = (overrides) => ({
  date_id: 1,
  gregorian_date: '2026-11-13',
  hebrew_date: '2 Kislev 5787',
  hebrew_date_he: 'ב׳ כסלו תשפ״ז',
  day_of_week: 'Friday',
  is_yom_tov: 0,
  special_date: null,
  ...overrides,
});

const day = (notice, overrides) => ({
  date: dateRow(overrides),
  time4mishna: [{ shiur_type: 'chazara', shiur_title: null, additional_notice: notice }],
  time4nach: [],
});

describe('isChazaraFriday', () => {
  test('is true on a Friday with a chazara row', () => {
    expect(isChazaraFriday(day('Shabbos 18.3-22.5'))).toBe(true);
  });

  test.each([
    ['a regular Friday', { ...day('x'), time4mishna: [{ shiur_type: 'regular' }] }],
    ['a chazara on another day', day('Shabbos 5-6', { day_of_week: 'Shabbos' })],
    ['no rows', { ...day('x'), time4mishna: [] }],
    ['no content', null],
  ])('is false for %s', (_name, content) => {
    expect(isChazaraFriday(content)).toBe(false);
  });
});

describe('getChazaraParts', () => {
  test('takes the range from Friday and the perakim from Shabbos, trimmed', () => {
    expect(getChazaraParts(day('Shabbos 18.3-22.5'), day('Shabbos 5-6 ', { day_of_week: 'Shabbos' }))).toEqual({
      range: 'Shabbos 18.3-22.5',
      perakim: 'Shabbos 5-6',
    });
  });

  test.each([
    ['Shabbos 22.6 - Eiruvin 1.9', 'Shabbos 7-8 '],
    ['Maaser Sheni 4.12 - Challah 1.4', 'Maasros 1-2 '],
    ['Shabbos 8.5-11.4', 'Bikkurim 4 '],
    ['Orlah 1.7-2.17', 'Orlah 3 - Bikkurim 1'],
  ])('accepts %s with %s', (range, perakim) => {
    expect(getChazaraParts(day(range), day(perakim)).range).toBe(range);
  });

  test('has no perakim when the Shabbos row has none', () => {
    expect(getChazaraParts(day('Shabbos 18.3-22.5'), day(null)).perakim).toBeNull();
    expect(getChazaraParts(day('Shabbos 18.3-22.5'), null).perakim).toBeNull();
  });

  test.each([null, '', 'Chazara', 'Shabbos 18.3-22.5: Rosh Chodesh', 'Shabbos 18-22'])(
    'throws on a Friday notice of %p',
    (notice) => {
      expect(() => getChazaraParts(day(notice), day('Shabbos 5-6'))).toThrow('Friday chazara notice');
    }
  );

  test('throws on Shabbos text that is not perakim', () => {
    expect(() => getChazaraParts(day('Shabbos 18.3-22.5'), day('Shabbos 5-6 - Shabbos Chanukah'))).toThrow(
      'Shabbos chazara notice'
    );
  });
});

describe('chazaraFileName', () => {
  test.each([
    ['Shabbos 18.3-22.5', 'shabbos_18.3-22.5'],
    ['Shabbos 22.6 - Eiruvin 1.9', 'shabbos_22.6-eiruvin_1.9'],
    ['Maasros 5 - Maaser Sheni 1', 'maasros_5-maaser_sheni_1'],
    ['Bikkurim 4', 'bikkurim_4'],
    ['Shabbos 5-6 ', 'shabbos_5-6'],
  ])('%s → %s', (label, name) => {
    expect(chazaraFileName(label)).toBe(name);
  });
});

describe('getChazaraLinks', () => {
  test('builds the text, summary and perakim URLs in mishna/chazara', () => {
    expect(getChazaraLinks({ range: 'Shabbos 18.3-22.5', perakim: 'Shabbos 5-6' }, BUCKET)).toEqual({
      text: `${BUCKET}/mishna/chazara/shabbos_18.3-22.5_text.pdf`,
      summary: `${BUCKET}/mishna/chazara/shabbos_18.3-22.5_summary.pdf`,
      perakim: `${BUCKET}/mishna/chazara/shabbos_5-6.pdf`,
    });
  });

  test('has no perakim link without perakim', () => {
    expect(getChazaraLinks({ range: 'Shabbos 18.3-22.5', perakim: null }, BUCKET).perakim).toBeNull();
  });

  test('needs a bucket URL', () => {
    expect(() => getChazaraLinks({ range: 'Shabbos 18.3-22.5', perakim: null }, null)).toThrow('BUCKET_PATH');
  });
});

describe('perakimLabel', () => {
  test.each([
    ['Shabbos 5-6', 'Shabbos Perakim 5-6'],
    ['Bikkurim 4', 'Bikkurim Perek 4'],
    ['Orlah 3 - Bikkurim 1', 'Orlah Perek 3 - Bikkurim Perek 1'],
  ])('%s → %s', (perakim, label) => {
    expect(perakimLabel(perakim)).toBe(label);
  });
});

describe('buildChazaraSubject', () => {
  test('joins the range and perakim', () => {
    expect(buildChazaraSubject({ range: 'Shabbos 18.3-22.5', perakim: 'Shabbos 5-6' })).toBe(
      'Chazara: Shabbos 18.3-22.5 | Shabbos 5-6'
    );
  });

  test('leaves out the perakim part when there are none', () => {
    expect(buildChazaraSubject({ range: 'Shabbos 18.3-22.5', perakim: null })).toBe('Chazara: Shabbos 18.3-22.5');
  });
});

describe('renderChazaraEmail', () => {
  const chazara = (perakim = 'Shabbos 5-6') => {
    const parts = { range: 'Shabbos 18.3-22.5', perakim };
    return { ...parts, links: getChazaraLinks(parts, BUCKET) };
  };

  test('links the week and the Shabbos perakim, with the manual send wording', () => {
    const email = renderChazaraEmail(day('Shabbos 18.3-22.5'), chazara(), { unsubscribeUrl: '*|UNSUB|*' });

    expect(email.subject).toBe('Chazara: Shabbos 18.3-22.5 | Shabbos 5-6');
    expect(email.previewText).toBe('Shabbos 5-6');
    expect(email.html).toContain("Please find attached the Text and Chazara Summaries for this week's mishnayos:");
    expect(email.html).toContain(`href="${BUCKET}/mishna/chazara/shabbos_18.3-22.5_text.pdf"`);
    expect(email.html).toContain('>Shabbos 18.3-22.5 TEXT</a>');
    expect(email.html).toContain('>Shabbos 18.3-22.5 SUMMARY</a>');
    expect(email.html).toContain("Chazara Summaries for this Shabbos's mishnayos:");
    expect(email.html).toContain(`href="${BUCKET}/mishna/chazara/shabbos_5-6.pdf"`);
    expect(email.html).toContain('>Shabbos Perakim 5-6</a>');
    expect(email.html).toContain('Have a Good Shabbos!');
    expect(email.html).toContain('*|UNSUB|*');
    expect(email.html).not.toContain('{{');

    expect(email.text).toContain(`Shabbos 18.3-22.5 TEXT (${BUCKET}/mishna/chazara/shabbos_18.3-22.5_text.pdf)`);
    expect(email.text).toContain(`Shabbos Perakim 5-6 (${BUCKET}/mishna/chazara/shabbos_5-6.pdf)`);
    expect(email.text).toContain('Have a Good Shabbos!');
  });

  test('leaves out the Shabbos section without perakim', () => {
    const email = renderChazaraEmail(day('Shabbos 18.3-22.5'), chazara(null));
    expect(email.subject).toBe('Chazara: Shabbos 18.3-22.5');
    expect(email.previewText).toBe('Shabbos 18.3-22.5');
    expect(email.html).not.toContain('this Shabbos');
    expect(email.text).not.toContain('this Shabbos');
  });

  test('links only the TEXT when the week has no summary', () => {
    const { links, ...parts } = chazara();
    const email = renderChazaraEmail(day('Shabbos 18.3-22.5'), { ...parts, links: { ...links, summary: null } });

    expect(email.html).toContain("Please find attached the Text for this week's mishnayos:");
    expect(email.html).toContain('>Shabbos 18.3-22.5 TEXT</a>');
    expect(email.html).not.toContain('SUMMARY');
    expect(email.text).not.toContain('SUMMARY');
    expect(email.text).toContain("Please find attached the Text for this week's mishnayos:");
    expect(email.subject).toBe('Chazara: Shabbos 18.3-22.5 | Shabbos 5-6');
  });

  test('drops the Shabbos section and subject part when the perakim summary is missing', () => {
    const { links, ...parts } = chazara();
    const email = renderChazaraEmail(day('Shabbos 18.3-22.5'), { ...parts, links: { ...links, perakim: null } });

    expect(email.subject).toBe('Chazara: Shabbos 18.3-22.5');
    expect(email.previewText).toBe('Shabbos 18.3-22.5');
    expect(email.html).not.toContain('this Shabbos');
    expect(email.html).toContain('>Shabbos 18.3-22.5 SUMMARY</a>');
  });
});
