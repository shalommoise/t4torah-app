const {
  formatMishnaShiurLabel,
  formatNachShiurLabel,
  getAdditionalNotice,
} = require('../shiurLabelService');

// Shared by the email and WhatsApp renderers.

const PROGRAM_TITLES = {
  time4mishna: 'Time4Mishna',
  time4nach: 'Time4Nach',
  combined: 'Time4Mishna & Time4Nach',
};

const NO_SHIUR_TEXT = 'No shiur today.';

const LINK_PATTERN = /\b(?:https?:\/\/|www\.)\S+/gi;

/**
 * Removes URLs from free text (daily messages contain no external links, see
 * backlog R1). Returns `null` if nothing is left.
 *
 * @param {string|null|undefined} value
 * @returns {string|null}
 */
const stripLinks = (value) => {
  if (!value) {
    return null;
  }
  const stripped = String(value).replace(LINK_PATTERN, '').replace(/[ \t]{2,}/g, ' ').trim();
  return stripped || null;
};

/**
 * `2026-09-28` → `Monday 28 September 2026`; returns the input unchanged if
 * it isn't a YYYY-MM-DD string.
 */
const formatGregorianDate = (gregorianDate) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(gregorianDate || '');
  if (!match) {
    return gregorianDate || '';
  }
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  const weekday = new Intl.DateTimeFormat('en-GB', { weekday: 'long', timeZone: 'UTC' }).format(date);
  const rest = new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
  return `${weekday} ${rest}`;
};

const toShiurItems = (rows, formatLabel) =>
  (rows || [])
    .map((row) => ({
      label: formatLabel(row),
      notice: stripLinks(getAdditionalNotice(row)),
    }))
    .filter((item) => item.label || item.notice);

/**
 * Per-program sections for a message. Items with neither a label nor a
 * notice are dropped, so an empty `items` means a no-shiur day.
 *
 * @param {{ time4mishna: object[], time4nach: object[] }} content
 * @param {'time4mishna'|'time4nach'|'combined'} program
 * @returns {{ title: string, items: { label: string|null, notice: string|null }[] }[]}
 */
const getSections = (content, program) => {
  const sections = [];
  if (program === 'time4mishna' || program === 'combined') {
    sections.push({
      title: PROGRAM_TITLES.time4mishna,
      items: toShiurItems(content.time4mishna, formatMishnaShiurLabel),
    });
  }
  if (program === 'time4nach' || program === 'combined') {
    sections.push({
      title: PROGRAM_TITLES.time4nach,
      items: toShiurItems(content.time4nach, formatNachShiurLabel),
    });
  }
  return sections;
};

/**
 * Throws unless `program` is known and `content` has a date row.
 */
const assertRenderable = (content, program) => {
  if (!PROGRAM_TITLES[program]) {
    throw new Error(`Unknown program: ${program}`);
  }
  if (!content || !content.date) {
    throw new Error('Rendering requires daily content with a date row');
  }
};

module.exports = {
  PROGRAM_TITLES,
  NO_SHIUR_TEXT,
  stripLinks,
  formatGregorianDate,
  getSections,
  assertRenderable,
};
