const { startScheduler } = require('../src/services/scheduler');

const fakeCron = () => {
  const jobs = [];
  return {
    jobs,
    schedule: jest.fn((expression, fn, options) => {
      const job = { expression, fn, options, stop: jest.fn() };
      jobs.push(job);
      return job;
    }),
  };
};

const logger = () => ({ log: jest.fn(), error: jest.fn() });
const runWithRole = jest.fn((role, fn) => fn());
const ENABLED = { SCHEDULER_ENABLED: 'true' };

beforeEach(() => runWithRole.mockClear());

describe('startScheduler', () => {
  test('does nothing unless SCHEDULER_ENABLED=true', () => {
    const cron = fakeCron();
    const buildTasks = jest.fn();
    const log = logger();

    expect(startScheduler({ env: {}, cron, buildTasks, logger: log, runWithRole })).toBeNull();
    expect(cron.schedule).not.toHaveBeenCalled();
    expect(buildTasks).not.toHaveBeenCalled();
    expect(log.log).toHaveBeenCalledWith(expect.stringContaining('[scheduler] off'));
  });

  test('a config problem logs NOT STARTED instead of throwing', () => {
    const cron = fakeCron();
    const log = logger();
    const buildTasks = jest.fn(() => {
      throw new Error('BUCKET_PATH is required');
    });

    expect(startScheduler({ env: ENABLED, cron, buildTasks, logger: log, runWithRole })).toBeNull();
    expect(cron.schedule).not.toHaveBeenCalled();
    expect(log.error).toHaveBeenCalledWith('[scheduler] NOT STARTED: BUCKET_PATH is required');
  });

  test('schedules the evening and morning runs in Europe/London', () => {
    const cron = fakeCron();
    const tasks = { evening: jest.fn(), morning: jest.fn() };

    startScheduler({ env: ENABLED, cron, buildTasks: () => tasks, logger: logger(), runWithRole });

    expect(cron.jobs.map(({ expression, options }) => [expression, options.timezone])).toEqual([
      ['0 21 * * *', 'Europe/London'],
      ['30 4 * * *', 'Europe/London'],
    ]);
  });

  test('runs each task with the write DB role and logs the outcome', async () => {
    const cron = fakeCron();
    const log = logger();
    const tasks = {
      evening: jest.fn(async () => ({ ok: true, failures: [] })),
      morning: jest.fn(async () => ({ ok: false, failures: ['email 2026-11-11: status failed'] })),
    };
    startScheduler({ env: ENABLED, cron, buildTasks: () => tasks, logger: log, runWithRole });

    await cron.jobs[0].fn();
    await cron.jobs[1].fn();

    expect(runWithRole).toHaveBeenCalledTimes(2);
    expect(runWithRole.mock.calls.every(([role]) => role === 'write')).toBe(true);
    expect(log.log).toHaveBeenCalledWith(expect.stringMatching(/^\[scheduler\] evening run finished ok/));
    expect(log.error).toHaveBeenCalledWith(
      expect.stringMatching(/^\[scheduler\] morning run finished with 1 failure\(s\).*email 2026-11-11: status failed$/)
    );
  });

  test('a thrown error is caught and logged', async () => {
    const cron = fakeCron();
    const log = logger();
    const tasks = { evening: jest.fn().mockRejectedValue(new Error('boom')), morning: jest.fn() };
    startScheduler({ env: ENABLED, cron, buildTasks: () => tasks, logger: log, runWithRole });

    await expect(cron.jobs[0].fn()).resolves.toEqual({ ok: false, failures: ['boom'] });
    expect(log.error).toHaveBeenCalledWith('[scheduler] evening run FAILED: boom');
  });

  test('skips a run while another is still going', async () => {
    const cron = fakeCron();
    const log = logger();
    let finish;
    const tasks = {
      evening: jest.fn(() => new Promise((resolve) => (finish = resolve))),
      morning: jest.fn(async () => ({ ok: true, failures: [] })),
    };
    const scheduler = startScheduler({ env: ENABLED, cron, buildTasks: () => tasks, logger: log, runWithRole });

    const evening = scheduler.runNow('evening');
    await expect(scheduler.runNow('morning')).resolves.toBeNull();
    expect(tasks.morning).not.toHaveBeenCalled();
    expect(log.error).toHaveBeenCalledWith('[scheduler] morning run skipped: the evening run is still going');

    finish({ ok: true, failures: [] });
    await evening;
    await scheduler.runNow('morning');
    expect(tasks.morning).toHaveBeenCalledTimes(1);
  });

  test('stop() stops both jobs', () => {
    const cron = fakeCron();
    const scheduler = startScheduler({
      env: ENABLED,
      cron,
      buildTasks: () => ({ evening: jest.fn(), morning: jest.fn() }),
      logger: logger(),
      runWithRole,
    });
    scheduler.stop();
    expect(cron.jobs.every((job) => job.stop.mock.calls.length === 1)).toBe(true);
  });
});
