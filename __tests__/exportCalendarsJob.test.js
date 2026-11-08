const { parseArgs, main, UsageError } = require('../jobs/exportCalendars');

const today = '2026-11-05';

describe('parseArgs', () => {
  test('defaults to the first of the current month', () => {
    expect(parseArgs([], { today })).toEqual({ help: false, fromDate: '2026-11-01' });
  });

  test('--from picks the start month, --all removes the limit', () => {
    expect(parseArgs(['--from=2027-03'], { today }).fromDate).toBe('2027-03-01');
    expect(parseArgs(['--all'], { today }).fromDate).toBeNull();
    expect(parseArgs(['--help'], { today }).help).toBe(true);
  });

  test.each([
    [['--from=2027-3'], '--from must be YYYY-MM'],
    [['--from=2027-13'], '--from must be YYYY-MM'],
    [['--all', '--from=2027-01'], 'cannot be used together'],
    [['--all=yes'], 'Unexpected argument'],
    [['2027'], 'Unexpected argument'],
  ])('%p throws a UsageError', (argv, text) => {
    expect(() => parseArgs(argv, { today })).toThrow(UsageError);
    expect(() => parseArgs(argv, { today })).toThrow(text);
  });
});

describe('main', () => {
  const deps = (overrides) => ({
    now: new Date('2026-11-05T12:00:00Z'),
    exportScheduledCalendars: jest.fn().mockResolvedValue({ exported: ['a.png', 'b.png'], failed: [] }),
    closePool: jest.fn().mockResolvedValue(),
    log: jest.fn(),
    error: jest.fn(),
    ...overrides,
  });

  test('exports from the current month and closes the pool', async () => {
    const d = deps();
    await expect(main([], d)).resolves.toBe(0);
    expect(d.exportScheduledCalendars).toHaveBeenCalledWith({ fromDate: '2026-11-01', log: d.log });
    expect(d.log).toHaveBeenCalledWith('2 calendar(s) exported, 0 failed');
    expect(d.closePool).toHaveBeenCalled();
  });

  test('exits 1 when any month failed', async () => {
    const d = deps({
      exportScheduledCalendars: jest.fn().mockResolvedValue({ exported: [], failed: [{ month: '2027-01', error: 'x' }] }),
    });
    await expect(main(['--all'], d)).resolves.toBe(1);
    expect(d.exportScheduledCalendars).toHaveBeenCalledWith({ fromDate: null, log: d.log });
  });

  test('exits 1 and still closes the pool when the export throws', async () => {
    const d = deps({ exportScheduledCalendars: jest.fn().mockRejectedValue(new Error('db down')) });
    await expect(main([], d)).resolves.toBe(1);
    expect(d.error).toHaveBeenCalledWith('Calendar export failed: db down');
    expect(d.closePool).toHaveBeenCalled();
  });

  test('usage errors exit 2 without touching the DB', async () => {
    const d = deps();
    await expect(main(['--from=nope'], d)).resolves.toBe(2);
    expect(d.exportScheduledCalendars).not.toHaveBeenCalled();
    expect(d.closePool).not.toHaveBeenCalled();
  });
});
