const {
  PROGRAM_TITLES,
  NO_SHIUR_TEXT,
  stripLinks,
  formatGregorianDate,
  getSections,
  assertRenderable,
} = require('./dailySections');

const WHATSAPP_MAX_LENGTH = 1000;
const ELLIPSIS = '…';

// WhatsApp formatting markers: *bold*, _italic_, ~strike~, `mono` / ```block```.
// WhatsApp has no escape syntax, so these are removed from DB text.
const WHATSAPP_FORMATTING_PATTERN = /[*_~`]/g;

/**
 * Removes WhatsApp formatting characters from DB-sourced text so it can't
 * break the message's own formatting. Collapses the spaces left behind and
 * returns `null` when nothing is left.
 *
 * @param {string|null|undefined} value
 * @returns {string|null}
 */
const stripWhatsappFormatting = (value) => {
  if (!value) {
    return null;
  }
  const stripped = String(value)
    .replace(WHATSAPP_FORMATTING_PATTERN, '')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
  return stripped || null;
};

/**
 * Cuts `text` to at most `maxLength` characters (Unicode code points, so
 * Hebrew and emoji aren't split), ending with an ellipsis when cut.
 *
 * @param {string} text
 * @param {number} maxLength
 * @returns {string}
 */
const truncate = (text, maxLength) => {
  const chars = Array.from(text);
  if (chars.length <= maxLength) {
    return text;
  }
  return chars.slice(0, maxLength - 1).join('').trimEnd() + ELLIPSIS;
};

const renderSection = ({ title, items }, showTitle) => {
  const lines = showTitle ? [`*${title}*`] : [];
  if (!items.length) {
    lines.push(NO_SHIUR_TEXT);
  }
  items.forEach((item) => {
    const label = stripWhatsappFormatting(item.label);
    const notice = stripWhatsappFormatting(item.notice);
    if (label) {
      lines.push(`*${label}*`);
    }
    if (notice) {
      lines.push(`_${notice}_`);
    }
  });
  return lines.join('\n');
};

/**
 * Renders the daily WhatsApp message from `getDailyContent` output: `*bold*`
 * title and shiurim, `_italic_` special date and notices, blank lines between
 * sections, no links. Formatting characters (`*_~` and backticks) are
 * stripped from DB text first, since WhatsApp can't escape them. Always under
 * WHATSAPP_MAX_LENGTH characters; longer output is truncated with an ellipsis.
 *
 * @param {{ date: object, time4mishna: object[], time4nach: object[] }} content
 * @param {{ program: 'time4mishna'|'time4nach'|'combined' }} options
 * @returns {{ text: string }}
 */
const renderWhatsapp = (content, { program }) => {
  assertRenderable(content, program);

  const dateRow = content.date;
  const specialDate = stripWhatsappFormatting(stripLinks(dateRow.special_date));
  const header = [
    `*${PROGRAM_TITLES[program]}*`,
    formatGregorianDate(dateRow.gregorian_date),
    stripWhatsappFormatting(dateRow.hebrew_date),
    stripWhatsappFormatting(dateRow.hebrew_date_he),
    specialDate && `_${specialDate}_`,
  ].filter(Boolean);

  // A single-program message already names the program in its header.
  const showSectionTitles = program === 'combined';
  const sections = getSections(content, program).map((section) =>
    renderSection(section, showSectionTitles)
  );

  const text = [header.join('\n'), ...sections].join('\n\n');
  return { text: truncate(text, WHATSAPP_MAX_LENGTH - 1) };
};

module.exports = { renderWhatsapp, truncate, stripWhatsappFormatting, WHATSAPP_MAX_LENGTH };
