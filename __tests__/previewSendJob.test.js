const { parseArgs, main, UsageError } = require('../jobs/previewSend');

const today = '2026-10-28';
const httpError = (status, message) => Object.assign(new Error(message), { status });

describe('parseArgs', () => {
  test('defaults the date to today and leaves program and channel to the service', () => {
    expect(parseArgs([], { today })).toEqual({ help: false, date: today });
  });

  test('reads every option', () => {
    expect(
      parseArgs(['--date=2026-09-28', '--program=time4nach', '--channel=email', '--html=out.html'], { today })
    ).toEqual({ help: false, date: '2026-09-28', program: 'time4nach', channel: 'email', html: 'out.html' });
  });

  test.each([
    [['--date=28/09/2026'], '--date must be YYYY-MM-DD'],
    [['--program='], '--program needs a value'],
    [['--channel'], '--channel needs a value'],
    [['--html=out.html', '--channel=whatsapp'], '--html writes the email'],
    [['--live'], 'Unknown option: --live'],
    [['extra'], 'Unexpected argument: extra'],
  ])('%p throws a UsageError', (argv, text) => {
    expect(() => parseArgs(argv, { today })).toThrow(UsageError);
    expect(() => parseArgs(argv, { today })).toThrow(text);
  });
});

describe('main', () => {
  const preview = {
    date: '2026-09-28',
    program: 'time4mishna',
    sendDay: true,
    email: { subject: 'Subject', html: '<p>email</p>', text: 'email' },
    whatsapp: { text: 'wa' },
  };
  const deps = (overrides) => ({
    now: new Date('2026-10-28T12:00:00Z'),
    getSendPreview: jest.fn().mockResolvedValue(preview),
    writeFile: jest.fn().mockResolvedValue(),
    closePool: jest.fn().mockResolvedValue(),
    log: jest.fn(),
    error: jest.fn(),
    ...overrides,
  });

  test('prints the preview as JSON, defaulting to today', async () => {
    const d = deps();

    await expect(main([], d)).resolves.toBe(0);

    expect(d.getSendPreview).toHaveBeenCalledWith({ date: today, program: undefined, channel: undefined });
    expect(JSON.parse(d.log.mock.calls[0][0])).toEqual(preview);
    expect(d.closePool).toHaveBeenCalled();
  });

  test('passes program and channel through', async () => {
    const d = deps();

    await main(['--date=2026-09-28', '--program=combined', '--channel=whatsapp'], d);

    expect(d.getSendPreview).toHaveBeenCalledWith({ date: '2026-09-28', program: 'combined', channel: 'whatsapp' });
  });

  test('--html writes only the email HTML to the file', async () => {
    const d = deps();

    await expect(main(['--date=2026-09-28', '--html=preview.html'], d)).resolves.toBe(0);

    expect(d.getSendPreview).toHaveBeenCalledWith({ date: '2026-09-28', program: undefined, channel: 'email' });
    expect(d.writeFile).toHaveBeenCalledWith('preview.html', '<p>email</p>');
    expect(d.log).toHaveBeenCalledWith(expect.stringContaining('written to preview.html'));
  });

  test('a 400 from the service (bad program) exits 2', async () => {
    const d = deps({ getSendPreview: jest.fn().mockRejectedValue(httpError(400, 'program must be one of: ...')) });

    await expect(main(['--program=nope'], d)).resolves.toBe(2);
    expect(d.error).toHaveBeenCalledWith('Preview failed: program must be one of: ...');
    expect(d.closePool).toHaveBeenCalled();
  });

  test('a date not in dates_table exits 1', async () => {
    const d = deps({ getSendPreview: jest.fn().mockRejectedValue(httpError(404, 'No date row for 2099-01-01')) });

    await expect(main(['--date=2099-01-01'], d)).resolves.toBe(1);
  });

  test('usage errors exit 2 without touching the DB', async () => {
    const d = deps();

    await expect(main(['--bogus'], d)).resolves.toBe(2);
    expect(d.getSendPreview).not.toHaveBeenCalled();
    expect(d.closePool).not.toHaveBeenCalled();
  });

  test('--help prints usage and exits 0', async () => {
    const d = deps();

    await expect(main(['--help'], d)).resolves.toBe(0);
    expect(d.log).toHaveBeenCalledWith(expect.stringContaining('npm run sends:preview'));
    expect(d.getSendPreview).not.toHaveBeenCalled();
  });

  test('a pool close failure is reported but does not change the exit code', async () => {
    const d = deps({ closePool: jest.fn().mockRejectedValue(new Error('already closed')) });

    await expect(main([], d)).resolves.toBe(0);
    expect(d.error).toHaveBeenCalledWith('Closing the DB pool failed: already closed');
  });
});
