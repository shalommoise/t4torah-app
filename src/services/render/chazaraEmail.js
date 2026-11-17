const { renderEmailLayout, link } = require('./emailRenderer');

// The Friday chazara email: the week's range (one PDF) and the
// Shabbos perakim summary, all in <bucket>/mishna/chazara/. The range and
// perakim are the `additional_notice` of the Friday and Shabbos chazara rows,
// written by db/createSchedule/chazaraSchedule.js.

const PROGRAM = 'time4mishna';

const NAME = '[A-Z][A-Za-z]*(?: [A-Z][A-Za-z]*)*';
// `Shabbos 18.3-22.5` or `Shabbos 22.6 - Eiruvin 1.9`
const RANGE_PATTERN = new RegExp(`^(${NAME}) (\\d+\\.\\d+)(?:-(\\d+\\.\\d+)| - (${NAME}) (\\d+\\.\\d+))$`);
// `Shabbos 5-6`, `Bikkurim 4` or `Orlah 3 - Bikkurim 1`
const PERAKIM_PATTERN = new RegExp(`^(${NAME}) (\\d+)(?:-(\\d+)| - (${NAME}) (\\d+))?$`);

const tidy = (value) => (value == null ? '' : String(value).replace(/\s+/g, ' ').trim());

/**
 * `true` on a Friday whose Time4Mishna row is a chazara.
 *
 * @param {{ date: object, time4mishna: object[] }|null} content getDailyContent output.
 * @returns {boolean}
 */
const isChazaraFriday = (content) =>
  Boolean(content && content.date && content.date.day_of_week === 'Friday') &&
  (content.time4mishna || []).some((row) => row && row.shiur_type === 'chazara');

const chazaraNotice = (content) => {
  const row = ((content && content.time4mishna) || []).find((r) => r && r.shiur_type === 'chazara');
  return row ? tidy(row.additional_notice) : '';
};

/**
 * The week's range from the Friday row and the perakim from the Shabbos row.
 * `perakim` is `null` when the Shabbos row has none. Throws when the range is
 * missing or either value isn't in the expected form, so a bad row never
 * produces a broken email.
 *
 * @param {{ time4mishna: object[] }} fridayContent
 * @param {{ time4mishna: object[] }|null} shabbosContent
 * @returns {{ range: string, perakim: string|null }}
 */
const getChazaraParts = (fridayContent, shabbosContent) => {
  const range = chazaraNotice(fridayContent);
  if (!RANGE_PATTERN.test(range)) {
    throw new Error(`Friday chazara notice is not a range like "Shabbos 18.3-22.5" (got ${JSON.stringify(range)})`);
  }
  const perakim = chazaraNotice(shabbosContent);
  if (perakim && !PERAKIM_PATTERN.test(perakim)) {
    throw new Error(`Shabbos chazara notice is not perakim like "Shabbos 5-6" (got ${JSON.stringify(perakim)})`);
  }
  return { range, perakim: perakim || null };
};

/**
 * The bucket file name for a range or perakim:
 * `Shabbos 22.6 - Eiruvin 1.9` → `shabbos_22.6-eiruvin_1.9`,
 * `Maaser Sheni 1-2` → `maaser_sheni_1-2`.
 *
 * @param {string} label
 * @returns {string}
 */
const chazaraFileName = (label) => tidy(label).replace(/ - /g, '-').replace(/ /g, '_').toLowerCase();

/**
 * The week's PDF is a single file named after the range, with no suffix:
 * `<bucket>/mishna/chazara/shabbos_18.3-22.5.pdf`.
 *
 * @param {{ range: string, perakim: string|null }} parts
 * @param {string} bucketUrl
 * @returns {{ text: string, perakim: string|null }}
 */
const getChazaraLinks = ({ range, perakim }, bucketUrl) => {
  if (!bucketUrl) {
    throw new Error('BUCKET_PATH must be set for the chazara email (it links to the chazara PDFs)');
  }
  const base = `${bucketUrl}/mishna/chazara`;
  const rangeName = encodeURI(chazaraFileName(range));
  return {
    text: `${base}/${rangeName}.pdf`,
    perakim: perakim ? `${base}/${encodeURI(chazaraFileName(perakim))}.pdf` : null,
  };
};

/**
 * `Shabbos 5-6` → `Shabbos Perakim 5-6`, `Bikkurim 4` → `Bikkurim Perek 4`,
 * `Orlah 3 - Bikkurim 1` → `Orlah Perek 3 - Bikkurim Perek 1`.
 *
 * @param {string} perakim
 * @returns {string}
 */
const perakimLabel = (perakim) => {
  const [, name, first, last, otherName, otherPerek] = PERAKIM_PATTERN.exec(perakim);
  if (otherName) {
    return `${name} Perek ${first} - ${otherName} Perek ${otherPerek}`;
  }
  return last ? `${name} Perakim ${first}-${last}` : `${name} Perek ${first}`;
};

/**
 * `Chazara: Shabbos 18.3-22.5 | Shabbos 5-6`, without the `| …` part when
 * there are no perakim.
 *
 * @param {{ range: string, perakim: string|null }} parts
 * @returns {string}
 */
const buildChazaraSubject = ({ range, perakim }) => `Chazara: ${range}${perakim ? ` | ${perakim}` : ''}`;

const PARAGRAPH = '<p style="margin:24px 0 0 0;">';

/**
 * The chazara email (subject, preview text, HTML and plain text), with the
 * same layout and footer as the daily email and the wording of the manual
 * send. A `null` perakim link is left out: without the perakim summary the
 * Shabbos section and the `| <perakim>` part of the subject are dropped.
 *
 * @param {{ date: object }} fridayContent
 * @param {{ range: string, perakim: string|null, links: { text: string, perakim: string|null } }} chazara
 * @param {{ assetsUrl?: string|null, unsubscribeUrl?: string|null }} [emailConfig]
 * @returns {{ subject: string, previewText: string, html: string, text: string }}
 */
const renderChazaraEmail = (fridayContent, { range, perakim, links }, { assetsUrl = null, unsubscribeUrl = null } = {}) => {
  const rangeLines = [{ label: `${range} TEXT`, url: links.text }];
  const perakimLine = perakim && links.perakim ? { label: perakimLabel(perakim), url: links.perakim } : null;
  const weekIntro = "Please find attached the Text for this week's mishnayos:";

  const htmlParts = [
    `${PARAGRAPH}${weekIntro}</p>`,
    `<p style="margin:16px 0 0 0;">${rangeLines.map(({ url, label }) => link(url, label)).join('<br>')}</p>`,
  ];
  const textParts = [
    [
      weekIntro,
      ...rangeLines.map(({ label, url }) => `${label} (${url})`),
    ].join('\n'),
  ];
  if (perakimLine) {
    htmlParts.push(
      `${PARAGRAPH}Please find attached the Chazara Summaries for this Shabbos's mishnayos:</p>`,
      `<p style="margin:16px 0 0 0;">${link(perakimLine.url, perakimLine.label)}</p>`
    );
    textParts.push(
      [
        "Please find attached the Chazara Summaries for this Shabbos's mishnayos:",
        `${perakimLine.label} (${perakimLine.url})`,
      ].join('\n')
    );
  }

  const { html, text } = renderEmailLayout({
    program: PROGRAM,
    dateRow: fridayContent.date,
    assetsUrl,
    unsubscribeUrl,
    bodyHtml: htmlParts.join('\n'),
    bodyText: textParts,
  });
  const shownPerakim = perakimLine ? perakim : null;
  return {
    subject: buildChazaraSubject({ range, perakim: shownPerakim }),
    previewText: shownPerakim || range,
    html,
    text,
  };
};

module.exports = {
  isChazaraFriday,
  getChazaraParts,
  chazaraFileName,
  getChazaraLinks,
  perakimLabel,
  buildChazaraSubject,
  renderChazaraEmail,
};
