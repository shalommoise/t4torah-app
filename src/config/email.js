// Email rendering settings. Like ./send.js, this doesn't load dotenv or
// ./env.js; callers pass the environment in.

const isBlank = (value) => value === undefined || value === null || String(value).trim() === '';

const withoutTrailingSlash = (value) => String(value).trim().replace(/\/+$/, '');

/**
 * Reads the email settings:
 * - `bucketUrl` (BUCKET_PATH): public base URL of the shiurim bucket, the
 *   same value `utils/findFile.js` uses. `null` when unset; the email then
 *   has no SHIUR/TEXT links, and a live send refuses to run.
 * - `assetsUrl` (EMAIL_ASSETS_URL): where the email images live. Defaults to
 *   `<bucketUrl>/email`.
 * - `unsubscribeUrl` (EMAIL_UNSUBSCRIBE_URL): the provider's unsubscribe
 *   link or merge tag. `null` until a provider is chosen; the footer link is
 *   left out while it's unset.
 *
 * @param {Record<string, string|undefined>} [env]
 * @returns {{ bucketUrl: string|null, assetsUrl: string|null, unsubscribeUrl: string|null }}
 */
const getEmailConfig = (env = process.env) => {
  const bucketUrl = isBlank(env.BUCKET_PATH) ? null : withoutTrailingSlash(env.BUCKET_PATH);
  let assetsUrl = null;
  if (!isBlank(env.EMAIL_ASSETS_URL)) {
    assetsUrl = withoutTrailingSlash(env.EMAIL_ASSETS_URL);
  } else if (bucketUrl) {
    assetsUrl = `${bucketUrl}/email`;
  }
  return {
    bucketUrl,
    assetsUrl,
    unsubscribeUrl: isBlank(env.EMAIL_UNSUBSCRIBE_URL) ? null : String(env.EMAIL_UNSUBSCRIBE_URL).trim(),
  };
};

module.exports = { getEmailConfig };
