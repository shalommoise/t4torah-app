const { stripLinks, getSections } = require('../src/services/render/dailySections');

describe('stripLinks', () => {
  test('removes http(s) and www URLs', () => {
    expect(stripLinks('Register at https://example.com/a?b=1 today')).toBe('Register at today');
    expect(stripLinks('See www.example.com')).toBe('See');
    expect(stripLinks('HTTP://EXAMPLE.COM and more')).toBe('and more');
  });

  test('leaves text without links alone', () => {
    expect(stripLinks('Siyum tomorrow!')).toBe('Siyum tomorrow!');
  });

  test('returns null for empty input or link-only text', () => {
    expect(stripLinks(null)).toBeNull();
    expect(stripLinks('')).toBeNull();
    expect(stripLinks('https://example.com')).toBeNull();
  });
});

describe('getSections', () => {
  const content = {
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
        additional_notice: 'https://example.com',
      },
    ],
    time4nach: [{ shiur_type: 'regular', sefer_name: null, perek: null, additional_notice: null }],
  };

  test('builds sections per program, stripping links from notices', () => {
    expect(getSections(content, 'combined')).toEqual([
      { title: 'Time4Mishna', items: [{ label: 'Brachos 1:1–1:4', notice: null }] },
      { title: 'Time4Nach', items: [] },
    ]);
    expect(getSections(content, 'time4nach').map((s) => s.title)).toEqual(['Time4Nach']);
  });
});
