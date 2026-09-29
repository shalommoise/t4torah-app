const masechtaNames = require('../db/data/masechtaNames.json');
const tanachIndex = require('../db/data/tanach_index.json');
const {
  getSefariaMasechtaTitle,
  getSefariaSeferTitle,
  buildMishnaRangeUrl,
  buildMishnaSefariaLinks,
  buildNachSefariaLink,
} = require('../src/services/sefariaLinkService');

const mishnaRow = (overrides) => ({
  shiur_type: 'regular',
  start_masechta_name: 'Brachos',
  start_perek: 1,
  start_mishna_number: 1,
  end_masechta_name: 'Brachos',
  end_perek: 1,
  end_mishna_number: 4,
  ...overrides,
});

describe('getSefariaMasechtaTitle', () => {
  test('maps masechta_table names to Sefaria titles', () => {
    expect(getSefariaMasechtaTitle('Brachos')).toBe('Berakhot');
    expect(getSefariaMasechtaTitle('Bava Kama')).toBe('Bava Kamma');
    expect(getSefariaMasechtaTitle('Uktzin')).toBe('Oktzin');
  });

  test('has a title for every masechta', () => {
    masechtaNames.forEach(([name]) => {
      expect(getSefariaMasechtaTitle(name)).toEqual(expect.any(String));
    });
  });

  test('returns null for an unknown masechta', () => {
    expect(getSefariaMasechtaTitle('Nonexistent')).toBeNull();
  });
});

describe('getSefariaSeferTitle', () => {
  test('maps tanach_table names to Sefaria titles, including numbered sefarim', () => {
    expect(getSefariaSeferTitle('Tehillim')).toBe('Psalms');
    expect(getSefariaSeferTitle('Shmuel Aleph')).toBe('I Samuel');
    expect(getSefariaSeferTitle('Divrei HaYamim Beis')).toBe('II Chronicles');
    expect(getSefariaSeferTitle('Shir HaShirim')).toBe('Song of Songs');
  });

  test('has a title for every sefer', () => {
    tanachIndex.forEach((sefer) => {
      expect(getSefariaSeferTitle(sefer.english)).toEqual(expect.any(String));
    });
  });

  test('returns null for an unknown sefer', () => {
    expect(getSefariaSeferTitle('Nonexistent')).toBeNull();
  });
});

describe('buildMishnaRangeUrl', () => {
  test('range within one perek', () => {
    expect(
      buildMishnaRangeUrl({ masechta: 'Brachos', startPerek: 1, startMishna: 1, endPerek: 1, endMishna: 4 })
    ).toBe('https://www.sefaria.org/Mishnah_Berakhot.1.1-4');
  });

  test('range across perakim', () => {
    expect(
      buildMishnaRangeUrl({ masechta: 'Brachos', startPerek: 1, startMishna: 5, endPerek: 2, endMishna: 3 })
    ).toBe('https://www.sefaria.org/Mishnah_Berakhot.1.5-2.3');
  });

  test('single mishna', () => {
    expect(
      buildMishnaRangeUrl({ masechta: 'Peah', startPerek: 2, startMishna: 3, endPerek: 2, endMishna: 3 })
    ).toBe('https://www.sefaria.org/Mishnah_Peah.2.3');
  });

  test('multi-word masechta uses underscores', () => {
    expect(
      buildMishnaRangeUrl({ masechta: 'Bava Kama', startPerek: 1, startMishna: 1, endPerek: 1, endMishna: 4 })
    ).toBe('https://www.sefaria.org/Mishnah_Bava_Kamma.1.1-4');
  });

  test('returns null for an unknown masechta', () => {
    expect(
      buildMishnaRangeUrl({ masechta: 'Nonexistent', startPerek: 1, startMishna: 1, endPerek: 1, endMishna: 1 })
    ).toBeNull();
  });
});

describe('buildMishnaSefariaLinks', () => {
  test('returns [] for a no-shiur day', () => {
    expect(buildMishnaSefariaLinks(null)).toEqual([]);
    expect(buildMishnaSefariaLinks(undefined)).toEqual([]);
  });

  test('returns [] for a non-regular shiur', () => {
    expect(buildMishnaSefariaLinks(mishnaRow({ shiur_type: 'chazara' }))).toEqual([]);
  });

  test('single-masechta shiur from joined fields', () => {
    expect(buildMishnaSefariaLinks(mishnaRow())).toEqual([
      'https://www.sefaria.org/Mishnah_Berakhot.1.1-4',
    ]);
  });

  test('cross-masechta shiur returns one link per masechta', () => {
    const row = mishnaRow({
      start_perek: 8,
      start_mishna_number: 7,
      end_masechta_name: 'Peah',
      end_perek: 1,
      end_mishna_number: 3,
    });
    // Brachos has 9 perakim; perek 9 has 5 mishnayos.
    expect(buildMishnaSefariaLinks(row)).toEqual([
      'https://www.sefaria.org/Mishnah_Berakhot.8.7-9.5',
      'https://www.sefaria.org/Mishnah_Peah.1.1-3',
    ]);
  });

  test('falls back to parsing shiur_title when joined fields are missing', () => {
    const row = { shiur_type: 'regular', shiur_title: 'Brachos 1:1-1:4' };
    expect(buildMishnaSefariaLinks(row)).toEqual([
      'https://www.sefaria.org/Mishnah_Berakhot.1.1-4',
    ]);
  });

  test('returns [] when the masechta is unknown or data is insufficient', () => {
    expect(buildMishnaSefariaLinks(mishnaRow({ start_masechta_name: 'X', end_masechta_name: 'X' }))).toEqual([]);
    expect(buildMishnaSefariaLinks({ shiur_type: 'regular' })).toEqual([]);
  });
});

describe('buildNachSefariaLink', () => {
  test('builds a perek link', () => {
    expect(buildNachSefariaLink({ shiur_type: 'regular', sefer_name: 'Tehillim', perek: 42 })).toBe(
      'https://www.sefaria.org/Psalms.42'
    );
    expect(buildNachSefariaLink({ shiur_type: 'regular', sefer_name: 'Shmuel Aleph', perek: 3 })).toBe(
      'https://www.sefaria.org/I_Samuel.3'
    );
  });

  test('returns null for no-shiur, non-regular, missing or unknown data', () => {
    expect(buildNachSefariaLink(null)).toBeNull();
    expect(buildNachSefariaLink({ shiur_type: 'chazara', sefer_name: 'Tehillim', perek: 1 })).toBeNull();
    expect(buildNachSefariaLink({ shiur_type: 'regular', sefer_name: 'Tehillim' })).toBeNull();
    expect(buildNachSefariaLink({ shiur_type: 'regular', sefer_name: 'Nonexistent', perek: 1 })).toBeNull();
  });
});
