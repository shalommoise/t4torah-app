// Pure helpers for a Time4Tefilla shiur: its title, the key that stops it
// going out twice, file names, and the Castos episode's description and tags.

const ARTIST = 'Time4Tefilla';
const MAX_KEY_LENGTH = 191;

// As in the Time4Mishna episode descriptions: no Mailchimp merge tags, which
// mean nothing in a podcast feed.
const EPISODE_LINKS = {
  website: 'https://www.time4torah.org',
  whatsappGroup: 'https://chat.whatsapp.com/BvXBkQsfjYQGqtD11sVXRo',
  donate: 'https://donate.jfutures.org/?message=I%20am%20supporting%20Time4Torah-Time4Tefilla',
};

/** Collapses runs of whitespace and trims; `''` for nothing. */
const tidyTitle = (title) => (title == null ? '' : String(title).replace(/\s+/g, ' ').trim());

/**
 * What identifies the shiur in send_log: its number when the title starts
 * with one (`877. Which ‘Good Years’…` → `877`), so a retyped title still
 * counts as the same shiur; otherwise the lower-cased title.
 *
 * @param {string} title
 * @returns {string}
 */
const shiurKeyFor = (title) => {
  const tidy = tidyTitle(title);
  const number = /^(\d+)\s*[.):\-–]/.exec(tidy);
  return (number ? number[1] : tidy.toLowerCase()).slice(0, MAX_KEY_LENGTH);
};

/**
 * A file-name-safe version of the title: `877-which-good-years-do-we-refer-to`.
 *
 * @param {string} title
 * @returns {string}
 */
const slugFor = (title) =>
  tidyTitle(title)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'shiur';

const escapeHtml = (value) =>
  String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * The Castos episode description (HTML).
 *
 * @param {string} title
 * @returns {string}
 */
const buildEpisodeDescription = (title) =>
  [
    escapeHtml(tidyTitle(title)),
    `<a href="${EPISODE_LINKS.whatsappGroup}">Join the Time4Tefilla WhatsApp Group</a>`,
    `<a href="${EPISODE_LINKS.website}">Time4Torah</a>`,
    '<em>Time4Torah is a member of the Jewish Futures family organisations</em>.',
    `<a href="${EPISODE_LINKS.donate}">Support Time4Tefilla</a>`,
  ]
    .map((paragraph) => `<p>${paragraph}</p>`)
    .join('\n');

/**
 * ID3 tags for the converted MP3.
 *
 * @param {string} title
 * @param {string} date YYYY-MM-DD
 */
const buildId3Tags = (title, date) => ({ title: tidyTitle(title), artist: ARTIST, album: ARTIST, year: String(date).slice(0, 4) });

module.exports = { ARTIST, EPISODE_LINKS, tidyTitle, shiurKeyFor, slugFor, buildEpisodeDescription, buildId3Tags };
