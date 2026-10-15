const {
  renderWhatsapp,
  truncate,
  WHATSAPP_MAX_LENGTH,
  stripWhatsappFormatting,
} = require('../src/services/render/whatsappRenderer');

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

describe('renderWhatsapp', () => {
  test('time4mishna message', () => {
    expect(renderWhatsapp(content(), { program: 'time4mishna' }).text).toBe(
      [
        '*Time4Mishna*',
        'Monday 28 September 2026',
        '17 Tishrei 5787',
        'י״ז תשרי תשפ״ז',
        '',
        '*Brachos 1:1–1:4*',
      ].join('\n')
    );
  });

  test('time4nach message shows only Nach', () => {
    const { text } = renderWhatsapp(content(), { program: 'time4nach' });
    expect(text).toMatch(/^\*Time4Nach\*\n/);
    expect(text).toContain('*Tehillim 42*');
    expect(text).not.toContain('Brachos');
  });

  test('combined message has a bold title per section', () => {
    const { text } = renderWhatsapp(content(), { program: 'combined' });
    expect(text).toContain('*Time4Mishna & Time4Nach*');
    expect(text).toContain('\n\n*Time4Mishna*\n*Brachos 1:1–1:4*');
    expect(text).toContain('\n\n*Time4Nach*\n*Tehillim 42*');
  });

  test('shows special_date and additional_notice in italics', () => {
    const { text } = renderWhatsapp(
      content({
        date: dateRow({ special_date: 'Chol HaMoed Sukkos' }),
        time4mishna: [mishnaRow({ additional_notice: 'Siyum tomorrow!' })],
      }),
      { program: 'time4mishna' }
    );
    expect(text).toContain('\n_Chol HaMoed Sukkos_\n');
    expect(text).toContain('*Brachos 1:1–1:4*\n_Siyum tomorrow!_');
  });

  test('no-shiur day and chazara', () => {
    expect(renderWhatsapp(content({ time4mishna: [] }), { program: 'time4mishna' }).text).toMatch(
      /\n\nNo shiur today\.$/
    );
    expect(
      renderWhatsapp(content({ time4mishna: [mishnaRow({ shiur_type: 'chazara' })] }), {
        program: 'time4mishna',
      }).text
    ).toMatch(/\n\n\*Chazara\*$/);
  });

  test.each(['time4mishna', 'time4nach', 'combined'])('%s message contains no links', (program) => {
    const { text } = renderWhatsapp(
      content({
        date: dateRow({ special_date: 'Siyum — see https://example.com/siyum' }),
        time4mishna: [mishnaRow({ additional_notice: 'Details at www.example.com today' })],
        time4nach: [nachRow({ additional_notice: 'http://example.org' })],
      }),
      { program }
    );
    expect(text).not.toMatch(/https?:\/\/|www\./i);
  });

  test('keeps a very long message under the limit', () => {
    const longNotice = 'א'.repeat(3000);
    const { text } = renderWhatsapp(
      content({ time4mishna: [mishnaRow({ additional_notice: longNotice })] }),
      { program: 'time4mishna' }
    );
    expect(Array.from(text).length).toBeLessThan(WHATSAPP_MAX_LENGTH);
    expect(text.endsWith('…')).toBe(true);
    expect(text.startsWith('*Time4Mishna*')).toBe(true);
  });

  test('throws for an unknown program or missing content', () => {
    expect(() => renderWhatsapp(content(), { program: 'other' })).toThrow('Unknown program');
    expect(() => renderWhatsapp(null, { program: 'time4mishna' })).toThrow();
  });
});

describe('WhatsApp formatting characters in DB text', () => {
  test('are stripped from special date, notices and Hebrew dates', () => {
    const { text } = renderWhatsapp(
      content({
        date: dateRow({ special_date: '*Chol* _HaMoed_ ~Sukkos~', hebrew_date: '17 Tishrei_ 5787' }),
        time4mishna: [mishnaRow({ additional_notice: 'Use `code` and ```blocks``` *carefully*' })],
      }),
      { program: 'time4mishna' }
    );
    expect(text).toContain('_Chol HaMoed Sukkos_');
    expect(text).toContain('17 Tishrei 5787');
    expect(text).toContain('_Use code and blocks carefully_');
    expect(text).not.toMatch(/~|`/);
  });

  test('a notice made only of formatting characters is dropped', () => {
    const { text } = renderWhatsapp(
      content({ time4mishna: [mishnaRow({ additional_notice: '*** ___' })] }),
      { program: 'time4mishna' }
    );
    expect(text).not.toMatch(/\*\*|__/);
  });
});

describe('stripWhatsappFormatting', () => {
  test('removes * _ ~ and backticks and tidies spaces', () => {
    expect(stripWhatsappFormatting('a *b* _c_ ~d~ `e`')).toBe('a b c d e');
    expect(stripWhatsappFormatting('  *  ')).toBeNull();
    expect(stripWhatsappFormatting(null)).toBeNull();
    expect(stripWhatsappFormatting('ברכות א:א')).toBe('ברכות א:א');
  });
});

describe('truncate', () => {
  test('leaves short text alone', () => {
    expect(truncate('abc', 3)).toBe('abc');
  });

  test('cuts to maxLength code points including the ellipsis', () => {
    expect(truncate('abcdef', 4)).toBe('abc…');
    expect(Array.from(truncate('😀'.repeat(10), 5))).toHaveLength(5);
  });
});

describe('WhatsApp attachments', () => {
  const BUCKET = 'https://bucket.test/t4t';

  test('regular Time4Mishna shiur sends the mp3 and the text pdf, not links', () => {
    const { text, attachments } = renderWhatsapp(
      content({ time4mishna: [mishnaRow({ shiur_title: 'Bava Kama 1:1-1:4' })] }),
      { program: 'time4mishna', bucketUrl: BUCKET }
    );
    expect(attachments).toEqual([
      { type: 'audio', url: `${BUCKET}/mishna/shiurim/bava_kama_1:1-1:4.mp3`, filename: 'bava_kama_1:1-1:4.mp3' },
      { type: 'document', url: `${BUCKET}/mishna/texts/bava_kama_1:1-1:4.pdf`, filename: 'bava_kama_1:1-1:4.pdf' },
    ]);
    expect(text).not.toMatch(/https?:\/\//);
  });

  test('no attachments without a bucket URL, on a chazara day, or for Time4Nach', () => {
    expect(renderWhatsapp(content(), { program: 'time4mishna' }).attachments).toEqual([]);
    expect(
      renderWhatsapp(content({ time4mishna: [mishnaRow({ shiur_type: 'chazara', shiur_title: 'x' })] }), {
        program: 'time4mishna',
        bucketUrl: BUCKET,
      }).attachments
    ).toEqual([]);
    expect(renderWhatsapp(content(), { program: 'time4nach', bucketUrl: BUCKET }).attachments).toEqual([]);
  });
});
