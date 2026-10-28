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
const { STATIC_LINKS, getLogoUrl } = require('./emailLinks');

// Same value as emailExtrasService.NO_EXTRAS; not imported so the renderer
// doesn't load the HTTP client.
const NO_EXTRAS = { calendarUrl: null, summaryUrls: [] };

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

const LINK_STYLE = 'color:#007C89;text-decoration:underline;';

const STUDY_NAMES = {
  time4mishna: 'Mishnayos',
  time4nach: 'Nach',
  combined: 'Mishnayos and Nach',
};

const includesMishna = (program) => program === 'time4mishna' || program === 'combined';

const link = (href, label, style = LINK_STYLE) =>
  `<a href="${escapeHtml(href)}" target="_blank" style="${style}">${escapeHtml(label)}</a>`;

const renderItemHtml = (item) => {
  const parts = [];
  if (item.label) {
    parts.push(`<p style="margin:16px 0 4px 0;font-size:18px;font-weight:bold;">${escapeHtml(item.label)}</p>`);
  }
  if (item.links) {
    parts.push(
      `<p style="margin:0;">${link(item.links.audio, 'SHIUR')}<br>${link(item.links.text, 'TEXT')}</p>`
    );
  }
  if (item.summaries && item.summaries.length) {
    parts.push(`<p style="margin:0;">${item.summaries.map(({ url, label }) => link(url, label)).join('<br>')}</p>`);
  }
  if (item.notice) {
    parts.push(`<p style="margin:4px 0 0 0;font-size:15px;color:#8a4b00;">${escapeHtml(item.notice)}</p>`);
  }
  return parts.join('\n');
};

// A single-program email already names the program in its banner and
// signature, so section headings only appear in the combined email.
const renderSectionHtml = ({ title, items }, showTitle) => {
  const parts = [];
  if (showTitle) {
    parts.push(`<h2 style="margin:24px 0 0 0;font-size:20px;line-height:125%;color:#344d6b;">${escapeHtml(title)}</h2>`);
  }
  parts.push(
    items.length
      ? items.map(renderItemHtml).join('\n')
      : `<p style="margin:16px 0 0 0;">${NO_SHIUR_TEXT}</p>`
  );
  return parts.join('\n');
};

const renderSectionText = ({ title, items }, showTitle) => {
  const lines = showTitle ? [title.toUpperCase()] : [];
  if (!items.length) {
    lines.push(NO_SHIUR_TEXT);
  }
  items.forEach((item) => {
    if (item.label) {
      lines.push(item.label);
    }
    if (item.links) {
      lines.push(`Shiur: ${item.links.audio}`, `Text: ${item.links.text}`);
    }
    (item.summaries || []).forEach(({ label, url }) => lines.push(`${label}: ${url}`));
    if (item.notice) {
      lines.push(item.notice);
    }
  });
  return lines.join('\n');
};

const renderLogoHtml = (program, title, assetsUrl) => {
  const logoUrl = getLogoUrl(program, assetsUrl);
  if (!logoUrl) {
    return `<p style="margin:0;font-family:Georgia,Times,'Times New Roman',serif;font-size:28px;font-weight:bold;color:#FFFFFF;">${escapeHtml(title)}</p>`;
  }
  return `<img src="${escapeHtml(logoUrl)}" width="564" alt="${escapeHtml(title)}" style="display:block;width:100%;max-width:564px;height:auto;border:0;">`;
};

// Footer buttons, in the order of the manual send. Table cells with a
// background colour rather than CSS buttons, so they render in Outlook.
const SOCIAL_BUTTONS = [
  { name: 'facebook', label: 'Facebook', newTab: true },
  { name: 'youtube', label: 'YouTube', newTab: true },
  { name: 'soundcloud', label: 'SoundCloud', newTab: true },
  { name: 'spotify', label: 'Spotify', newTab: true },
  { name: 'website', label: 'Website', newTab: true },
  { name: 'email', label: 'Email us', newTab: false },
];

const BUTTON_COLOR = '#007C89';

const renderButtonHtml = ({ name, label, newTab }) =>
  [
    '<td style="padding:4px;">',
    '<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;">',
    `<tr><td bgcolor="${BUTTON_COLOR}" style="background-color:${BUTTON_COLOR};border-radius:4px;padding:8px 14px;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:100%;">`,
    `<a href="${escapeHtml(STATIC_LINKS[name])}"${newTab ? ' target="_blank"' : ''} style="color:#FFFFFF;text-decoration:none;">${escapeHtml(label)}</a>`,
    '</td></tr>',
    '</table>',
    '</td>',
  ].join('');

// Two rows of three, so the buttons fit a phone screen without wrapping.
const renderSocialButtonsHtml = () => {
  const rows = [SOCIAL_BUTTONS.slice(0, 3), SOCIAL_BUTTONS.slice(3)];
  return [
    '<table role="presentation" align="center" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">',
    ...rows.map((row) => `<tr>${row.map(renderButtonHtml).join('')}</tr>`),
    '</table>',
  ].join('\n');
};

const renderCalendarHtml = (calendarUrl) =>
  `<p style="margin:24px 0 0 0;"><img src="${escapeHtml(calendarUrl)}" width="564" alt="Time4Mishna learning calendar" style="display:block;width:100%;max-width:564px;height:auto;border:0;"></p>`;

const renderAppLinksHtml = () =>
  [
    '<p style="margin:24px 0 0 0;font-style:italic;">Want Time4Mishna straight to your phone?<br>',
    `${link(STATIC_LINKS.appleApp, 'Click here for the Apple app')} or ${link(STATIC_LINKS.googlePlayApp, 'the Android app')},<br>`,
    `or join our ${link(STATIC_LINKS.whatsappGroup, 'WhatsApp Group')}.</p>`,
  ].join('\n');

/**
 * Renders the daily email body (HTML and plain text) from `getDailyContent`
 * output, in the Time4Torah email design. The subject line is built
 * separately (see subjectLine.js).
 *
 * Links: SHIUR/TEXT for regular Time4Mishna shiurim (needs `bucketUrl`), the
 * fixed Time4Torah links in emailLinks.js, and the unsubscribe link when
 * `unsubscribeUrl` is set. URLs in database text are stripped.
 *
 * `extras` (from emailExtrasService.getEmailExtras) adds the files found in
 * the bucket: the Overview/Key Terms links under each Time4Mishna shiur and
 * the calendar image. Both only appear in emails that include Time4Mishna.
 *
 * @param {{ date: object, time4mishna: object[], time4nach: object[] }} content
 * @param {{ program: 'time4mishna'|'time4nach'|'combined', bucketUrl?: string|null,
 *   assetsUrl?: string|null, unsubscribeUrl?: string|null,
 *   extras?: { calendarUrl: string|null, summaryUrls: string[] } }} options
 * @returns {{ html: string, text: string }}
 */
const renderEmail = (
  content,
  { program, bucketUrl = null, assetsUrl = null, unsubscribeUrl = null, extras = NO_EXTRAS }
) => {
  assertRenderable(content, program);

  const dateRow = content.date;
  const title = PROGRAM_TITLES[program];
  const studyName = STUDY_NAMES[program];
  const gregorianDate = formatGregorianDate(dateRow.gregorian_date);
  const specialDate = stripLinks(dateRow.special_date);
  const sections = getSections(content, program, { bucketUrl, summaryUrls: extras.summaryUrls });
  const calendarUrl = includesMishna(program) ? extras.calendarUrl : null;
  const showTitles = program === 'combined';
  const hasFileLinks = sections.some((section) => section.items.some((item) => item.links));
  const isFriday = dateRow.day_of_week === 'Friday';
  const intro = hasFileLinks ? `Please find attached the Shiur and Text for today's ${studyName}:` : null;

  const linkValues = Object.fromEntries(
    Object.entries(STATIC_LINKS).map(([name, href]) => [`link_${name}`, escapeHtml(href)])
  );

  const html = renderTemplate(TEMPLATE, {
    ...linkValues,
    title: escapeHtml(title),
    studyName: escapeHtml(studyName),
    logo: renderLogoHtml(program, title, assetsUrl),
    gregorianDate: escapeHtml(gregorianDate),
    hebrewDate: escapeHtml(dateRow.hebrew_date || ''),
    hebrewDateHe: escapeHtml(dateRow.hebrew_date_he || ''),
    specialDate: specialDate
      ? `<p style="margin:8px 0 0 0;font-weight:bold;color:#8a4b00;">${escapeHtml(specialDate)}</p>`
      : '',
    intro: intro ? `<p style="margin:24px 0 0 0;">${escapeHtml(intro)}</p>` : '',
    sections: sections.map((section) => renderSectionHtml(section, showTitles)).join('\n'),
    calendar: calendarUrl ? renderCalendarHtml(calendarUrl) : '',
    appLinks: includesMishna(program) ? renderAppLinksHtml() : '',
    socialButtons: renderSocialButtonsHtml(),
    shabbosGreeting: isFriday ? '<br>Have a Good Shabbos!' : '',
    unsubscribe: unsubscribeUrl
      ? `Want to change how you receive these emails?<br>You can ${link(unsubscribeUrl, 'unsubscribe from this list', 'color:#656565;text-decoration:underline;')}.`
      : '',
  });

  const signOff = [
    `${title} welcomes all questions on ${studyName} or technical issues, as well as any feedback or comments, so please don't hesitate to email us at any time.`,
    '',
    `Hatzlacha with the ${studyName}!`,
    ...(isFriday ? ['Have a Good Shabbos!'] : []),
    '',
    '---',
    title,
    'Time4Torah',
    STATIC_LINKS.website,
    '',
    'Help us disseminate Torah across the world!',
    `Donate to ${title}: ${STATIC_LINKS.donate}`,
    `Donate with PayPal: ${STATIC_LINKS.paypal}`,
    '(Upon donating, please make sure to write Time4Torah in the message.)',
  ];
  const appLines = includesMishna(program)
    ? [
        'Want Time4Mishna straight to your phone?',
        `Apple app: ${STATIC_LINKS.appleApp}`,
        `Android app: ${STATIC_LINKS.googlePlayApp}`,
        `WhatsApp Group: ${STATIC_LINKS.whatsappGroup}`,
      ].join('\n')
    : null;

  const headerLines = [title, gregorianDate, dateRow.hebrew_date, dateRow.hebrew_date_he, specialDate].filter(Boolean);
  const blocks = [
    headerLines.join('\n'),
    intro,
    ...sections.map((section) => renderSectionText(section, showTitles)),
    calendarUrl ? `Calendar: ${calendarUrl}` : null,
    appLines,
    signOff.join('\n'),
    unsubscribeUrl ? `Unsubscribe: ${unsubscribeUrl}` : null,
  ].filter(Boolean);
  const text = blocks.join('\n\n') + '\n';

  return { html, text };
};

module.exports = { renderEmail, renderTemplate, escapeHtml, formatGregorianDate };
