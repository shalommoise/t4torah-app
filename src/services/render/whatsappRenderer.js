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
    if (item.label) {
      lines.push(`*${item.label}*`);
    }
    if (item.notice) {
      lines.push(`_${item.notice}_`);
    }
  });
  return lines.join('\n');
};

/**
 * Renders the daily WhatsApp message from `getDailyContent` output: `*bold*`
 * title and shiurim, `_italic_` special date and notices, blank lines between
 * sections, no links. Always under WHATSAPP_MAX_LENGTH characters; longer
 * output is truncated with an ellipsis.
 *
 * @param {{ date: object, time4mishna: object[], time4nach: object[] }} content
 * @param {{ program: 'time4mishna'|'time4nach'|'combined' }} options
 * @returns {{ text: string }}
 */
const renderWhatsapp = (content, { program }) => {
  assertRenderable(content, program);

  const dateRow = content.date;
  const specialDate = stripLinks(dateRow.special_date);
  const header = [
    `*${PROGRAM_TITLES[program]}*`,
    formatGregorianDate(dateRow.gregorian_date),
    dateRow.hebrew_date,
    dateRow.hebrew_date_he,
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

module.exports = { renderWhatsapp, truncate, WHATSAPP_MAX_LENGTH };
