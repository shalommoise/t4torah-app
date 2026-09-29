const {
  renderEmail,
  renderTemplate,
  escapeHtml,
  formatGregorianDate,
} = require('../src/services/render/emailRenderer');

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

const mishnaRow = (overrides) => ({
  shiur_type: 'regular',
  shiur_title: 'Brachos 1:1-1:4',
  start_masechta_id: 1,
  start_masechta_name: 'Brachos',
  start_perek: 1,
  start_mishna_number: 1,
  end_masechta_id: 1,
  end_masechta_name: 'Brachos',
  end_perek: 1,
  end_mishna_number: 4,
  additional_notice: null,
  ...overrides,
});

const nachRow = (overrides) => ({
  shiur_type: 'regular',
  sefer_name: 'Tehillim',
  perek: 42,
  additional_notice: null,
  ...overrides,
});

const content = (overrides) => ({
  date: dateRow(),
  time4mishna: [mishnaRow()],
  time4nach: [nachRow()],
  ...overrides,
});

describe('renderTemplate', () => {
  test('replaces every occurrence of each token', () => {
    expect(renderTemplate('{{a}} and {{b}} and {{a}}', { a: '1', b: '2' })).toBe('1 and 2 and 1');
  });

  test('throws on a token with no value', () => {
    expect(() => renderTemplate('{{missing}}', {})).toThrow('Missing template value: missing');
  });
});

describe('escapeHtml', () => {
  test('escapes HTML special characters', () => {
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe('&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;');
  });
});

describe('formatGregorianDate', () => {
  test('formats a YYYY-MM-DD date', () => {
    expect(formatGregorianDate('2026-09-28')).toBe('Monday 28 September 2026');
  });

  test('passes through anything else', () => {
    expect(formatGregorianDate('28/09/2026')).toBe('28/09/2026');
    expect(formatGregorianDate(undefined)).toBe('');
  });
});

describe('renderEmail', () => {
  test('time4mishna email shows date, Hebrew date RTL, label and Sefaria link', () => {
    const { html, text } = renderEmail(content(), { program: 'time4mishna' });

    expect(html).toContain('<title>Time4Mishna</title>');
    expect(html).toContain('Monday 28 September 2026');
    expect(html).toContain('17 Tishrei 5787');
    expect(html).toMatch(/<p dir="rtl"[^>]*>י״ז תשרי תשפ״ז<\/p>/);
    expect(html).toContain('Brachos 1:1–1:4');
    expect(html).toContain('href="https://www.sefaria.org/Mishnah_Berakhot.1.1-4"');
    expect(html).not.toContain('Tehillim');
    expect(html).not.toMatch(/\{\{\w+\}\}/);

    expect(text).toContain('Time4Mishna\nMonday 28 September 2026');
    expect(text).toContain('Brachos 1:1–1:4\nLearn on Sefaria: https://www.sefaria.org/Mishnah_Berakhot.1.1-4');
    expect(text).not.toContain('Tehillim');
  });

  test('time4nach email shows only the Nach section', () => {
    const { html, text } = renderEmail(content(), { program: 'time4nach' });
    expect(html).toContain('Tehillim 42');
    expect(html).toContain('href="https://www.sefaria.org/Psalms.42"');
    expect(html).not.toContain('Brachos');
    expect(text).toContain('TIME4NACH\nTehillim 42');
  });

  test('combined email shows both sections', () => {
    const { html, text } = renderEmail(content(), { program: 'combined' });
    expect(html).toContain('Brachos 1:1–1:4');
    expect(html).toContain('Tehillim 42');
    expect(text).toContain('TIME4MISHNA');
    expect(text).toContain('TIME4NACH');
  });

  test('shows special_date and additional_notice when present', () => {
    const { html, text } = renderEmail(
      content({
        date: dateRow({ special_date: 'Chol HaMoed Sukkos' }),
        time4mishna: [mishnaRow({ additional_notice: 'Siyum tomorrow!' })],
      }),
      { program: 'time4mishna' }
    );
    expect(html).toContain('Chol HaMoed Sukkos');
    expect(html).toContain('Siyum tomorrow!');
    expect(text).toContain('Chol HaMoed Sukkos');
    expect(text).toContain('Siyum tomorrow!');
  });

  test('omits special_date when absent', () => {
    const { text } = renderEmail(content(), { program: 'time4mishna' });
    expect(text.split('\n\n')[0]).toBe('Time4Mishna\nMonday 28 September 2026\n17 Tishrei 5787\nי״ז תשרי תשפ״ז');
  });

  test('shows "No shiur today." on a no-shiur day', () => {
    const { html, text } = renderEmail(content({ time4mishna: [] }), { program: 'time4mishna' });
    expect(html).toContain('No shiur today.');
    expect(text).toContain('TIME4MISHNA\nNo shiur today.');
  });

  test('shows Chazara without a Sefaria link', () => {
    const { html } = renderEmail(content({ time4mishna: [mishnaRow({ shiur_type: 'chazara' })] }), {
      program: 'time4mishna',
    });
    expect(html).toContain('Chazara');
    expect(html).not.toContain('sefaria.org');
  });

  test('escapes content from the database', () => {
    const { html } = renderEmail(
      content({ time4mishna: [mishnaRow({ additional_notice: '<script>x</script>' })] }),
      { program: 'time4mishna' }
    );
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;x&lt;/script&gt;');
  });

  test('throws for an unknown program or missing content', () => {
    expect(() => renderEmail(content(), { program: 'other' })).toThrow('Unknown program');
    expect(() => renderEmail(null, { program: 'time4mishna' })).toThrow();
  });
});
