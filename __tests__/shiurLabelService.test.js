const {
  formatMishnaShiurLabel,
  formatNachShiurLabel,
  getAdditionalNotice,
} = require('../src/services/shiurLabelService');

describe('formatMishnaShiurLabel', () => {
  test('returns null for a no-shiur day (no schedule row)', () => {
    expect(formatMishnaShiurLabel(null)).toBeNull();
    expect(formatMishnaShiurLabel(undefined)).toBeNull();
  });

  test('returns "Chazara" for a non-regular shiur type', () => {
    expect(formatMishnaShiurLabel({ shiur_type: 'chazara' })).toBe('Chazara');
  });

  test('formats a same-masechta range compactly', () => {
    const row = {
      shiur_type: 'regular',
      start_masechta_id: 1,
      start_masechta_name: 'Brachos',
      start_perek: 1,
      start_mishna_number: 1,
      end_masechta_id: 1,
      end_masechta_name: 'Brachos',
      end_perek: 1,
      end_mishna_number: 4,
    };
    expect(formatMishnaShiurLabel(row)).toBe('Brachos 1:1–1:4');
  });

  test('formats a cross-masechta range with spaced dash', () => {
    const row = {
      shiur_type: 'regular',
      start_masechta_id: 1,
      start_masechta_name: 'Brachos',
      start_perek: 9,
      start_mishna_number: 5,
      end_masechta_id: 2,
      end_masechta_name: 'Peah',
      end_perek: 1,
      end_mishna_number: 3,
    };
    expect(formatMishnaShiurLabel(row)).toBe('Brachos 9:5 – Peah 1:3');
  });

  test('falls back to parsing shiur_title when joined fields are missing', () => {
    const row = { shiur_type: 'regular', shiur_title: 'Brachos 1:1-1:4' };
    expect(formatMishnaShiurLabel(row)).toBe('Brachos 1:1–1:4');
  });

  test('falls back to parsing a cross-masechta shiur_title', () => {
    const row = { shiur_type: 'regular', shiur_title: 'Brachos 9:5-Peah 1:3' };
    expect(formatMishnaShiurLabel(row)).toBe('Brachos 9:5 – Peah 1:3');
  });

  test('returns null when neither joined fields nor a parsable title exist', () => {
    expect(formatMishnaShiurLabel({ shiur_type: 'regular', shiur_title: null })).toBeNull();
  });
});

describe('formatNachShiurLabel', () => {
  test('returns null for a no-shiur day (no schedule row)', () => {
    expect(formatNachShiurLabel(null)).toBeNull();
  });

  test('returns "Chazara" for a non-regular shiur type', () => {
    expect(formatNachShiurLabel({ shiur_type: 'chazara' })).toBe('Chazara');
  });

  test('formats a regular Nach label', () => {
    expect(formatNachShiurLabel({ shiur_type: 'regular', sefer_name: 'Tehillim', perek: 42 })).toBe('Tehillim 42');
  });

  test('returns null when sefer_name or perek is missing', () => {
    expect(formatNachShiurLabel({ shiur_type: 'regular', sefer_name: null, perek: 42 })).toBeNull();
    expect(formatNachShiurLabel({ shiur_type: 'regular', sefer_name: 'Tehillim', perek: null })).toBeNull();
  });
});

describe('getAdditionalNotice', () => {
  test('returns the notice when present', () => {
    expect(getAdditionalNotice({ additional_notice: 'No shiur today - fast day' })).toBe(
      'No shiur today - fast day'
    );
  });

  test('returns null when absent or there is no row', () => {
    expect(getAdditionalNotice({ additional_notice: null })).toBeNull();
    expect(getAdditionalNotice({})).toBeNull();
    expect(getAdditionalNotice(null)).toBeNull();
  });
});
