const { parseArgs, main } = require('../jobs/runScheduledTask');

const deps = (task) => ({
  env: {},
  log: jest.fn(),
  error: jest.fn(),
  getSchedulerConfig: jest.fn(() => ({ castos: true, castosDays: 7 })),
  buildScheduledTasks: jest.fn(() => ({ evening: task, morning: task })),
  closePool: jest.fn(),
});

describe('parseArgs', () => {
  test('accepts --run=evening and --run=morning', () => {
    expect(parseArgs(['--run=evening'])).toEqual({ help: false, run: 'evening' });
    expect(parseArgs(['--run=morning'])).toEqual({ help: false, run: 'morning' });
  });

  test('rejects anything else', () => {
    expect(() => parseArgs([])).toThrow('--run=evening');
    expect(() => parseArgs(['--run=noon'])).toThrow('--run=evening');
  });
});

describe('main', () => {
  test('runs the task, closes the pool and exits 0 when ok', async () => {
    const d = deps(jest.fn(async () => ({ ok: true, failures: [] })));
    await expect(main(['--run=evening'], d)).resolves.toBe(0);
    expect(d.closePool).toHaveBeenCalledTimes(1);
  });

  test('exits 1 on failures', async () => {
    const d = deps(jest.fn(async () => ({ ok: false, failures: ['email: x'] })));
    await expect(main(['--run=morning'], d)).resolves.toBe(1);
    expect(d.error).toHaveBeenCalledWith('[scheduler] morning run finished with failures: email: x');
  });

  test('exits 2 on a config error, without running', async () => {
    const task = jest.fn();
    const d = { ...deps(task), buildScheduledTasks: jest.fn(() => { throw new Error('BUCKET_PATH is required'); }) };
    await expect(main(['--run=evening'], d)).resolves.toBe(2);
    expect(task).not.toHaveBeenCalled();
  });
});
