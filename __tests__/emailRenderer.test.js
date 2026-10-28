const {
  renderEmail,
  renderTemplate,
  escapeHtml,
  formatGregorianDate,
} = require('../src/services/render/emailRenderer');
const { STATIC_LINKS } = require('../src/services/render/emailLinks');

const BUCKET = 'https://bucket.test/t4t';

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
  test('time4mishna email shows date, Hebrew date RTL and label', () => {
    const { html, text } = renderEmail(content(), { program: 'time4mishna' });

    expect(html).toContain('<title>Time4Mishna</title>');
    expect(html).toContain('Monday 28 September 2026');
    expect(html).toContain('17 Tishrei 5787');
    expect(html).toMatch(/<p dir="rtl"[^>]*>י״ז תשרי תשפ״ז<\/p>/);
    expect(html).toContain('Brachos 1.1-1.4');
    expect(html).not.toContain('Tehillim');
    expect(html).not.toMatch(/\{\{\w+\}\}/);

    expect(text).toContain('Time4Mishna\nMonday 28 September 2026');
    expect(text).toContain('\n\nBrachos 1.1-1.4');
    expect(text).not.toContain('TIME4MISHNA');
    expect(text).not.toContain('Tehillim');
  });

  test('single-program email has no repeated section heading', () => {
    const { html } = renderEmail(content(), { program: 'time4mishna' });
    expect(html).not.toMatch(/<h2/);
  });

  test('time4nach email shows only the Nach section', () => {
    const { html, text } = renderEmail(content(), { program: 'time4nach' });
    expect(html).toContain('Tehillim 42');
    expect(html).not.toContain('Brachos');
    expect(text).toContain('\n\nTehillim 42');
  });

  test('combined email shows both sections', () => {
    const { html, text } = renderEmail(content(), { program: 'combined' });
    expect(html).toContain('Brachos 1.1-1.4');
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
    expect(text).toContain('\n\nNo shiur today.');
  });

  test('shows Chazara for a non-regular shiur', () => {
    const { html } = renderEmail(content({ time4mishna: [mishnaRow({ shiur_type: 'chazara' })] }), {
      program: 'time4mishna',
    });
    expect(html).toContain('Chazara');
  });

  test('escapes content from the database', () => {
    const { html } = renderEmail(
      content({ time4mishna: [mishnaRow({ additional_notice: '<script>x</script>' })] }),
      { program: 'time4mishna' }
    );
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;x&lt;/script&gt;');
  });

  test.each(['time4mishna', 'time4nach', 'combined'])('%s email strips URLs typed into the database', (program) => {
    const { html, text } = renderEmail(
      content({
        date: dateRow({ special_date: 'Siyum — see https://example.com/siyum' }),
        time4mishna: [mishnaRow({ additional_notice: 'Details at www.example.com today' })],
        time4nach: [nachRow({ additional_notice: 'http://example.org' })],
      }),
      { program, bucketUrl: BUCKET }
    );
    expect(html).not.toMatch(/example\.(com|org)|sefaria/i);
    expect(text).not.toMatch(/example\.(com|org)|sefaria/i);
  });

  test.each(['time4mishna', 'time4nach', 'combined'])('%s email links only to allowed places', (program) => {
    const { html } = renderEmail(content(), {
      program,
      bucketUrl: BUCKET,
      assetsUrl: `${BUCKET}/email`,
      unsubscribeUrl: 'https://provider.test/unsub',
    });
    const allowed = [...Object.values(STATIC_LINKS), 'https://provider.test/unsub'];
    const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1].replace(/&amp;/g, '&'));
    expect(hrefs.length).toBeGreaterThan(0);
    hrefs.forEach((href) => {
      expect(allowed.includes(href) || href.startsWith(`${BUCKET}/mishna/`)).toBe(true);
    });
  });

  test('regular Time4Mishna shiur gets SHIUR and TEXT links from the bucket', () => {
    const { html, text } = renderEmail(content({ time4mishna: [mishnaRow({ shiur_title: 'Bava Kama 1:1-1:4' })] }), {
      program: 'time4mishna',
      bucketUrl: BUCKET,
    });
    expect(html).toContain(`href="${BUCKET}/mishna/shiurim/bava_kama_1:1-1:4.mp3"`);
    expect(html).toContain(`href="${BUCKET}/mishna/texts/bava_kama_1:1-1:4.pdf"`);
    expect(html).toContain('Please find attached the Shiur and Text for today&#39;s Mishnayos:');
    expect(text).toContain(`Shiur: ${BUCKET}/mishna/shiurim/bava_kama_1:1-1:4.mp3`);
  });

  test('links match the time4mishna controller file naming (formFileName)', () => {
    jest.isolateModules(() => {
      process.env.BUCKET_PATH = BUCKET;
      const { formFileName } = require('../utils/findFile');
      const { html } = renderEmail(content({ time4mishna: [mishnaRow({ shiur_title: 'Bava Kama 1:1-1:4' })] }), {
        program: 'time4mishna',
        bucketUrl: BUCKET,
      });
      expect(html).toContain(formFileName('mishna', 'shiurim', 'bava_kama_1:1-1:4', 'mp3'));
      expect(html).toContain(formFileName('mishna', 'texts', 'bava_kama_1:1-1:4', 'pdf'));
    });
  });

  test('no SHIUR/TEXT links or intro without a bucket URL, or on a chazara day', () => {
    const noBucket = renderEmail(content(), { program: 'time4mishna' });
    expect(noBucket.html).not.toContain('SHIUR');
    expect(noBucket.html).not.toContain('Please find attached');
    const chazara = renderEmail(content({ time4mishna: [mishnaRow({ shiur_type: 'chazara' })] }), {
      program: 'time4mishna',
      bucketUrl: BUCKET,
    });
    expect(chazara.html).not.toContain('/mishna/');
    expect(chazara.html).toContain('Chazara');
  });

  test('uses the logo from the assets folder, or the title as text without one', () => {
    const withLogo = renderEmail(content(), { program: 'time4mishna', assetsUrl: `${BUCKET}/email` });
    expect(withLogo.html).toContain(`src="${BUCKET}/email/time4mishna-header_logo.png"`);
    const noLogo = renderEmail(content(), { program: 'time4mishna' });
    expect(noLogo.html).not.toContain('<img');
  });

  test('adds "Have a Good Shabbos!" on Fridays only', () => {
    const friday = renderEmail(content({ date: dateRow({ day_of_week: 'Friday' }) }), { program: 'time4mishna' });
    expect(friday.html).toContain('Have a Good Shabbos!');
    expect(friday.text).toContain('Have a Good Shabbos!');
    expect(renderEmail(content(), { program: 'time4mishna' }).html).not.toContain('Good Shabbos');
  });

  test('app and WhatsApp group links appear only in emails that include Time4Mishna', () => {
    expect(renderEmail(content(), { program: 'time4mishna' }).html).toContain(STATIC_LINKS.whatsappGroup);
    expect(renderEmail(content(), { program: 'time4nach' }).html).not.toContain(STATIC_LINKS.whatsappGroup);
  });

  describe('calendar and summaries (extras)', () => {
    const calendarUrl = `${BUCKET}/mishna/calendars/T4M-09-26.png`;
    const overview = `${BUCKET}/mishna/summaries/Brachos-Overview.pdf`;
    const keyTerms = `${BUCKET}/mishna/summaries/Brachos-Key-Terms.pdf`;
    const extras = { calendarUrl, summaryUrls: [overview, keyTerms] };

    test('adds Overview and Key Terms under SHIUR/TEXT, styled like them', () => {
      const { html, text } = renderEmail(content(), { program: 'time4mishna', bucketUrl: BUCKET, extras });
      expect(html).toMatch(
        new RegExp(
          `>TEXT</a></p>\\n<p style="margin:0;"><a href="${overview}" target="_blank" style="color:#007C89;text-decoration:underline;">OVERVIEW</a><br><a href="${keyTerms}" [^>]*>KEY TERMS</a></p>`
        )
      );
      expect(text).toContain(`OVERVIEW: ${overview}\nKEY TERMS: ${keyTerms}`);
    });

    test('shows only the summaries that were found', () => {
      const { html } = renderEmail(content(), {
        program: 'time4mishna',
        bucketUrl: BUCKET,
        extras: { calendarUrl: null, summaryUrls: [keyTerms] },
      });
      expect(html).not.toContain('OVERVIEW');
      expect(html).toContain('KEY TERMS');
    });

    test('puts the calendar after the shiurim and before the app links', () => {
      const { html, text } = renderEmail(content(), { program: 'time4mishna', bucketUrl: BUCKET, extras });
      const calendarAt = html.indexOf(`<img src="${calendarUrl}" width="564" alt="Time4Mishna learning calendar"`);
      expect(calendarAt).toBeGreaterThan(html.indexOf('KEY TERMS'));
      expect(calendarAt).toBeLessThan(html.indexOf('Want Time4Mishna straight to your phone?'));
      expect(text).toContain(`Calendar: ${calendarUrl}`);
    });

    test('no calendar in a Time4Nach email, and nothing without extras', () => {
      expect(renderEmail(content(), { program: 'time4nach', bucketUrl: BUCKET, extras }).html).not.toContain('T4M-');
      const { html } = renderEmail(content(), { program: 'time4mishna', bucketUrl: BUCKET });
      expect(html).not.toContain('T4M-');
      expect(html).not.toContain('OVERVIEW');
    });
  });

  test('English and Hebrew dates share one left-aligned container', () => {
    const { html } = renderEmail(content(), { program: 'time4mishna' });
    expect(html).toMatch(
      /<div style="[^"]*text-align:left;">\n<p style="[^"]*text-align:left;">Monday 28 September 2026[^<]*<\/p>\n<p dir="rtl" lang="he" style="[^"]*text-align:left;">י״ז תשרי תשפ״ז<\/p>\n<\/div>/
    );
    expect(html).not.toContain('text-align:right');
  });

  test('footer social links are table-based buttons with unchanged links', () => {
    const { html } = renderEmail(content(), { program: 'time4mishna' });
    const buttons = [
      ['facebook', 'Facebook'],
      ['youtube', 'YouTube'],
      ['soundcloud', 'SoundCloud'],
      ['spotify', 'Spotify'],
      ['website', 'Website'],
    ];
    buttons.forEach(([name, label]) => {
      expect(html).toContain(
        `<td bgcolor="#007C89" style="background-color:#007C89;border-radius:4px;padding:8px 14px;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:100%;"><a href="${STATIC_LINKS[name]}" target="_blank" style="color:#FFFFFF;text-decoration:none;">${label}</a>`
      );
    });
    expect(html).toContain(`<a href="${STATIC_LINKS.email}" style="color:#FFFFFF;text-decoration:none;">Email us</a>`);
    expect(html).not.toContain('&nbsp;&middot;&nbsp;');
  });

  test('includes the unsubscribe footer only when configured', () => {
    expect(renderEmail(content(), { program: 'time4mishna' }).html).not.toContain('unsubscribe');
    const { html, text } = renderEmail(content(), { program: 'time4mishna', unsubscribeUrl: 'https://provider.test/unsub' });
    expect(html).toContain('href="https://provider.test/unsub"');
    expect(text).toContain('Unsubscribe: https://provider.test/unsub');
  });

  test('throws for an unknown program or missing content', () => {
    expect(() => renderEmail(content(), { program: 'other' })).toThrow('Unknown program');
    expect(() => renderEmail(null, { program: 'time4mishna' })).toThrow();
  });
});
