jest.mock('child_process', () => ({ execFile: jest.fn() }));
jest.mock('fs/promises', () => ({ mkdir: jest.fn().mockResolvedValue() }));

const { execFile } = require('child_process');
const {
  exportCalendarAssets,
  getPngFileName,
  parseExportHeight,
  toExportSource,
} = require('../src/services/calendarExportService');

describe('getPngFileName', () => {
  test.each([
    [{ month: 10, year: 2026 }, 'T4M-10-26.png'],
    [{ month: '1', year: '2027' }, 'T4M-01-27.png'],
    [{ month: '04', year: 2030 }, 'T4M-04-30.png'],
    [{ month: 12, year: 2100 }, 'T4M-12-00.png'],
  ])('%p → %s', (input, name) => {
    expect(getPngFileName(input)).toBe(name);
  });
});

describe('parseExportHeight', () => {
  test('reads data-export-height from the dumped DOM', () => {
    expect(parseExportHeight('<body class="export" data-export-height="852">')).toBe(852);
  });

  test.each([[''], ['<body class="export">'], ['<body data-export-height="0">'], [undefined]])(
    'throws when the height is missing: %p',
    (dom) => {
      expect(() => parseExportHeight(dom)).toThrow('data-export-height missing');
    }
  );
});

describe('toExportSource', () => {
  test('sets the #export fragment, replacing any existing one', () => {
    expect(toExportSource('file:///x/calendar_11_2026.html')).toBe('file:///x/calendar_11_2026.html#export');
    expect(toExportSource('http://h:3000/calendar?month=1&year=2027#top')).toBe(
      'http://h:3000/calendar?month=1&year=2027#export'
    );
  });
});

describe('exportCalendarAssets', () => {
  beforeEach(() => {
    execFile.mockReset();
    execFile.mockImplementation((bin, args, options, callback) => {
      const stdout = args.includes('--dump-dom') ? '<body data-export-height="969"></body>' : '';
      callback(null, { stdout, stderr: '' });
    });
  });

  test('prints the PDF, measures the card, then screenshots it at exactly that size', async () => {
    const result = await exportCalendarAssets({
      month: '12',
      year: 2028,
      htmlPath: '/repo/calendar/generated/calendar_12_2028.html',
    });

    expect(result.pngPath).toMatch(/calendar\/generated\/T4M-12-28\.png$/);
    expect(result.pdfPath).toMatch(/calendar\/generated\/calendar_12_2028\.pdf$/);

    const calls = execFile.mock.calls.map(([, args]) => args);
    expect(calls).toHaveLength(3);

    const [pdfArgs, measureArgs, shotArgs] = calls;
    expect(pdfArgs).toContain(`--print-to-pdf=${result.pdfPath}`);
    expect(pdfArgs[pdfArgs.length - 1]).toBe('file:///repo/calendar/generated/calendar_12_2028.html');

    expect(measureArgs).toEqual(expect.arrayContaining(['--dump-dom', '--allow-file-access-from-files']));
    expect(measureArgs[measureArgs.length - 1]).toBe(
      'file:///repo/calendar/generated/calendar_12_2028.html#export'
    );

    expect(shotArgs).toEqual(
      expect.arrayContaining([
        '--window-size=1100,969',
        '--default-background-color=00000000',
        `--screenshot=${result.pngPath}`,
      ])
    );
    expect(shotArgs[shotArgs.length - 1]).toMatch(/#export$/);
  });

  test('fails without a screenshot when the page reports no height', async () => {
    execFile.mockImplementation((bin, args, options, callback) => callback(null, { stdout: '<body></body>' }));

    await expect(exportCalendarAssets({ month: 1, year: 2027, htmlPath: '/x.html' })).rejects.toThrow(
      'data-export-height missing'
    );
    expect(execFile.mock.calls.some(([, args]) => args.some((a) => a.startsWith('--screenshot')))).toBe(false);
  });
});
