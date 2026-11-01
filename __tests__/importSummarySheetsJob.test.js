const { parseArgs, formatImportReport, main, UsageError } = require('../jobs/importSummarySheets');

describe('parseArgs', () => {
  test('import defaults to dry-run', () => {
    expect(parseArgs(['inv.csv', '--files=drive'])).toEqual({
      help: false,
      checkBucket: false,
      dryRun: true,
      inventory: 'inv.csv',
      filesDir: 'drive',
    });
  });

  test('live import needs --out', () => {
    expect(parseArgs(['inv.csv', '--files=drive', '--out=stage', '--dry-run=false'])).toMatchObject({ dryRun: false, outDir: 'stage' });
    expect(() => parseArgs(['inv.csv', '--files=drive', '--dry-run=false'])).toThrow('--out=<dir> is required');
  });

  test('--check-bucket stands alone', () => {
    expect(parseArgs(['--check-bucket'])).toMatchObject({ checkBucket: true });
    expect(() => parseArgs(['--check-bucket', 'inv.csv'])).toThrow(UsageError);
  });

  test.each([
    [[], 'Give the inventory CSV'],
    [['inv.csv'], '--files=<dir> is required'],
    [['inv.csv', 'other.csv'], 'Unexpected argument: other.csv'],
    [['inv.csv', '--files'], '--files needs a folder'],
    [['inv.csv', '--files=a', '--files=b'], 'given more than once'],
    [['inv.csv', '--files=a', '--dry-run=no'], '--dry-run must be true or false'],
    [['--nope'], 'Unknown option: --nope'],
  ])('%j is a usage error', (argv, message) => {
    expect(() => parseArgs(argv)).toThrow(message);
  });
});

describe('formatImportReport', () => {
  test('errors', () => {
    expect(formatImportReport({ errors: [{ row: 3, message: 'bad' }], sheets: [], results: [], written: false })).toEqual([
      '1 row(s) with errors; nothing was written:',
      '  row 3: bad',
    ]);
  });

  test('dry-run and written', () => {
    expect(formatImportReport({ errors: [], sheets: [{ row: 2, bucketKey: 'k.pdf' }], results: [], written: false })).toEqual([
      '[dry-run] 1 row(s) OK. Would write:',
      '  row 2: k.pdf',
    ]);
    expect(formatImportReport({ errors: [], sheets: [], results: [{ row: 2, bucketKey: 'k.pdf', action: 'inserted' }], written: true })).toEqual([
      'Wrote 1 file(s):',
      '  row 2: k.pdf (inserted)',
    ]);
  });
});

describe('main', () => {
  const setup = (service = {}) => {
    const log = jest.fn();
    const error = jest.fn();
    const readFile = jest.fn().mockResolvedValue('csv');
    return { log, error, readFile, service };
  };

  test('usage error exits 2', async () => {
    const deps = setup();
    await expect(main([], deps)).resolves.toBe(2);
    expect(deps.error.mock.calls[0][0]).toMatch(/Give the inventory CSV[\s\S]*Usage:/);
  });

  test('passes the arguments to the import and exits 0 when clean', async () => {
    const importSummarySheets = jest.fn().mockResolvedValue({ errors: [], sheets: [], results: [], written: true });
    const deps = setup({ importSummarySheets });

    await expect(main(['inv.csv', '--files=drive', '--out=stage', '--dry-run=false'], deps)).resolves.toBe(0);
    expect(deps.readFile).toHaveBeenCalledWith('inv.csv');
    expect(importSummarySheets).toHaveBeenCalledWith({ csvText: 'csv', filesDir: 'drive', outDir: 'stage', dryRun: false });
  });

  test('exits 1 when rows have errors', async () => {
    const importSummarySheets = jest.fn().mockResolvedValue({ errors: [{ row: 2, message: 'bad' }], sheets: [], results: [], written: false });
    const deps = setup({ importSummarySheets });
    await expect(main(['inv.csv', '--files=drive'], deps)).resolves.toBe(1);
    expect(deps.error).toHaveBeenCalledWith('  row 2: bad');
  });

  test('a malformed inventory or unreadable file exits 2', async () => {
    const deps = setup({ importSummarySheets: jest.fn().mockRejectedValue(new Error('Inventory is missing column(s): part')) });
    await expect(main(['inv.csv', '--files=drive'], deps)).resolves.toBe(2);
    expect(deps.error).toHaveBeenCalledWith('Inventory is missing column(s): part');

    deps.readFile.mockRejectedValue(new Error('ENOENT'));
    await expect(main(['inv.csv', '--files=drive'], deps)).resolves.toBe(2);
  });

  test('--check-bucket needs BUCKET_PATH, and exits 1 when files are missing', async () => {
    const checkBucket = jest.fn().mockResolvedValue({ checked: 2, missing: ['https://b/x.pdf'] });
    const deps = setup({ checkBucket });

    await expect(main(['--check-bucket'], { ...deps, env: {} })).resolves.toBe(2);
    await expect(main(['--check-bucket'], { ...deps, env: { BUCKET_PATH: ' https://b ' } })).resolves.toBe(1);
    expect(checkBucket).toHaveBeenCalledWith({ bucketUrl: 'https://b' });
    expect(deps.log).toHaveBeenCalledWith('  missing: https://b/x.pdf');
  });
});
