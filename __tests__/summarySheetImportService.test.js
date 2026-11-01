const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const model = require('../src/models/summarySheetModel');
const {
  parseCsv,
  readInventory,
  parsePosition,
  parseInventoryRow,
  buildBucketKey,
  resolveSheet,
  importSummarySheets,
  checkBucket,
} = require('../src/services/summarySheetImportService');

jest.mock('../src/models/summarySheetModel', () => ({
  selectMishnaRange: jest.fn(),
  selectSederMishnaRange: jest.fn(),
  upsertSummarySheet: jest.fn(),
  selectSummarySheetKeys: jest.fn(),
}));

// Bava Kama with three short perakim: mishna_ids 100-103, 104-106, 107-108.
const PERAKIM = { 1: 4, 2: 3, 3: 2 };
const MISHNAYOS = Object.entries(PERAKIM).flatMap(([perek, count]) =>
  Array.from({ length: count }, (_unused, index) => ({ perek: Number(perek), mishna: index + 1 }))
).map((position, index) => ({ ...position, id: 100 + index }));

const fakeSelectMishnaRange = async ({ masechta, perek = null, mishna = null }) => {
  if (masechta.toLowerCase() !== 'bava kama') {
    return null;
  }
  const ids = MISHNAYOS.filter((m) => (perek === null || m.perek === perek) && (mishna === null || m.mishna === mishna)).map((m) => m.id);
  return ids.length ? { masechta_name: 'Bava Kama', first_mishna_id: Math.min(...ids), last_mishna_id: Math.max(...ids) } : null;
};

const HEADER = 'file,masechta,start,end,kind,part,notes';

let tmp;
let filesDir;
let outDir;

beforeEach(async () => {
  jest.clearAllMocks();
  model.selectMishnaRange.mockImplementation(fakeSelectMishnaRange);
  model.selectSederMishnaRange.mockImplementation(async (seder) =>
    seder.toLowerCase() === 'nezikin' ? { seder_name: 'Nezikin', first_mishna_id: 100, last_mishna_id: 900 } : null
  );
  model.upsertSummarySheet.mockResolvedValue('inserted');
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'summary-sheets-'));
  filesDir = path.join(tmp, 'drive');
  outDir = path.join(tmp, 'out');
  await fs.mkdir(path.join(filesDir, 'BK'), { recursive: true });
  await Promise.all(['p1.pdf', 'p2a.pdf', 'p2b.pdf', 'overview.pdf'].map((name) => fs.writeFile(path.join(filesDir, 'BK', name), `pdf ${name}`)));
});

afterEach(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

describe('parseCsv', () => {
  test('handles quotes, escaped quotes, embedded commas/newlines, CRLF, BOM and blank lines', () => {
    const text = '﻿a,b\r\n"x, y","say ""hi"""\r\n\r\n"multi\nline",z\n';
    expect(parseCsv(text)).toEqual([
      ['a', 'b'],
      ['x, y', 'say "hi"'],
      ['multi\nline', 'z'],
    ]);
  });

  test('throws on an unclosed quote', () => {
    expect(() => parseCsv('a\n"oops')).toThrow(/quoted field/);
  });
});

describe('readInventory', () => {
  test('keys values by lower-cased column and numbers rows from 2', () => {
    const records = readInventory('File,Masechta,Start,End,Kind,Part\n BK/p1.pdf ,Bava Kama,1,1,,\n');
    expect(records).toEqual([
      { row: 2, values: { file: 'BK/p1.pdf', masechta: 'Bava Kama', start: '1', end: '1', kind: '', part: '' } },
    ]);
  });

  test('throws when a required column is missing', () => {
    expect(() => readInventory('file,masechta,start\n')).toThrow('missing column(s): end, kind, part');
  });
});

describe('parsePosition', () => {
  test.each([
    ['', null],
    ['3', { perek: 3, mishna: null }],
    ['3:4', { perek: 3, mishna: 4 }],
    ['3.4', { perek: 3, mishna: 4 }],
  ])('"%s"', (text, expected) => {
    expect(parsePosition(text, 'start')).toEqual(expected);
  });

  test.each(['0', '3:0', 'three', '3-4', '3:'])('rejects "%s"', (text) => {
    expect(() => parsePosition(text, 'start')).toThrow(/^start must be/);
  });
});

describe('parseInventoryRow', () => {
  const base = { file: 'BK/p1.pdf', masechta: 'Bava Kama', start: '1', end: '1', kind: 'summary', part: '1' };

  test('parses a full row', () => {
    expect(parseInventoryRow(base)).toEqual({
      file: 'BK/p1.pdf',
      masechta: 'Bava Kama',
      kind: 'summary',
      part: 1,
      start: { perek: 1, mishna: null },
      end: { perek: 1, mishna: null },
    });
  });

  test('defaults kind to summary and part to 1; normalises masechta and kind', () => {
    const spec = parseInventoryRow({ ...base, masechta: 'Bava-Kama', kind: '', part: '' });
    expect(spec).toMatchObject({ masechta: 'Bava Kama', kind: 'summary', part: 1 });
    expect(parseInventoryRow({ ...base, kind: 'Key Terms' }).kind).toBe('key_terms');
  });

  test('blank start and end mean the whole masechta', () => {
    expect(parseInventoryRow({ ...base, start: '', end: '' })).toMatchObject({ start: null, end: null });
  });

  test.each([
    [{ file: '' }, 'file is empty'],
    [{ file: 'BK/p1.docx' }, 'file must be a .pdf'],
    [{ masechta: ' ' }, 'masechta is empty'],
    [{ kind: 'notes' }, 'kind must be one of'],
    [{ part: '0' }, 'part must be a whole number'],
    [{ part: 'a' }, 'part must be a whole number'],
    [{ end: '' }, 'start and end must both be filled in'],
  ])('rejects %o', (override, message) => {
    expect(() => parseInventoryRow({ ...base, ...override })).toThrow(message);
  });
});

describe('buildBucketKey', () => {
  const sheet = { masechtaName: 'Bava Kama', kind: 'summary', part: 1 };

  test.each([
    [{ perek: 3, mishna: null }, { perek: 3, mishna: null }, 'Bava-Kama_summary_3_1.pdf'],
    [{ perek: 3, mishna: null }, { perek: 4, mishna: null }, 'Bava-Kama_summary_3_to_4_1.pdf'],
    [{ perek: 5, mishna: 5 }, { perek: 5, mishna: 6 }, 'Bava-Kama_summary_5-5_to_5-6_1.pdf'],
    [null, null, 'Bava-Kama_summary_all_1.pdf'],
  ])('%o to %o', (start, end, file) => {
    expect(buildBucketKey({ ...sheet, start, end })).toBe(`mishna/summaries/sheets/Bava-Kama/${file}`);
  });
});

describe('resolveSheet', () => {
  const spec = (start, end, extra = {}) => ({ masechta: 'bava kama', kind: 'summary', part: 1, ...parseInventoryRow({ file: 'x.pdf', masechta: 'bava kama', start, end, kind: '', part: '', ...extra }) });

  test('perek-only start/end cover the whole perakim; uses the DB spelling in the key', async () => {
    await expect(resolveSheet(spec('1', '2'))).resolves.toEqual({
      kind: 'summary',
      part: 1,
      startMishna: 100,
      endMishna: 106,
      bucketKey: 'mishna/summaries/sheets/Bava-Kama/Bava-Kama_summary_1_to_2_1.pdf',
    });
  });

  test('perek:mishna positions resolve to that mishna', async () => {
    await expect(resolveSheet(spec('1:3', '2:1'))).resolves.toMatchObject({ startMishna: 102, endMishna: 104 });
  });

  test('blank start/end cover the whole masechta', async () => {
    await expect(resolveSheet(spec('', '', { kind: 'overview' }))).resolves.toMatchObject({
      startMishna: 100,
      endMishna: 108,
      bucketKey: 'mishna/summaries/sheets/Bava-Kama/Bava-Kama_overview_all_1.pdf',
    });
  });

  test('unknown masechta or seder', async () => {
    await expect(resolveSheet({ masechta: 'Nowhere', kind: 'summary', part: 1, start: null, end: null })).rejects.toThrow(
      'Unknown masechta or seder "Nowhere"'
    );
  });

  test('a seder name covers the whole seder, filed under Seder-<Name>', async () => {
    const expected = {
      kind: 'key_terms',
      part: 1,
      startMishna: 100,
      endMishna: 900,
      bucketKey: 'mishna/summaries/sheets/Seder-Nezikin/Seder-Nezikin_key_terms_all_1.pdf',
    };
    await expect(resolveSheet({ masechta: 'nezikin', kind: 'key_terms', part: 1, start: null, end: null })).resolves.toEqual(expected);
    await expect(resolveSheet({ masechta: 'Seder Nezikin', kind: 'key_terms', part: 1, start: null, end: null })).resolves.toEqual(expected);
    expect(model.selectSederMishnaRange).toHaveBeenLastCalledWith('Nezikin');
  });

  test('a seder row cannot have a start or end', async () => {
    await expect(resolveSheet(spec('1', '1', { masechta: 'Nezikin' }))).rejects.toThrow('Nezikin is a seder: leave start and end empty');
  });

  test('a perek or mishna that does not exist', async () => {
    await expect(resolveSheet(spec('4', '4'))).rejects.toThrow('Bava Kama has no perek 4');
    await expect(resolveSheet(spec('1', '1:9'))).rejects.toThrow('Bava Kama has no 1:9');
  });

  test('start after end', async () => {
    await expect(resolveSheet(spec('2', '1'))).rejects.toThrow('start is after end');
  });
});

describe('importSummarySheets', () => {
  const GOOD = [
    HEADER,
    'BK/p1.pdf,Bava Kama,1,1,summary,1,',
    'BK/p2a.pdf,Bava Kama,2,2,summary,1,two files',
    'BK/p2b.pdf,Bava Kama,2,2,summary,2,',
    'BK/overview.pdf,Bava Kama,,,overview,,',
  ].join('\n');

  test('dry-run (the default) checks every row and writes nothing', async () => {
    const report = await importSummarySheets({ csvText: GOOD, filesDir, outDir });

    expect(report).toMatchObject({ dryRun: true, written: false, errors: [], results: [] });
    expect(report.sheets.map((sheet) => [sheet.row, sheet.bucketKey])).toEqual([
      [2, 'mishna/summaries/sheets/Bava-Kama/Bava-Kama_summary_1_1.pdf'],
      [3, 'mishna/summaries/sheets/Bava-Kama/Bava-Kama_summary_2_1.pdf'],
      [4, 'mishna/summaries/sheets/Bava-Kama/Bava-Kama_summary_2_2.pdf'],
      [5, 'mishna/summaries/sheets/Bava-Kama/Bava-Kama_overview_all_1.pdf'],
    ]);
    expect(model.upsertSummarySheet).not.toHaveBeenCalled();
    await expect(fs.access(outDir)).rejects.toThrow();
  });

  test('live: copies each file to its bucket key and upserts its row', async () => {
    model.upsertSummarySheet.mockResolvedValueOnce('inserted').mockResolvedValue('updated');

    const report = await importSummarySheets({ csvText: GOOD, filesDir, outDir, dryRun: false });

    expect(report).toMatchObject({ written: true, errors: [] });
    expect(report.results.map((result) => result.action)).toEqual(['inserted', 'updated', 'updated', 'updated']);
    const copied = await fs.readFile(path.join(outDir, 'mishna/summaries/sheets/Bava-Kama/Bava-Kama_summary_2_2.pdf'), 'utf8');
    expect(copied).toBe('pdf p2b.pdf');
    expect(model.upsertSummarySheet).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'summary',
        startMishna: 104,
        endMishna: 106,
        part: 2,
        bucketKey: 'mishna/summaries/sheets/Bava-Kama/Bava-Kama_summary_2_2.pdf',
        sourceRef: 'BK/p2b.pdf',
      })
    );
  });

  test('any bad row: reports every error by row and writes nothing', async () => {
    const csvText = [
      HEADER,
      'BK/p1.pdf,Bava Kama,1,1,summary,1,',
      'BK/missing.pdf,Bava Kama,2,2,summary,1,',
      'BK/p2a.pdf,Bava Kama,9,9,summary,1,',
      'BK/p2b.pdf,Bava Kama,1,1,,,',
    ].join('\n');

    const report = await importSummarySheets({ csvText, filesDir, outDir, dryRun: false });

    expect(report.written).toBe(false);
    expect(report.errors).toEqual([
      { row: 3, message: `file not found: ${path.join(filesDir, 'BK/missing.pdf')}` },
      { row: 4, message: 'Bava Kama has no perek 9' },
      { row: 5, message: 'same masechta, kind, range and part as row 2' },
    ]);
    expect(model.upsertSummarySheet).not.toHaveBeenCalled();
    await expect(fs.access(outDir)).rejects.toThrow();
  });

  test('live without outDir throws', async () => {
    await expect(importSummarySheets({ csvText: GOOD, filesDir, dryRun: false })).rejects.toThrow('outDir is required');
  });
});

describe('checkBucket', () => {
  test('HEADs every key under the bucket URL and lists the missing ones', async () => {
    model.selectSummarySheetKeys.mockResolvedValue(['mishna/summaries/sheets/Bava-Kama/a b.pdf', 'mishna/summaries/sheets/Bava-Kama/c.pdf']);
    const request = jest.fn(async ({ url }) => ({ status: url.endsWith('c.pdf') ? 404 : 200 }));

    await expect(checkBucket({ bucketUrl: 'https://bucket.example/', request })).resolves.toEqual({
      checked: 2,
      missing: ['https://bucket.example/mishna/summaries/sheets/Bava-Kama/c.pdf'],
    });
    expect(request).toHaveBeenCalledWith(expect.objectContaining({ method: 'HEAD', url: 'https://bucket.example/mishna/summaries/sheets/Bava-Kama/a%20b.pdf' }));
  });

  test('a request that throws counts as missing', async () => {
    model.selectSummarySheetKeys.mockResolvedValue(['k.pdf']);
    const request = jest.fn().mockRejectedValue(new Error('timeout'));
    await expect(checkBucket({ bucketUrl: 'https://bucket.example', request })).resolves.toEqual({
      checked: 1,
      missing: ['https://bucket.example/k.pdf'],
    });
  });
});
