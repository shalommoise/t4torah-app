const { computePublishPlan } = require('../castos/publishPlan');
const { planDelivery, zonedToday } = require('../mailchimp/campaign');

/**
 * When the Time4Tefilla episode and email go out, using the daily send's
 * helpers and times: processed before the send time (05:15 Europe/London by
 * default), both are scheduled for that time today; after it, both go out now.
 *
 * Mailchimp needs 5 minutes' notice to schedule, so just before the send time
 * the email goes out at once; the episode is then published at once too, so
 * the email never links to an episode that is not out yet.
 *
 * @param {object} options
 * @param {Date} options.now
 * @param {string} options.timeZone
 * @param {string} options.publishTime HH:MM (CASTOS_PUBLISH_TIME)
 * @param {string} options.sendTime HH:MM (SEND_TIME)
 * @returns {{
 *   date: string,
 *   castos: { mode: 'schedule', post_date: string, at: Date } | { mode: 'publish_now' },
 *   email: { action: 'schedule', at: Date } | { action: 'send', late: true, at: Date },
 * }}
 */
const planTefillaSend = ({ now, timeZone, publishTime, sendTime }) => {
  const date = zonedToday(now, timeZone);
  const email = planDelivery({ date, now, sendTime, sendTimeZone: timeZone });
  const castos = computePublishPlan(now, timeZone, { date, publishTime });
  return {
    date,
    castos: email.action === 'send' && castos.mode === 'schedule' ? { mode: 'publish_now' } : castos,
    email,
  };
};

/**
 * One line for the logs, e.g. `episode scheduled for 2026-11-17 05:15:00, email scheduled for 2026-11-17T05:15:00.000Z`.
 *
 * @param {ReturnType<typeof planTefillaSend>} plan
 * @returns {string}
 */
const describePlan = (plan) =>
  [
    plan.castos.mode === 'schedule' ? `episode scheduled for ${plan.castos.post_date}` : 'episode published now',
    plan.email.action === 'schedule' ? `email scheduled for ${plan.email.at.toISOString()}` : 'email sent now',
  ].join(', ');

module.exports = { planTefillaSend, describePlan };
