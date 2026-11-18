const fs = require('fs/promises');
const path = require('path');
const { convertToMp3 } = require('./ffmpeg');
const { planTefillaSend, describePlan } = require('./plan');
const { tidyTitle, shiurKeyFor, slugFor, buildEpisodeDescription, buildId3Tags } = require('./shiur');
const { renderTefillaEmail } = require('../render/tefillaEmail');
const { prepareAudio } = require('../castos/audio');
const { createCastosClient } = require('../castos/client');
const { findExistingEpisode } = require('../castos/episode');
const { getCreatedEpisodeId } = require('../castos/publishEpisodeService');
const { findEpisodeAudioUrl, waitForEpisodeAudioUrl, verifyAudioUrl } = require('../castos/episodeFile');
const { createMailchimpClient } = require('../mailchimp/client');
const { UNSUBSCRIBE_TAG, getCampaignProblem, buildCampaignRequests, planDelivery } = require('../mailchimp/campaign');
const { deliverCampaign } = require('../mailchimp/deliverCampaign');

// The Time4Tefilla send: audio + title in, Castos episode and Mailchimp
// campaign out. Called by the admin upload route now, and meant for a future
// WhatsApp webhook too, so it knows nothing about HTTP.
//
// convert to MP3 (ffmpeg) → plan the times → claim send_log for the shiur →
// create (or reuse) the Castos episode → find its hosted MP3 URL → check it
// returns 200 → render the email → create and schedule/send the campaign →
// record the outcome in send_log.

const PROGRAM = 'time4tefilla';
const UPDATE_PROFILE_TAG = '*|UPDATE_PROFILE|*';
const DRY_RUN_AUDIO_BASE = 'https://episodes.castos.com/dry-run';
const PROVIDER_ID_MAX_LENGTH = 255;

const errorMessage = (error) => (error && error.message) || String(error);

/** An Error carrying an HTTP-ish status and the stage it failed at. */
const fail = (message, status, stage, extra = {}) => Object.assign(new Error(message), { status, stage, ...extra });

const loadSendLogModel = () => {
  const model = require('../../models/sendLogModel');
  return {
    claim: model.claimShiurSendLog,
    reclaimFailed: model.reclaimFailedShiurSendLog,
    finish: model.finishShiurSendLog,
    select: model.selectShiurSendLog,
  };
};

/**
 * Claims the shiur's send_log row, or throws 409 saying why not.
 *
 * @returns {Promise<void>}
 */
const claimShiur = async (sendLog, key, title) => {
  if (await sendLog.claim(key)) {
    return;
  }
  if (await sendLog.reclaimFailed(key)) {
    return;
  }
  const [row] = await sendLog.select(key);
  const status = row ? row.status : null;
  if (status === 'sent') {
    const campaign = row.provider_message_id ? ` (${row.provider_message_id})` : '';
    throw fail(`"${title}" (shiur ${key.shiurKey}) already went out on ${row.send_date}${campaign}; not sending it again`, 409, 'send_log');
  }
  if (status === 'claimed') {
    throw fail(
      `"${title}" (shiur ${key.shiurKey}) is being sent, or an earlier attempt stopped part-way; ` +
        'check Castos and Mailchimp before resetting its send_log row',
      409,
      'send_log'
    );
  }
  throw fail(`send_log claim for shiur ${key.shiurKey} failed (row status ${JSON.stringify(status)})`, 500, 'send_log');
};

/**
 * Renders the email, refusing (before anything reaches Mailchimp) without a
 * title or a verified audio URL.
 */
const renderEmail = ({ title, audioUrl, verified }) => {
  if (!tidyTitle(title)) {
    throw fail('Refusing to send: no shiur title', 400, 'render');
  }
  if (!verified) {
    throw fail('Refusing to send: the episode audio URL has not been verified', 500, 'render');
  }
  return renderTefillaEmail({ title, audioUrl }, { unsubscribeUrl: UNSUBSCRIBE_TAG, updateProfileUrl: UPDATE_PROFILE_TAG });
};

const campaignRequests = ({ email, date, shiurKey, mode, mailchimp }) => {
  const message = { program: PROGRAM, date, email };
  const problem = getCampaignProblem(message);
  if (problem) {
    throw fail(problem, 500, 'render');
  }
  const requests = buildCampaignRequests(message, mailchimp);
  const title = `${mode === 'test' ? 'TEST ' : ''}${PROGRAM} ${date} #${shiurKey}`;
  return { ...requests, campaign: { ...requests.campaign, settings: { ...requests.campaign.settings, title } } };
};

/**
 * Runs the Time4Tefilla send for one shiur.
 *
 * @param {object} options
 * @param {Buffer} options.audio The uploaded OGG/Opus, MP4/M4A or MP3.
 * @param {string} options.title The shiur title, e.g. `877. Which ‘Good Years’ Do We Refer To?`.
 * @param {ReturnType<import('../../config/tefilla').getTefillaConfig>} options.config For the mode to run.
 * @param {object} [options.deps] Replacements for tests: convertToMp3, castosClient, mailchimpClient,
 *   sendLog ({ claim, reclaimFailed, finish, select }), verifyAudioUrl, waitForEpisodeAudioUrl,
 *   writeFile, mkdir, now, logger, pollOptions.
 * @returns {Promise<object>} What happened (see the `status` field: dry-run, scheduled or sent).
 * @throws Error with `status` (400 bad upload, 409 already sent, 5xx provider/config) and `stage`.
 */
const runTefillaPipeline = async ({ audio, title: rawTitle, config, deps = {} }) => {
  const logger = deps.logger || console;
  const clock = deps.now || (() => new Date());
  const { mode } = config;
  const log = (text) => logger.log(`[time4tefilla] [${mode}] ${text}`);

  const title = tidyTitle(rawTitle);
  if (!title) {
    throw fail('A shiur title is required', 400, 'input');
  }
  if (!Buffer.isBuffer(audio) || audio.length === 0) {
    throw fail('An audio file is required', 400, 'input');
  }
  const shiurKey = shiurKeyFor(title);
  const slug = slugFor(title);

  const plan = planTefillaSend({ now: clock(), timeZone: config.timeZone, publishTime: config.publishTime, sendTime: config.sendTime });
  log(`"${title}" (shiur ${shiurKey}): ${describePlan(plan)}`);

  const converted = await (deps.convertToMp3 || convertToMp3)(audio);
  const mp3 = prepareAudio(converted.buffer, { baseName: slug, tags: buildId3Tags(title, plan.date) });
  const audioSummary = { inputFormat: converted.inputFormat, filename: mp3.filename, bytes: mp3.buffer.length };
  log(`converted ${converted.inputFormat} (${audio.length} bytes) to ${mp3.filename} (${mp3.buffer.length} bytes)`);

  const description = buildEpisodeDescription(title);
  const episodeFields = {
    post_title: title,
    post_content: description,
    ...(plan.castos.mode === 'schedule' && { post_date: plan.castos.post_date }),
  };
  const summary = { mode, title, shiurKey, date: plan.date, plan: { castos: plan.castos, email: plan.email }, audio: audioSummary };

  if (mode === 'dry-run') {
    return dryRun({ summary, mp3, slug, episodeFields, config, deps, log });
  }

  const sendLog = deps.sendLog || loadSendLogModel();
  const key = { date: plan.date, program: PROGRAM, channel: 'email', mode: 'live', audience: config.mailchimp.audienceId, shiurKey };
  await claimShiur(sendLog, key, title);

  let episode;
  let emailPlan;
  let delivery;
  try {
    episode = await publishEpisode({ config, episodeFields, mp3, title, deps, log });
    const verifyUrl = deps.verifyAudioUrl || verifyAudioUrl;
    try {
      await verifyUrl(episode.audioUrl, deps.pollOptions);
    } catch (error) {
      throw fail(
        `${errorMessage(error)}. Castos episode ${episode.episodeId} exists (re-uploading reuses it); no email was sent`,
        502,
        'verify-audio'
      );
    }
    log(`audio verified: ${episode.audioUrl}`);

    const email = renderEmail({ title, audioUrl: episode.audioUrl, verified: true });
    const requests = campaignRequests({ email, date: plan.date, shiurKey, mode, mailchimp: config.mailchimp });
    // Upload, Castos processing and the audio check take minutes: plan the
    // email again now, so a 05:15 slot that has come too close (Mailchimp
    // needs 5 minutes' notice) becomes "send now" instead of a failed schedule.
    emailPlan = planDelivery({ date: plan.date, now: clock(), sendTime: config.sendTime, sendTimeZone: config.timeZone });
    if (emailPlan.action !== plan.email.action) {
      log(`email plan changed while publishing: ${emailPlan.action} now`);
    }
    const client = deps.mailchimpClient || createMailchimpClient(config.mailchimp);
    delivery = await deliverCampaign({ client, requests, delivery: emailPlan, log: (text) => log(`mailchimp: ${text}`) });
  } catch (error) {
    await finishQuietly(sendLog, key, { status: 'failed' }, log);
    // Our own errors carry a stage; anything else came from the Castos client.
    throw error.stage ? error : fail(errorMessage(error), 502, 'castos');
  }

  if (!delivery.ok) {
    if (delivery.uncertain) {
      // Mailchimp may have it: leave the row claimed so nothing resends it.
      throw fail(`${delivery.error}; send_log left claimed: check Mailchimp before retrying`, 502, 'mailchimp', {
        episodeId: episode.episodeId,
      });
    }
    await finishQuietly(sendLog, key, { status: 'failed' }, log);
    throw fail(delivery.error, 502, 'mailchimp', { episodeId: episode.episodeId });
  }

  const providerMessageId = `mailchimp:${delivery.id}; castos:${episode.episodeId}`.slice(0, PROVIDER_ID_MAX_LENGTH);
  const logError = await finishQuietly(sendLog, key, { status: 'sent', providerMessageId }, log);
  return {
    ...summary,
    status: emailPlan.action === 'schedule' ? 'scheduled' : 'sent',
    plan: { castos: plan.castos, email: emailPlan },
    audience: config.mailchimp.audienceId,
    castos: { podcastId: config.castos.podcastId, episodeId: episode.episodeId, reused: episode.reused, audioUrl: episode.audioUrl },
    campaignId: delivery.id,
    ...(logError && { logError }),
  };
};

/** Records an outcome; returns an error message instead of throwing (the send already happened or failed). */
const finishQuietly = async (sendLog, key, outcome, log) => {
  try {
    if (await sendLog.finish(key, outcome)) {
      return null;
    }
    const message = `send_log for shiur ${key.shiurKey} was no longer claimed when recording ${outcome.status}`;
    log(message);
    return message;
  } catch (error) {
    const message = `recording ${outcome.status} in send_log failed: ${errorMessage(error)}`;
    log(message);
    return message;
  }
};

/**
 * Creates the episode, or reuses the show's episode with the same title (an
 * earlier attempt, or a manual upload), and finds its hosted MP3 URL.
 */
const publishEpisode = async ({ config, episodeFields, mp3, title, deps, log }) => {
  const { podcastId, apiKey } = config.castos;
  const client = deps.castosClient || createCastosClient({ apiKey });
  const waitForUrl = deps.waitForEpisodeAudioUrl || waitForEpisodeAudioUrl;

  const existing = findExistingEpisode(await client.listEpisodes(podcastId), title);
  if (existing) {
    log(`castos: show ${podcastId} already has episode ${existing.id} "${existing.post_title}"; reusing it`);
    const audioUrl =
      findEpisodeAudioUrl(existing) ||
      (await waitForUrl({ client, podcastId, episodeId: existing.id, ...deps.pollOptions })).url;
    return { episodeId: existing.id, reused: true, audioUrl };
  }

  const response = await client.createEpisode(podcastId, episodeFields, mp3);
  if (config.mode === 'test') {
    // The spec doesn't document this body; log all of it while testing.
    log(`castos: create response ${JSON.stringify(response)}`);
  } else {
    log(`castos: create response keys ${JSON.stringify(Object.keys(response || {}))}`);
  }
  const episodeId = getCreatedEpisodeId(response);
  let audioUrl = findEpisodeAudioUrl(response);
  if (!audioUrl) {
    if (episodeId === null) {
      throw fail('Castos created the episode but the response has neither its id nor its audio URL', 502, 'castos');
    }
    log(`castos: no audio URL in the create response; reading episode ${episodeId}`);
    audioUrl = (await waitForUrl({ client, podcastId, episodeId, ...deps.pollOptions })).url;
  }
  log(`castos: episode ${episodeId} on show ${podcastId}, audio ${audioUrl}`);
  return { episodeId, reused: false, audioUrl };
};

/**
 * Dry run: writes the MP3, the email and the requests that would be made to
 * `<outboxDir>/<date>/`; calls neither Castos nor Mailchimp, nor send_log.
 */
const dryRun = async ({ summary, mp3, slug, episodeFields, config, deps, log }) => {
  const writeFile = deps.writeFile || fs.writeFile;
  const mkdir = deps.mkdir || fs.mkdir;
  const audioUrl = `${DRY_RUN_AUDIO_BASE}/${mp3.filename}`;
  const email = renderTefillaEmail(
    { title: summary.title, audioUrl },
    { unsubscribeUrl: UNSUBSCRIBE_TAG, updateProfileUrl: UPDATE_PROFILE_TAG }
  );
  const dir = path.resolve(process.cwd(), config.outboxDir, summary.date);
  const base = path.join(dir, `time4tefilla-${slug}`);
  const files = { mp3: `${base}.mp3`, html: `${base}.html`, json: `${base}.json` };
  await mkdir(dir, { recursive: true });
  await writeFile(files.mp3, mp3.buffer);
  await writeFile(files.html, email.html, 'utf8');
  const preview = {
    ...summary,
    castos: { request: { method: 'POST', path: '/podcasts/{id}/episodes', fields: episodeFields, file: mp3.filename } },
    email: { subject: email.subject, previewText: email.previewText, text: email.text, placeholderAudioUrl: audioUrl },
    mailchimp: { campaignTitle: `${PROGRAM} ${summary.date} #${summary.shiurKey}`, subject: email.subject },
  };
  await writeFile(files.json, `${JSON.stringify(preview, null, 2)}\n`, 'utf8');
  log(`nothing created in Castos or Mailchimp; preview written to ${dir}`);
  return { ...summary, status: 'dry-run', subject: email.subject, outbox: files };
};

module.exports = { PROGRAM, runTefillaPipeline };
