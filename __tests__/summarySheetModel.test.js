const { query } = require('../src/config/env');
const {
  selectMishnaRange,
  selectSederMishnaRange,
  upsertSummarySheet,
  selectSummarySheetsForRange,
  selectSummarySheetKeys,
} = require('../src/models/summarySheetModel');

jest.mock('../src/config/env', () => ({
  query: jest.fn(),
}));

beforeEach(() => {
  jest.clearAllMocks();
});

describe('selectMishnaRange', () => {
  test('whole masechta: matches the name only', async () => {
    const row = { masechta_name: 'Bava Kama', first_mishna_id: 100, last_mishna_id: 180 };
    query.mockResolvedValue([[row]]);

    await expect(selectMishnaRange({ masechta: 'bava kama' })).resolves.toEqual(row);

    const [sql, params] = query.mock.calls[0];
    expect(sql).toMatch(/MIN\(m\.mishna_id\) AS first_mishna_id, MAX\(m\.mishna_id\) AS last_mishna_id/);
    expect(sql).toMatch(/WHERE LOWER\(t\.masechta_name\) = LOWER\(\?\)\s+GROUP BY/);
    expect(params).toEqual(['bava kama']);
  });

  test('adds perek and mishna conditions with placeholders', async () => {
    query.mockResolvedValue([[{ masechta_name: 'Bava Kama', first_mishna_id: 120, last_mishna_id: 120 }]]);

    await selectMishnaRange({ masechta: 'Bava Kama', perek: 3, mishna: 4 });

    const [sql, params] = query.mock.calls[0];
    expect(sql).toMatch(/AND m\.perek = \? AND m\.mishna = \?/);
    expect(params).toEqual(['Bava Kama', 3, 4]);
  });

  test('returns null when nothing matches', async () => {
    query.mockResolvedValue([[]]);
    await expect(selectMishnaRange({ masechta: 'Nowhere' })).resolves.toBeNull();
  });
});

describe('selectSederMishnaRange', () => {
  test('matches the seder name through masechta_table', async () => {
    const row = { seder_name: 'Zeraim', first_mishna_id: 1, last_mishna_id: 655 };
    query.mockResolvedValue([[row]]);

    await expect(selectSederMishnaRange('zeraim')).resolves.toEqual(row);

    const [sql, params] = query.mock.calls[0];
    expect(sql).toMatch(/JOIN sedarim_table s ON s\.seder_id = t\.seder_id\s+WHERE LOWER\(s\.seder_name\) = LOWER\(\?\)/);
    expect(params).toEqual(['zeraim']);
  });

  test('returns null when nothing matches', async () => {
    query.mockResolvedValue([[]]);
    await expect(selectSederMishnaRange('Nowhere')).resolves.toBeNull();
  });
});

describe('upsertSummarySheet', () => {
  const sheet = {
    kind: 'summary',
    startMishna: 100,
    endMishna: 103,
    part: 1,
    bucketKey: 'mishna/summaries/sheets/Bava-Kama/Bava-Kama_summary_1_1.pdf',
    sourceRef: 'Bava Kama/Perek 1.pdf',
  };

  test('inserts with placeholders, updating on a duplicate bucket key', async () => {
    query.mockResolvedValue([{ affectedRows: 1 }]);

    await expect(upsertSummarySheet(sheet)).resolves.toBe('inserted');

    const [sql, params] = query.mock.calls[0];
    expect(sql).toMatch(/INSERT INTO summary_sheets \(kind, start_mishna, end_mishna, part, bucket_key, source_ref\)\s+VALUES \(\?, \?, \?, \?, \?, \?\)/);
    expect(sql).toMatch(/ON DUPLICATE KEY UPDATE/);
    expect(params).toEqual(['summary', 100, 103, 1, sheet.bucketKey, 'Bava Kama/Perek 1.pdf']);
  });

  test.each([
    [2, 'updated'],
    [0, 'unchanged'],
  ])('affectedRows %i means %s', async (affectedRows, expected) => {
    query.mockResolvedValue([{ affectedRows }]);
    await expect(upsertSummarySheet(sheet)).resolves.toBe(expected);
  });
});

describe('selectSummarySheetsForRange', () => {
  test('selects sheets overlapping the range, in learning order', async () => {
    const rows = [{ summary_sheet_id: 1 }];
    query.mockResolvedValue([rows]);

    await expect(selectSummarySheetsForRange(104, 110)).resolves.toBe(rows);

    const [sql, params] = query.mock.calls[0];
    expect(sql).toMatch(/WHERE start_mishna <= \? AND end_mishna >= \?/);
    expect(sql).toMatch(/ORDER BY start_mishna, part, kind/);
    expect(params).toEqual([110, 104]);
  });
});

describe('selectSummarySheetKeys', () => {
  test('returns the bucket keys', async () => {
    query.mockResolvedValue([[{ bucket_key: 'a.pdf' }, { bucket_key: 'b.pdf' }]]);
    await expect(selectSummarySheetKeys()).resolves.toEqual(['a.pdf', 'b.pdf']);
  });
});
