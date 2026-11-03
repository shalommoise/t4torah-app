const { zonedTimeToUtc } = require('../../utils/londonDate');

// When a Castos episode goes out. Pure: the clock is passed in.

const DEFAULT_PUBLISH_TIME = '05:15';

const zonedPartsFormats = new Map();

/** Wall-clock date and time at `instant` in `timeZone`. */
const zonedParts = (instant, timeZone) => {
  if (!zonedPartsFormats.has(timeZone)) {
    zonedPartsFormats.set(
      timeZone,
      new Intl.DateTimeFormat('en-GB', {
        timeZone,
        hourCycle: 'h23',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    );
  }
  const parts = Object.fromEntries(
    zonedPartsFormats.get(timeZone).formatToParts(instant).map(({ type, value }) => [type, value])
  );
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}:${parts.second}` };
};

/**
 * Decides when the episode for `date` is published:
 * - before `publishTime` (wall clock in `timeZone`) on that day, or any time
 *   on an earlier day: schedule it, with `post_date` = `date publishTime:00`;
 * - at or after `publishTime` on that day: publish now (no `post_date`);
 * - a later day than `date`: refuse, so a stale episode is never published.
 *
 * `post_date` is the wall-clock time in `timeZone`, the format the Castos
 * API documents ("YYYY-MM-DD HH:MM:SS"); which zone Castos reads it in is
 * checked by the integration script, not assumed here.
 *
 * @param {Date} now
 * @param {string} timeZone e.g. Europe/London
 * @param {{ date?: string, publishTime?: string }} [options] `date` (YYYY-MM-DD)
 *   defaults to today in `timeZone`; `publishTime` (HH:MM) to 05:15.
 * @returns {{ mode: 'schedule', post_date: string, at: Date } | { mode: 'publish_now' }}
 * @throws if `date` has already passed in `timeZone`.
 */
const computePublishPlan = (now, timeZone, { date, publishTime = DEFAULT_PUBLISH_TIME } = {}) => {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new TypeError('computePublishPlan requires a valid Date');
  }
  const today = zonedParts(now, timeZone).date;
  const target = date || today;
  if (target < today) {
    throw new Error(`${target} has passed in ${timeZone}; not publishing a stale episode`);
  }
  const at = zonedTimeToUtc(target, publishTime, timeZone);
  if (now.getTime() < at.getTime()) {
    return { mode: 'schedule', post_date: `${target} ${publishTime}:00`, at };
  }
  return { mode: 'publish_now' };
};

module.exports = { DEFAULT_PUBLISH_TIME, computePublishPlan };
