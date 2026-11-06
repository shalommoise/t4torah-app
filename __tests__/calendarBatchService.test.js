jest.mock('../src/models/datesModel', () => ({ selectTime4MishnaScheduleMonths: jest.fn() }));
jest.mock('../src/services/calendarService', () => ({ generateCalendarAssets: jest.fn() }));
jest.mock('../src/services/calendarExportService', () => ({ exportCalendarAssets: jest.fn() }));

const { selectTime4MishnaScheduleMonths } = require('../src/models/datesModel');
const { generateCalendarAssets } = require('../src/services/calendarService');
const { exportCalendarAssets } = require('../src/services/calendarExportService');
const { exportScheduledCalendars, exportMonth } = require('../src/services/calendarBatchService');

beforeEach(() => jest.clearAllMocks());

describe('exportMonth', () => {
  test('renders the HTML with file-relative images and exports from that file', async () => {
    generateCalendarAssets.mockResolvedValue({ htmlPath: '/g/calendar_11_2026.html' });
    exportCalendarAssets.mockResolvedValue({ pngPath: '/g/T4M-11-26.png' });

    await expect(exportMonth({ month: 11, year: 2026 })).resolves.toEqual({ pngPath: '/g/T4M-11-26.png' });
    expect(generateCalendarAssets).toHaveBeenCalledWith({ month: 11, year: 2026, assetBasePath: '../../imgs' });
    expect(exportCalendarAssets).toHaveBeenCalledWith({ month: 11, year: 2026, htmlPath: '/g/calendar_11_2026.html' });
  });
});

describe('exportScheduledCalendars', () => {
  test('exports only the scheduled months from fromDate, and keeps going past a failure', async () => {
    selectTime4MishnaScheduleMonths.mockResolvedValue([
      { year: 2026, month: 11 },
      { year: 2026, month: 12 },
      { year: 2027, month: 1 },
    ]);
    const exportOne = jest
      .fn()
      .mockResolvedValueOnce({ pngPath: '/g/T4M-11-26.png' })
      .mockRejectedValueOnce(new Error('chrome crashed'))
      .mockResolvedValueOnce({ pngPath: '/g/T4M-01-27.png' });
    const log = jest.fn();

    const result = await exportScheduledCalendars({ fromDate: '2026-11-01', log, deps: { exportMonth: exportOne } });

    expect(selectTime4MishnaScheduleMonths).toHaveBeenCalledWith('2026-11-01');
    expect(exportOne.mock.calls.map(([t]) => t)).toEqual([
      { year: 2026, month: 11 },
      { year: 2026, month: 12 },
      { year: 2027, month: 1 },
    ]);
    expect(result).toEqual({
      exported: ['/g/T4M-11-26.png', '/g/T4M-01-27.png'],
      failed: [{ month: '2026-12', error: 'chrome crashed' }],
    });
    expect(log).toHaveBeenCalledWith('2026-11 → T4M-11-26.png');
    expect(log).toHaveBeenCalledWith('2026-12 FAILED: chrome crashed');
  });

  test('does nothing when no months are scheduled', async () => {
    const exportOne = jest.fn();
    const result = await exportScheduledCalendars({ deps: { listMonths: async () => [], exportMonth: exportOne } });
    expect(result).toEqual({ exported: [], failed: [] });
    expect(exportOne).not.toHaveBeenCalled();
  });
});
