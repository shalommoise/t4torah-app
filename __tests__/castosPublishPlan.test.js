const { computePublishPlan } = require('../src/services/castos/publishPlan');

const TZ = 'Europe/London';

describe('computePublishPlan', () => {
  describe('on the target day (GMT, winter)', () => {
    const date = '2026-11-03'; // 05:15 GMT = 05:15Z

    test('before 05:15: schedules for 05:15 that day', () => {
      expect(computePublishPlan(new Date('2026-11-03T05:14:59Z'), TZ, { date })).toEqual({
        mode: 'schedule',
        post_date: '2026-11-03 05:15:00',
        at: new Date('2026-11-03T05:15:00Z'),
      });
    });

    test('exactly 05:15: publishes now', () => {
      expect(computePublishPlan(new Date('2026-11-03T05:15:00Z'), TZ, { date })).toEqual({ mode: 'publish_now' });
    });

    test('after 05:15: publishes now', () => {
      expect(computePublishPlan(new Date('2026-11-03T14:00:00Z'), TZ, { date })).toEqual({ mode: 'publish_now' });
    });

    test('late evening, still the same London day: publishes now', () => {
      expect(computePublishPlan(new Date('2026-11-03T23:59:00Z'), TZ, { date })).toEqual({ mode: 'publish_now' });
    });
  });

  describe('in BST (summer)', () => {
    const date = '2026-07-01'; // 05:15 BST = 04:15Z

    test('04:14Z is 05:14 BST: schedules', () => {
      expect(computePublishPlan(new Date('2026-07-01T04:14:00Z'), TZ, { date })).toMatchObject({
        mode: 'schedule',
        post_date: '2026-07-01 05:15:00',
        at: new Date('2026-07-01T04:15:00Z'),
      });
    });

    test('04:15Z is exactly 05:15 BST: publishes now', () => {
      expect(computePublishPlan(new Date('2026-07-01T04:15:00Z'), TZ, { date })).toEqual({ mode: 'publish_now' });
    });

    test('05:00Z is 06:00 BST: publishes now (UTC clock alone would schedule)', () => {
      expect(computePublishPlan(new Date('2026-07-01T05:00:00Z'), TZ, { date })).toEqual({ mode: 'publish_now' });
    });
  });

  describe('DST boundaries', () => {
    test('clocks go forward (Sun 29 Mar 2026): 05:15 is BST, 04:15Z', () => {
      const date = '2026-03-29';
      expect(computePublishPlan(new Date('2026-03-29T04:14:00Z'), TZ, { date })).toMatchObject({
        mode: 'schedule',
        at: new Date('2026-03-29T04:15:00Z'),
      });
      expect(computePublishPlan(new Date('2026-03-29T04:15:00Z'), TZ, { date })).toEqual({ mode: 'publish_now' });
    });

    test('clocks go back (Sun 25 Oct 2026): 05:15 is GMT, 05:15Z', () => {
      const date = '2026-10-25';
      // 04:30Z is 04:30 GMT: still before 05:15.
      expect(computePublishPlan(new Date('2026-10-25T04:30:00Z'), TZ, { date })).toMatchObject({
        mode: 'schedule',
        post_date: '2026-10-25 05:15:00',
        at: new Date('2026-10-25T05:15:00Z'),
      });
      expect(computePublishPlan(new Date('2026-10-25T05:15:00Z'), TZ, { date })).toEqual({ mode: 'publish_now' });
    });

    test('evening before the clocks go back schedules for 05:15 GMT', () => {
      expect(computePublishPlan(new Date('2026-10-24T20:00:00Z'), TZ, { date: '2026-10-25' })).toMatchObject({
        mode: 'schedule',
        at: new Date('2026-10-25T05:15:00Z'),
      });
    });
  });

  test('a later target day (the evening before): schedules', () => {
    expect(computePublishPlan(new Date('2026-11-02T21:00:00Z'), TZ, { date: '2026-11-03' })).toMatchObject({
      mode: 'schedule',
      post_date: '2026-11-03 05:15:00',
    });
  });

  test('a date that has passed in London: refuses', () => {
    expect(() => computePublishPlan(new Date('2026-11-04T00:30:00Z'), TZ, { date: '2026-11-03' })).toThrow(
      /2026-11-03 has passed in Europe\/London/
    );
  });

  test('uses the London date, not UTC, to decide the day', () => {
    // 23:30Z on 30 June is 00:30 BST on 1 July: 1 July is today, before 05:15.
    expect(computePublishPlan(new Date('2026-06-30T23:30:00Z'), TZ, { date: '2026-07-01' })).toMatchObject({
      mode: 'schedule',
    });
    expect(() => computePublishPlan(new Date('2026-06-30T23:30:00Z'), TZ, { date: '2026-06-30' })).toThrow(
      /has passed/
    );
  });

  test('date defaults to today in the time zone', () => {
    expect(computePublishPlan(new Date('2026-11-03T03:00:00Z'), TZ)).toMatchObject({
      mode: 'schedule',
      post_date: '2026-11-03 05:15:00',
    });
  });

  test('takes another publish time', () => {
    expect(computePublishPlan(new Date('2026-11-03T05:10:00Z'), TZ, { date: '2026-11-03', publishTime: '05:05' })).toEqual({
      mode: 'publish_now',
    });
  });

  test('rejects an invalid clock', () => {
    expect(() => computePublishPlan(new Date('nope'), TZ)).toThrow(TypeError);
  });
});
