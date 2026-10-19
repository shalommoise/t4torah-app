const { zonedTimeToUtc } = require('../../utils/londonDate');

// Pure helpers that turn a rendered DailyMessage into Mailchimp requests.
// Shared by the live sender and the dry-run preview so both build the same thing.

// Programs that go to the Mailchimp audience. Time4Nach is out of scope for
// now; sending it would reach the same audience as Time4Mishna.
const MAILCHIMP_PROGRAMS = ['time4mishna'];

// Mailchimp's unsubscribe merge tag. Set EMAIL_UNSUBSCRIBE_URL to this.
const UNSUBSCRIBE_TAG = '*|UNSUB|*';

// A schedule time must be in the future; closer than this, send at once.
const MIN_SCHEDULE_LEAD_MS = 5 * 60 * 1000;

/**
 * Why `message` can't go to Mailchimp, or `null` if it can.
 *
 * @param {import('../render/dailyMessage').DailyMessage} message
 * @returns {string|null}
 */
const getCampaignProblem = (message) => {
  if (!MAILCHIMP_PROGRAMS.includes(message.program)) {
    return `Mailchimp sends only ${MAILCHIMP_PROGRAMS.join(', ')} (got ${message.program})`;
  }
  if (!message.email.html.includes(UNSUBSCRIBE_TAG)) {
    return `Email has no ${UNSUBSCRIBE_TAG} link; set EMAIL_UNSUBSCRIBE_URL=${UNSUBSCRIBE_TAG}`;
  }
  return null;
};

/**
 * Request bodies for creating the campaign and setting its content. The
 * campaign targets the whole audience with no segment, so Mailchimp delivers
 * only to subscribed members.
 *
 * @param {import('../render/dailyMessage').DailyMessage} message
 * @param {{ audienceId: string, fromName: string, replyTo: string }} config
 * @returns {{ campaign: object, content: object }}
 */
const buildCampaignRequests = (message, { audienceId, fromName, replyTo }) => ({
  campaign: {
    type: 'regular',
    recipients: { list_id: audienceId },
    settings: {
      subject_line: message.email.subject,
      title: `${message.program} ${message.date}`,
      from_name: fromName,
      reply_to: replyTo,
    },
  },
  content: {
    html: message.email.html,
    plain_text: message.email.text,
  },
});

const zonedDateFormats = new Map();

/** The calendar date at `instant` in `timeZone`, as YYYY-MM-DD. */
const zonedToday = (instant, timeZone) => {
  if (!zonedDateFormats.has(timeZone)) {
    // en-CA formats dates as YYYY-MM-DD.
    zonedDateFormats.set(timeZone, new Intl.DateTimeFormat('en-CA', { timeZone, dateStyle: 'short' }));
  }
  return zonedDateFormats.get(timeZone).format(instant);
};

/**
 * Decides when the campaign goes out:
 * - before the send time (with 5 minutes to spare): schedule it for the send time;
 * - later on the send date itself (e.g. a retry): send now, flagged `late`;
 * - a date that has already passed: refuse, so a stale email is never sent.
 *
 * @param {object} options
 * @param {string} options.date YYYY-MM-DD
 * @param {Date} options.now
 * @param {string} options.sendTime HH:MM
 * @param {string} options.sendTimeZone
 * @returns {{ action: 'schedule', at: Date } | { action: 'send', late: true, at: Date }}
 * @throws if the date has passed.
 */
const planDelivery = ({ date, now, sendTime, sendTimeZone }) => {
  const at = zonedTimeToUtc(date, sendTime, sendTimeZone);
  if (at.getTime() - now.getTime() >= MIN_SCHEDULE_LEAD_MS) {
    return { action: 'schedule', at };
  }
  if (zonedToday(now, sendTimeZone) === date) {
    return { action: 'send', late: true, at };
  }
  throw new Error(`${date} has passed in ${sendTimeZone}; not sending a stale email`);
};

module.exports = {
  MAILCHIMP_PROGRAMS,
  UNSUBSCRIBE_TAG,
  MIN_SCHEDULE_LEAD_MS,
  getCampaignProblem,
  buildCampaignRequests,
  planDelivery,
};
