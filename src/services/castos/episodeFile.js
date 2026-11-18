const axios = require('axios');

// Finding the MP3 URL Castos hosts for an episode, and checking it is served.
//
// The Castos spec doesn't document the response bodies. The episode's `file`
// is an object (`file_name`, `file_size`, `import_status`, …, see
// __tests__/integration/castosApi.test.js), so the known URL fields are tried
// first, then any https URL to an .mp3/.m4a anywhere in the body.

const DEFAULT_ATTEMPTS = 12;
const DEFAULT_INTERVAL_MS = 5000;
const CHECK_TIMEOUT_MS = 15000;

const AUDIO_URL_PATTERN = /^https:\/\/[^\s"'<>]+\.(mp3|m4a)(\?[^\s"'<>]*)?$/i;

const sleepMs = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const isAudioUrl = (value) => typeof value === 'string' && AUDIO_URL_PATTERN.test(value.trim());

// Most likely places first; each is a path into the body.
const KNOWN_PATHS = [
  ['file', 'url'],
  ['file', 'file_url'],
  ['file', 'file_path'],
  ['file', 'audio_url'],
  ['file'],
  ['episode', 'file', 'url'],
  ['episode', 'file', 'file_url'],
  ['episode', 'file', 'file_path'],
  ['episode', 'audio_url'],
  ['episode', 'file_url'],
  ['episode', 'episode_file'],
  ['episode', 'enclosure'],
  ['data', 'file', 'url'],
  ['data', 'file', 'file_url'],
  ['data', 'file', 'file_path'],
  ['data', 'audio_url'],
  ['data', 'file_url'],
  ['data', 'episode_file'],
  ['data', 'enclosure'],
  ['audio_url'],
  ['file_url'],
  ['episode_file'],
  ['enclosure'],
];

const atPath = (body, keys) => keys.reduce((value, key) => (value && typeof value === 'object' ? value[key] : undefined), body);

/** Depth-first search for the first audio URL in `value`. */
const searchAudioUrl = (value, depth = 0) => {
  if (isAudioUrl(value)) {
    return value.trim();
  }
  if (!value || typeof value !== 'object' || depth > 6) {
    return null;
  }
  for (const child of Object.values(value)) {
    const found = searchAudioUrl(child, depth + 1);
    if (found) {
      return found;
    }
  }
  return null;
};

/**
 * The episode's hosted MP3 URL from a Castos create or get response, or `null`.
 *
 * @param {any} body
 * @returns {string|null}
 */
const findEpisodeAudioUrl = (body) => {
  for (const keys of KNOWN_PATHS) {
    const value = atPath(body, keys);
    if (isAudioUrl(value)) {
      return value.trim();
    }
  }
  return searchAudioUrl(body);
};

/**
 * Reads the episode (`GET /podcasts/{id}/episodes/{episodeId}`) until it has
 * an audio URL: Castos may still be importing the file just after a create.
 *
 * @param {object} options
 * @param {ReturnType<import('./client').createCastosClient>} options.client
 * @param {string} options.podcastId
 * @param {number|string} options.episodeId
 * @param {number} [options.attempts]
 * @param {number} [options.intervalMs]
 * @param {(ms: number) => Promise<void>} [options.sleep]
 * @returns {Promise<{ url: string, episode: any }>}
 * @throws when no URL appears.
 */
const waitForEpisodeAudioUrl = async ({
  client,
  podcastId,
  episodeId,
  attempts = DEFAULT_ATTEMPTS,
  intervalMs = DEFAULT_INTERVAL_MS,
  sleep = sleepMs,
}) => {
  let episode;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    episode = await client.getEpisode(podcastId, episodeId);
    const url = findEpisodeAudioUrl(episode);
    if (url) {
      return { url, episode };
    }
    if (attempt < attempts) {
      await sleep(intervalMs);
    }
  }
  const status = episode && episode.file && episode.file.import_status;
  throw new Error(
    `Castos episode ${episodeId} has no audio URL after ${attempts} check(s)` +
      `${status !== undefined ? ` (file import_status: ${status})` : ''}`
  );
};

/** HEAD, or a 1 KB ranged GET when the server refuses HEAD. Resolves with the status. */
const probe = async (url, request) => {
  const options = { url, timeout: CHECK_TIMEOUT_MS, maxRedirects: 5, validateStatus: () => true };
  const head = await request({ ...options, method: 'HEAD' });
  if (head.status !== 403 && head.status !== 405) {
    return head.status;
  }
  const get = await request({ ...options, method: 'GET', headers: { Range: 'bytes=0-1023' }, responseType: 'arraybuffer' });
  // 206 is the ranged answer to the same file a plain GET returns with 200.
  return get.status === 206 ? 200 : get.status;
};

/**
 * Checks the audio URL until it returns 200 (following redirects). Network
 * errors count as a failed check.
 *
 * @param {string} url
 * @param {object} [options]
 * @param {(config: object) => Promise<{ status: number }>} [options.request] Defaults to axios.request.
 * @param {number} [options.attempts]
 * @param {number} [options.intervalMs]
 * @param {(ms: number) => Promise<void>} [options.sleep]
 * @returns {Promise<{ url: string, checks: number }>}
 * @throws when the URL never returns 200.
 */
const verifyAudioUrl = async (
  url,
  { request = axios.request, attempts = DEFAULT_ATTEMPTS, intervalMs = DEFAULT_INTERVAL_MS, sleep = sleepMs } = {}
) => {
  if (!isAudioUrl(url)) {
    throw new Error(`Not an https audio URL: ${JSON.stringify(url)}`);
  }
  let last;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const status = await probe(url, request);
      if (status === 200) {
        return { url, checks: attempt };
      }
      last = `HTTP ${status}`;
    } catch (error) {
      last = (error && error.message) || String(error);
    }
    if (attempt < attempts) {
      await sleep(intervalMs);
    }
  }
  throw new Error(`The episode audio ${url} did not return 200 after ${attempts} check(s) (last: ${last})`);
};

module.exports = { findEpisodeAudioUrl, waitForEpisodeAudioUrl, verifyAudioUrl };
