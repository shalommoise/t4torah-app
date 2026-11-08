const { shouldSendOn } = require('../sendRules');
const { buildMishnaShiurLinks, shiurFileName } = require('../render/emailLinks');
const { getEmailExtras, fileExists } = require('../emailExtrasService');
const { computePublishPlan } = require('./publishPlan');
const { fetchAudio, prepareAudio } = require('./audio');
const {
  getRegularShiur,
  buildEpisodeTitle,
  buildEpisodeDescription,
  findExistingEpisode,
  buildId3Tags,
} = require('./episode');

/**
 * The new episode's id from a create response. Castos returns the episode
 * under `episode` (`{ success, message, episode: { id, … }, file, status,
 * errors }`), which the spec doesn't document; `data` and the top level are
 * kept as fallbacks.
 *
 * @param {any} body
 * @returns {number|string|null}
 */
const getCreatedEpisodeId = (body) => {
  const candidates = [
    body?.episode?.id,
    body?.data?.id,
    body?.data?.episode_id,
    body?.id,
    body?.episode_id,
  ];
  const id = candidates.find((value) => value !== undefined && value !== null && value !== '');
  return id === undefined ? null : id;
};

/**
 * Publishes the day's Time4Mishna shiur as a Castos episode, or says why not.
 *
 * Steps: skip Shabbos/Yom Tov and days without a regular shiur (same rules
 * as the daily email) → plan the publish time (refuses a past date) → skip
 * if the show already has an episode with this title → fetch the mp3 from
 * the bucket, check its format and set ID3 tags → build the description →
 * create the episode (unless `dryRun`).
 *
 * Returns no URLs except the bucket links inside the description.
 *
 * @param {object} options
 * @param {{ date: object, time4mishna: object[] }} options.content getDailyContent output
 * @param {string} options.podcastId
 * @param {ReturnType<import('./client').createCastosClient>} options.client
 * @param {Date} options.now
 * @param {string} options.timeZone
 * @param {string} options.publishTime HH:MM
 * @param {string|null} options.bucketUrl BUCKET_PATH
 * @param {boolean} [options.dryRun=true] everything except the create call
 * @param {object} [options.deps] fetchAudio, fileExists, getEmailExtras (for tests)
 * @returns {Promise<
 *   | { status: 'skipped', reason: string }
 *   | { status: 'exists', title: string, episodeId: number|string }
 *   | { status: 'dry-run'|'created', title: string, plan: object, audio: object, description: string, episodeId?: number|string|null, response?: any }
 * >}
 */
const publishDailyEpisode = async ({
  content,
  podcastId,
  client,
  now,
  timeZone,
  publishTime,
  bucketUrl,
  dryRun = true,
  deps = {},
}) => {
  const { fetchAudio: fetchFile = fetchAudio, fileExists: exists = fileExists, getEmailExtras: getExtras = getEmailExtras } =
    deps;
  const date = content.date.gregorian_date;

  if (!shouldSendOn(content.date)) {
    return { status: 'skipped', reason: `${date} is Shabbos, Yom Tov or not a send day` };
  }
  const shiur = getRegularShiur(content);
  if (!shiur) {
    return { status: 'skipped', reason: `${date} has no regular Time4Mishna shiur (chazara or none)` };
  }
  const title = buildEpisodeTitle(shiur);
  const links = buildMishnaShiurLinks(shiur, bucketUrl);
  if (!title || !links) {
    throw new Error(`${date}: can't build the episode title or audio link (is BUCKET_PATH set?)`);
  }

  const plan = computePublishPlan(now, timeZone, { date, publishTime });

  const existing = findExistingEpisode(await client.listEpisodes(podcastId), title);
  if (existing) {
    return { status: 'exists', title, episodeId: existing.id };
  }

  const baseName = shiurFileName(shiur.shiur_title);
  let source;
  try {
    source = await fetchFile(links.audio);
  } catch (error) {
    const status = error && error.response ? ` (HTTP ${error.response.status})` : '';
    throw new Error(`Fetching ${baseName}.mp3 from the bucket failed${status}`);
  }
  const audio = prepareAudio(source, { baseName, tags: buildId3Tags(title, date) });

  const [extras, textFound] = await Promise.all([
    getExtras(content, { bucketUrl }),
    exists(links.text),
  ]);
  const description = buildEpisodeDescription({
    title,
    date,
    scheduleRow: shiur,
    bucketUrl,
    textUrl: textFound ? links.text : null,
    calendarUrl: extras.calendarUrl,
    summaryUrls: extras.summaryUrls,
  });

  const audioSummary = { filename: audio.filename, format: audio.format, bytes: audio.buffer.length, tagged: audio.tagged };
  if (dryRun) {
    return { status: 'dry-run', title, plan, audio: audioSummary, description };
  }

  const fields = { post_title: title, post_content: description };
  if (plan.mode === 'schedule') {
    fields.post_date = plan.post_date;
  }
  const response = await client.createEpisode(podcastId, fields, audio);
  return {
    status: 'created',
    title,
    plan,
    audio: audioSummary,
    description,
    episodeId: getCreatedEpisodeId(response),
    response,
  };
};

module.exports = { publishDailyEpisode, getCreatedEpisodeId };
