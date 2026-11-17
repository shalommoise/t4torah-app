const { getDailyContent } = require('./dailyContentService');
const { fileExists } = require('./emailExtrasService');
const { addDays } = require('../utils/londonDate');
const { isChazaraFriday, getChazaraParts, getChazaraLinks } = require('./render/chazaraEmail');

/**
 * @typedef {object} Chazara
 * @property {string} range The week's range, e.g. `Shabbos 18.3-22.5`.
 * @property {string|null} perakim The Shabbos perakim, e.g. `Shabbos 5-6`.
 * @property {{ text: string, perakim: string|null }} links
 *   `perakim` is `null` when the perakim summary isn't in the bucket.
 */

/**
 * The chazara for a Friday: the week's range, the Shabbos perakim and their
 * PDF links, keeping only the PDFs that are in the bucket. `null` on any other
 * day. The week's PDF is required; the perakim summary is optional (many
 * aren't written yet), so a missing one is left out of the email. Throws when the
 * notices are malformed, BUCKET_PATH is unset or the TEXT PDF is missing, so
 * the email is never sent with a broken link.
 *
 * @param {{ date: object, time4mishna: object[] }} content getDailyContent output for the Friday.
 * @param {{ bucketUrl: string|null }} emailConfig
 * @param {object} [deps] For tests.
 * @param {typeof getDailyContent} [deps.getContent]
 * @param {(url: string) => Promise<boolean>} [deps.exists]
 * @returns {Promise<Chazara|null>}
 */
const getChazara = async (content, { bucketUrl }, { getContent = getDailyContent, exists = fileExists } = {}) => {
  if (!isChazaraFriday(content)) {
    return null;
  }
  const shabbosContent = await getContent(addDays(content.date.gregorian_date, 1));
  const parts = getChazaraParts(content, shabbosContent);
  const links = getChazaraLinks(parts, bucketUrl);

  const [hasText, hasPerakim] = await Promise.all(
    [links.text, links.perakim].map((url) => (url ? exists(url) : false))
  );
  if (!hasText) {
    throw new Error(`Chazara TEXT PDF not found in the bucket: ${links.text}`);
  }
  return {
    ...parts,
    links: {
      text: links.text,
      perakim: hasPerakim ? links.perakim : null,
    },
  };
};

module.exports = { getChazara };
