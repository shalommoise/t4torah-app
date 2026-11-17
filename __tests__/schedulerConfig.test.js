const { getSchedulerConfig, timeToCron } = require('../src/config/scheduler');

describe('getSchedulerConfig', () => {
  test('is off by default, with the default times and Castos 7 days ahead', () => {
    expect(getSchedulerConfig({})).toEqual({
      enabled: false,
      eveningTime: '21:00',
      morningTime: '04:30',
      castos: true,
      castosDays: 7,
      castosPodcast: 'test',
      timeZone: 'Europe/London',
    });
  });

  test('reads every setting', () => {
    expect(
      getSchedulerConfig({
        SCHEDULER_ENABLED: 'true',
        SCHEDULER_EVENING_TIME: '20:45',
        SCHEDULER_MORNING_TIME: '04:00',
        SCHEDULER_CASTOS: 'false',
        SCHEDULER_CASTOS_DAYS: '3',
        SCHEDULER_CASTOS_PODCAST: 'live',
        SEND_TIMEZONE: 'Europe/London',
      })
    ).toEqual({
      enabled: true,
      eveningTime: '20:45',
      morningTime: '04:00',
      castos: false,
      castosDays: 3,
      castosPodcast: 'live',
      timeZone: 'Europe/London',
    });
  });

  test('lists every problem in one error', () => {
    expect(() =>
      getSchedulerConfig({
        SCHEDULER_ENABLED: 'yes',
        SCHEDULER_MORNING_TIME: '4:30',
        SCHEDULER_CASTOS_DAYS: '0',
        SEND_TIMEZONE: 'Mars/Base',
      })
    ).toThrow(
      /SCHEDULER_ENABLED must be true or false.*SCHEDULER_MORNING_TIME must be HH:MM.*SCHEDULER_CASTOS_DAYS must be a whole number.*SEND_TIMEZONE/
    );
  });

  test('rejects an unknown Castos show', () => {
    expect(() => getSchedulerConfig({ SCHEDULER_CASTOS_PODCAST: 'prod' })).toThrow('SCHEDULER_CASTOS_PODCAST must be test or live');
  });

  test('caps Castos days at 30', () => {
    expect(() => getSchedulerConfig({ SCHEDULER_CASTOS_DAYS: '31' })).toThrow('from 1 to 30');
  });
});

describe('timeToCron', () => {
  test.each([
    ['21:00', '0 21 * * *'],
    ['04:30', '30 4 * * *'],
  ])('%s → %s', (time, cron) => {
    expect(timeToCron(time)).toBe(cron);
  });
});
