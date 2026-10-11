const fs = require('fs');
const path = require('path');
const {
  PROGRAM_TITLES,
  NO_SHIUR_TEXT,
  stripLinks,
  formatGregorianDate,
  getSections,
  assertRenderable,
} = require('./dailySections');

const TEMPLATE = fs.readFileSync(
  path.join(__dirname, '..', '..', 'templates', 'dailyEmail.html'),
  'utf8'
);

const escapeHtml = (value) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

/**
 * Replaces each `{{token}}` in a template with `values[token]`. Values are
 * inserted as-is, so callers must escape them. Throws on a token with no value.
 *
 * @param {string} template
 * @param {Record<string, string>} values
 * @returns {string}
 */
const renderTemplate = (template, values) =>
  template.replace(/\{\{(\w+)\}\}/g, (_match, token) => {
    if (!Object.prototype.hasOwnProperty.call(values, token)) {
      throw new Error(`Missing template value: ${token}`);
    }
    return values[token];
  });

const renderSectionHtml = ({ title, items }) => {
  const body = items.length
    ? items
        .map((item) => {
          const parts = [];
          if (item.label) {
            parts.push(
              `<p style="margin:0 0 4px 0;font-size:18px;line-height:1.4;font-weight:bold;">${escapeHtml(item.label)}</p>`
            );
          }
          if (item.notice) {
            parts.push(
              `<p style="margin:4px 0 0 0;font-size:14px;line-height:1.4;color:#8a4b00;">${escapeHtml(item.notice)}</p>`
            );
          }
          return parts.join('\n');
        })
        .join('\n')
    : `<p style="margin:0;font-size:15px;line-height:1.4;">${NO_SHIUR_TEXT}</p>`;

  return [
    '<tr>',
    '<td style="padding:16px 24px;border-top:1px solid #e5e5e5;">',
    `<h2 style="margin:0 0 8px 0;font-size:17px;line-height:1.3;color:#1a3d6d;">${escapeHtml(title)}</h2>`,
    body,
    '</td>',
    '</tr>',
  ].join('\n');
};

const renderSectionText = ({ title, items }) => {
  const lines = [title.toUpperCase()];
  if (!items.length) {
    lines.push(NO_SHIUR_TEXT);
  }
  items.forEach((item) => {
    if (item.label) {
      lines.push(item.label);
    }
    if (item.notice) {
      lines.push(item.notice);
    }
  });
  return lines.join('\n');
};

/**
 * Renders the daily email body (HTML and plain text) from `getDailyContent`
 * output. The subject line is built separately (see subjectLine.js).
 *
 * @param {{ date: object, time4mishna: object[], time4nach: object[] }} content
 * @param {{ program: 'time4mishna'|'time4nach'|'combined' }} options
 * @returns {{ html: string, text: string }}
 */
const renderEmail = (content, { program }) => {
  assertRenderable(content, program);

  const dateRow = content.date;
  const title = PROGRAM_TITLES[program];
  const gregorianDate = formatGregorianDate(dateRow.gregorian_date);
  const specialDate = stripLinks(dateRow.special_date);
  const sections = getSections(content, program);

  const html = renderTemplate(TEMPLATE, {
    title: escapeHtml(title),
    gregorianDate: escapeHtml(gregorianDate),
    hebrewDate: escapeHtml(dateRow.hebrew_date || ''),
    hebrewDateHe: escapeHtml(dateRow.hebrew_date_he || ''),
    specialDate: specialDate
      ? `<p style="margin:8px 0 0 0;font-size:15px;line-height:1.5;font-weight:bold;color:#8a4b00;">${escapeHtml(specialDate)}</p>`
      : '',
    sections: sections.map(renderSectionHtml).join('\n'),
  });

  const headerLines = [title, gregorianDate, dateRow.hebrew_date, dateRow.hebrew_date_he, specialDate]
    .filter(Boolean);
  const text = [headerLines.join('\n'), ...sections.map(renderSectionText)].join('\n\n') + '\n';

  return { html, text };
};

module.exports = { renderEmail, renderTemplate, escapeHtml, formatGregorianDate };
