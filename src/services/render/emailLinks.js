// Links in the daily email. Only Time4Torah's own links appear: the fixed
// links below, shiur files in the bucket, and the provider's unsubscribe link.
// URLs typed into the database (notices, special dates) are still stripped.
// Sefaria links are not used.

const STATIC_LINKS = {
  appleApp: 'https://itunes.apple.com/us/app/time4mishna-daily-mishnayos/id1439380311',
  googlePlayApp: 'https://play.google.com/store/apps/details?id=com.maatayim.time4mishna',
  whatsappGroup: 'https://chat.whatsapp.com/BD7TyvGejybEeDFhmZDIn3',
  website: 'https://www.time4torah.org',
  donate: 'https://donate.jfutures.org/?message=I%20am%20supporting%20Time4Mishnah-Time4Nach',
  paypal: 'https://www.paypal.com/paypalme/JewishFuturesTrust',
  facebook: 'https://www.facebook.com/time4torah/',
  youtube: 'https://www.youtube.com/channel/UCnscQTyMAx4ELU73T8_93Bw',
  soundcloud: 'https://soundcloud.com/user-552219537',
  spotify: 'https://spoti.fi/2X1YhNf',
  email: 'mailto:time4mishna@gmail.com',
};

// Images expected in the assets folder (EMAIL_ASSETS_URL, default <bucket>/email),
// uploaded from the repo's imgs/ folder.
const LOGO_FILES = {
  time4mishna: 'Time-4-Mishnah-logo_black_NEW.png',
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

module.exports = { STATIC_LINKS, LOGO_FILES, shiurFileName, buildMishnaShiurLinks, getLogoUrl };
