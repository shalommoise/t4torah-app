// Links in the daily email. Only Time4Torah's own links appear: the fixed
// links below, shiur files in the bucket, and the provider's unsubscribe link.
// URLs typed into the database (notices, special dates) are still stripped.
// Sefaria links are not used.

const STATIC_LINKS = {
  appleApp: 'https://itunes.apple.com/us/app/time4mishna-daily-mishnayos/id1439380311',
  googlePlayApp: 'https://play.google.com/store/apps/details?id=com.maatayim.time4mishna',
  whatsappGroup: 'https://chat.whatsapp.com/BD7TyvGejybEeDFhmZDIn3',
  website: 'https://www.time4torah.org',
  // Mailchimp fills in the recipient's details (URL-encoded) so the donation
  // form is pre-filled, as in the manual send.
  donate:
    'https://donate.jfutures.org/?message=I%20am%20supporting%20Time4Mishnah-Time4Nach' +
    '&email=*|URL:EMAIL|*&firstname=*|URL:FNAME|*&surname=*|URL:LNAME|*',
  paypal: 'https://www.paypal.com/paypalme/JewishFuturesTrust',
  facebook: 'https://www.facebook.com/time4torah/',
  youtube: 'https://www.youtube.com/channel/UCnscQTyMAx4ELU73T8_93Bw',
  spotify: 'https://open.spotify.com/show/4MkWuh0AW64I7OdXeSNFWN',
  email: 'mailto:time4mishna@gmail.com',
};

// Images expected in the assets folder (EMAIL_ASSETS_URL, default <bucket>/email),
// uploaded from the repo's imgs/ folder.
const LOGO_FILES = {
  time4mishna: 'time4mishna-header_logo.png',
  time4nach: 'Time-4-Torah-logo_NEW.png',
  combined: 'Time-4-Torah-logo_NEW.png',
};

/**
 * The file name used for a shiur in the bucket: same rule as the
 * time4mishna controller (`Bava Kama 1:1-1:4` → `bava_kama_1:1-1:4`).
 *
 * @param {string} shiurTitle
 * @returns {string}
 */
const shiurFileName = (shiurTitle) => String(shiurTitle).split(' ').join('_').toLowerCase();

/**
 * SHIUR (mp3) and TEXT (pdf) links for a regular Time4Mishna shiur, matching
 * `formFileName('mishna', 'shiurim', name, 'mp3')` and
 * `formFileName('mishna', 'texts', name, 'pdf')`. `null` for chazara rows,
 * rows without a title, or when there's no bucket URL.
 *
 * @param {object|null|undefined} scheduleRow A time4mishna schedule row (needs `shiur_type`, `shiur_title`).
 * @param {string|null} bucketUrl
 * @returns {{ audio: string, text: string } | null}
 */
const buildMishnaShiurLinks = (scheduleRow, bucketUrl) => {
  if (!bucketUrl || !scheduleRow || scheduleRow.shiur_type !== 'regular' || !scheduleRow.shiur_title) {
    return null;
  }
  const name = encodeURI(shiurFileName(scheduleRow.shiur_title));
  return {
    audio: `${bucketUrl}/mishna/shiurim/${name}.mp3`,
    text: `${bucketUrl}/mishna/texts/${name}.pdf`,
  };
};

/**
 * @param {'time4mishna'|'time4nach'|'combined'} program
 * @param {string|null} assetsUrl
 * @returns {string|null}
 */
const getLogoUrl = (program, assetsUrl) =>
  assetsUrl && LOGO_FILES[program] ? `${assetsUrl}/${LOGO_FILES[program]}` : null;

/**
 * The monthly Time4Mishna calendar image for a date, e.g. `2026-10-26` →
 * `<bucket>/mishna/calendars/T4M-10-26.png` (month, then two-digit year).
 * `null` without a bucket URL or a YYYY-MM-DD date.
 *
 * @param {string} gregorianDate
 * @param {string|null} bucketUrl
 * @returns {string|null}
 */
const getCalendarUrl = (gregorianDate, bucketUrl) => {
  const match = /^\d{2}(\d{2})-(\d{2})-\d{2}$/.exec(gregorianDate || '');
  if (!bucketUrl || !match) {
    return null;
  }
  return `${bucketUrl}/mishna/calendars/T4M-${match[2]}-${match[1]}.png`;
};

const SUMMARY_FILES = [
  { suffix: 'Overview', label: 'Overview' },
  { suffix: 'Key-Terms', label: 'Key Terms' },
];

/**
 * The masechtos a regular Time4Mishna shiur covers (one, or two when it
 * crosses into the next masechta). Empty for chazara and incomplete rows.
 *
 * @param {object|null|undefined} scheduleRow
 * @returns {string[]}
 */
const getRowMasechtos = (scheduleRow) => {
  if (!scheduleRow || scheduleRow.shiur_type !== 'regular') {
    return [];
  }
  const names = [scheduleRow.start_masechta_name, scheduleRow.end_masechta_name].filter(Boolean);
  return [...new Set(names)];
};

/**
 * Overview and Key Terms PDF links for a regular Time4Mishna shiur, labelled
 * as in the manual send (`Bava Kama Overview`, `Bava Kama Key Terms`):
 * `<bucket>/mishna/summaries/Bava-Kama-Overview.pdf` and `...-Key-Terms.pdf`
 * (spaces in the masechta name become hyphens). A shiur that crosses two
 * masechtos gets links for both. These are candidates: the caller checks
 * which files exist (see emailExtrasService).
 *
 * @param {object|null|undefined} scheduleRow
 * @param {string|null} bucketUrl
 * @returns {{ label: string, url: string }[]}
 */
const getSummaryLinks = (scheduleRow, bucketUrl) => {
  if (!bucketUrl) {
    return [];
  }
  const masechtos = getRowMasechtos(scheduleRow);
  return masechtos.flatMap((masechta) => {
    const fileBase = encodeURI(String(masechta).trim().split(/\s+/).join('-'));
    return SUMMARY_FILES.map(({ suffix, label }) => ({
      label: `${masechta} ${label}`,
      url: `${bucketUrl}/mishna/summaries/${fileBase}-${suffix}.pdf`,
    }));
  });
};

module.exports = {
  STATIC_LINKS,
  LOGO_FILES,
  shiurFileName,
  buildMishnaShiurLinks,
  getLogoUrl,
  getCalendarUrl,
  getSummaryLinks,
};
