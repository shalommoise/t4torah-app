const { formatMishnaShiurLabel } = require('../shiurLabelService');
const { getSummaryLinks } = require('../render/emailLinks');

// Pure builders for a Time4Mishna Castos episode, following the episodes
// already on the show (uploaded by hand):
// - title: the dotted shiur label, e.g. `Shabbos 19.4-20.1` (as in the email);
// - description: HTML links to the shiur text, the masechta summaries, the
//   month's calendar, Time4Torah, and the donate page;
// - no episode_number / series_number / episode_type (empty on the live show).

const ARTIST = 'Time4Mishna';

const TIME4TORAH_URL = 'https://time4torah.org/';
// As in the hand-written descriptions. The email's donate link has Mailchimp
// merge tags, which mean nothing in a podcast feed.
const DONATE_URL = 'https://donate.jfutures.org/?message=I%20am%20supporting%20Time4Mishnah';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const escapeHtml = (value) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const link = (href, label) => `<a href="${escapeHtml(href)}" title="${escapeHtml(label)}">${escapeHtml(label)}</a>`;

/**
 * The one regular Time4Mishna shiur of the day, or `null` when there isn't
 * one (chazara, no shiur). Throws when there are several, which the schedule
 * never has, rather than guess which to publish.
 *
 * @param {{ time4mishna?: object[] }} content getDailyContent output.
 * @returns {object|null}
 */
const getRegularShiur = (content) => {
  const rows = ((content && content.time4mishna) || []).filter((row) => row && row.shiur_type === 'regular');
  if (rows.length > 1) {
    throw new Error(`Expected one regular Time4Mishna shiur, found ${rows.length}`);
  }
  return rows[0] || null;
};

/**
 * Episode title: the dotted label, e.g. `Shabbos 19.4-20.1`.
 *
 * @param {object} scheduleRow a regular Time4Mishna schedule row
 * @returns {string|null}
 */
const buildEpisodeTitle = (scheduleRow) => {
  const label = formatMishnaShiurLabel(scheduleRow);
  return label && label !== 'Chazara' ? label : null;
};

/**
 * Episode description (HTML). Only links whose files were found are included.
 *
 * @param {object} options
 * @param {string} options.title the episode title
 * @param {string} options.date YYYY-MM-DD, for the calendar's month name
 * @param {object} options.scheduleRow for the masechta summary labels
 * @param {string|null} options.bucketUrl
 * @param {string|null} options.textUrl the shiur text PDF, if it exists
 * @param {string|null} options.calendarUrl the month's calendar, if it exists
 * @param {string[]} options.summaryUrls the summary PDFs that exist
 * @returns {string}
 */
const buildEpisodeDescription = ({ title, date, scheduleRow, bucketUrl, textUrl, calendarUrl, summaryUrls = [] }) => {
  const paragraphs = [];
  if (textUrl) {
    paragraphs.push(link(textUrl, `${title} Text`));
  }
  const found = new Set(summaryUrls);
  const summaries = getSummaryLinks(scheduleRow, bucketUrl).filter((summary) => found.has(summary.url));
  if (summaries.length) {
    paragraphs.push(summaries.map((summary) => link(summary.url, summary.label)).join('<br>'));
  }
  if (calendarUrl) {
    const month = MONTHS[Number(String(date).slice(5, 7)) - 1];
    paragraphs.push(link(calendarUrl, `${month} Calendar`));
  }
  paragraphs.push(`<a href="${TIME4TORAH_URL}">Time4Torah</a>`);
  paragraphs.push('<em>Time4Torah is a member of the Jewish Futures family organisations</em>.');
  paragraphs.push(link(DONATE_URL, 'Support Time4Mishna'));
  return paragraphs.map((paragraph) => `<p>${paragraph}</p>`).join('\n');
};

const normaliseTitle = (title) => String(title || '').trim().replace(/\s+/g, ' ').toLowerCase();

/**
 * The episode already on the show with this title, or `null`. Titles are
 * unique per shiur, so the title alone decides (a matching date could be a
 * different, hand-scheduled episode).
 *
 * @param {{ id: number, post_title: string }[]} episodes
 * @param {string} title
 * @returns {object|null}
 */
const findExistingEpisode = (episodes, title) => {
  const wanted = normaliseTitle(title);
  return (episodes || []).find((episode) => normaliseTitle(episode.post_title) === wanted) || null;
};

/**
 * ID3 tags for the shiur's MP3.
 *
 * @param {string} title
 * @param {string} date YYYY-MM-DD
 */
const buildId3Tags = (title, date) => ({ title, artist: ARTIST, album: ARTIST, year: String(date).slice(0, 4) });

module.exports = {
  ARTIST,
  DONATE_URL,
  getRegularShiur,
  buildEpisodeTitle,
  buildEpisodeDescription,
  findExistingEpisode,
  buildId3Tags,
};
