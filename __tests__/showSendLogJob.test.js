const { parseArgs, main, UsageError } = require('../jobs/showSendLog');

const today = '2026-10-28';

describe('parseArgs', () => {
  test('defaults the date to today', () => {
    expect(parseArgs([], { today })).toEqual({ help: false, date: today });
    expect(parseArgs(['--date=2026-09-28'], { today }).date).toBe('2026-09-28');
  });

  test.each([
    [['--date=2026-9-28'], '--date must be YYYY-MM-DD'],
    [['--program=time4mishna'], 'Unknown option: --program'],
    [['2026-09-28'], 'Unexpected argument: 2026-09-28'],
  ])('%p throws a UsageError', (argv, text) => {
    expect(() => parseArgs(argv, { today })).toThrow(UsageError);
    expect(() => parseArgs(argv, { today })).toThrow(text);
  });
});

describe('main', () => {
  const log = {
    date: '2026-09-28',
    entries: [{ program: 'time4mishna', channel: 'email', mode: 'live', status: 'sent' }],
  };
  const deps = (overrides) => ({
    now: new Date('2026-10-28T12:00:00Z'),
    getSendLog: jest.fn().mockResolvedValue(log),
    closePool: jest.fn().mockResolvedValue(),
    log: jest.fn(),
    error: jest.fn(),
    ...overrides,
  });

  test('prints the send log for the date as JSON', async () => {
    const d = deps();

    await expect(main(['--date=2026-09-28'], d)).resolves.toBe(0);

    expect(d.getSendLog).toHaveBeenCalledWith({ date: '2026-09-28' });
    expect(JSON.parse(d.log.mock.calls[0][0])).toEqual(log);
    expect(d.closePool).toHaveBeenCalled();
  });

  test('defaults to today', async () => {
    const d = deps();

    await main([], d);

    expect(d.getSendLog).toHaveBeenCalledWith({ date: today });
  });

  test('an invalid calendar date from the service exits 2', async () => {
    const error = Object.assign(new Error('date must be a valid date in YYYY-MM-DD format'), { status: 400 });
    const d = deps({ getSendLog: jest.fn().mockRejectedValue(error) });

    await expect(main(['--date=2026-02-30'], d)).resolves.toBe(2);
    expect(d.closePool).toHaveBeenCalled();
  });

  test('a DB failure exits 1', async () => {
    const d = deps({ getSendLog: jest.fn().mockRejectedValue(new Error('connection lost')) });

    await expect(main([], d)).resolves.toBe(1);
    expect(d.error).toHaveBeenCalledWith('Reading send_log failed: connection lost');
  });

  test('usage errors exit 2 without touching the DB', async () => {
    const d = deps();

    await expect(main(['--nope'], d)).resolves.toBe(2);
    expect(d.getSendLog).not.toHaveBeenCalled();
    expect(d.closePool).not.toHaveBeenCalled();
  });
});
