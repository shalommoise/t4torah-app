#!/usr/bin/env node
// Castos episode job: `npm run castos:publish -- [--date=YYYY-MM-DD] [--dry-run=false] [--podcast=test|live]`
//
// Creates the day's Time4Mishna episode on Castos, which feeds Spotify.
// Before CASTOS_PUBLISH_TIME (default 05:15, SEND_TIMEZONE) on the date it is
// scheduled for that time; at or after it, it is published at once.
// Re-running is safe: an episode with the same title is never created twice.
//
// Defaults are the safe ones: a dry run (fetches and checks everything, creates
// nothing) on the test show (CASTOS_PODCAST_ID). The live show needs
// --podcast=live and CASTOS_LIVE_PODCAST_ID.
//
// Exit codes: 0 created, scheduled, skipped, already there or dry run;
// 1 failure or missing date; 2 usage/config error.

const { londonToday } = require('../src/utils/londonDate');

const USAGE = `Usage: npm run castos:publish -- [options]

  --date=YYYY-MM-DD        Date of the shiur (default: today in Europe/London)
  --dry-run[=true|false]   Default true: check everything, create nothing
  --podcast=test|live      Default test (CASTOS_PODCAST_ID); live needs CASTOS_LIVE_PODCAST_ID
  --help                   Show this help`;

const EXIT_OK = 0;
const EXIT_FAILURE = 1;
const EXIT_USAGE = 2;

class UsageError extends Error {}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const PODCASTS = ['test', 'live'];

/**
 * Parses CLI arguments. Pure: no environment, clock or I/O.
 *
 * @param {string[]} argv Arguments after the script name.
 * @param {{ today: string }} defaults
 * @returns {{ help: boolean, date: string, dryRun: boolean, podcast: 'test'|'live' }}
 * @throws {UsageError}
 */
const parseArgs = (argv, { today }) => {
  const args = { help: false, date: today, dryRun: true, podcast: 'test' };
  for (const arg of argv) {
    const match = /^--([a-z-]+)(?:=(.*))?$/.exec(arg);
    if (!match) {
      throw new UsageError(`Unexpected argument: ${arg}`);
    }
    const [, name, value] = match;
    if (name === 'help') {
      args.help = true;
    } else if (name === 'date') {
      if (!value || !DATE_PATTERN.test(value)) {
        throw new UsageError(`--date must be YYYY-MM-DD (got "${value || ''}")`);
      }
      args.date = value;
    } else if (name === 'dry-run') {
      if (value === undefined || value === 'true') {
        args.dryRun = true;
      } else if (value === 'false') {
        args.dryRun = false;
      } else {
        throw new UsageError(`--dry-run must be true or false (got "${value}")`);
      }
    } else if (name === 'podcast') {
      if (!PODCASTS.includes(value)) {
        throw new UsageError(`--podcast must be test or live (got "${value || ''}")`);
      }
      args.podcast = value;
    } else {
      throw new UsageError(`Unknown option: --${name}`);
    }
  }
  return args;
};

/**
 * The podcast id for `--podcast`. Live needs CASTOS_LIVE_PODCAST_ID.
 *
 * @param {'test'|'live'} podcast
 * @param {{ testPodcastId: string, livePodcastId: string|null }} castos
 * @returns {string}
 */
const resolvePodcastId = (podcast, castos) => {
  if (podcast === 'test') {
    return castos.testPodcastId;
  }
  if (!castos.livePodcastId) {
    throw new UsageError('--podcast=live needs CASTOS_LIVE_PODCAST_ID');
  }
  return castos.livePodcastId;
};

const formatMb = (bytes) => `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

/**
 * One line describing the result. Never includes the token or audio URL.
 *
 * @param {object} result publishDailyEpisode output
 * @param {{ date: string, podcast: string, dryRun: boolean, timeZone: string }} context
 * @returns {string}
 */
const formatResult = (result, { date, podcast, dryRun, timeZone }) => {
  const prefix = `[${dryRun ? 'dry-run' : 'live'}] castos ${podcast} ${date}`;
  if (result.status === 'skipped') {
    return `${prefix}: skipped, ${result.reason}`;
  }
  if (result.status === 'exists') {
    return `${prefix} "${result.title}": already on Castos (episode ${result.episodeId}), not created again`;
  }
  const when =
    result.plan.mode === 'schedule' ? `scheduled for ${result.plan.post_date} (${timeZone})` : 'published now';
  const { filename, format, bytes, tagged } = result.audio;
  const audio = `${filename} (${format}, ${formatMb(bytes)}${tagged ? ', ID3 tagged' : ''})`;
  if (result.status === 'dry-run') {
    return `${prefix} "${result.title}": would be ${when}; audio ${audio}`;
  }
  return `${prefix} "${result.title}": episode ${result.episodeId ?? '(id not in response)'} ${when}; audio ${audio}`;
};

const loadDefaultDeps = () => {
  require('dotenv').config();
  const { getCastosConfig } = require('../src/config/castos');
  const { getEmailConfig } = require('../src/config/email');
  const { getDailyContent } = require('../src/services/dailyContentService');
  const { createCastosClient } = require('../src/services/castos/client');
  const { publishDailyEpisode } = require('../src/services/castos/publishEpisodeService');
  return {
    env: process.env,
    now: new Date(),
    getCastosConfig,
    getEmailConfig,
    getDailyContent,
    createCastosClient,
    publishDailyEpisode,
    // Required lazily so --help and usage errors never create the pool.
    closePool: () => require('../src/config/env').pool.end(),
    log: (line) => console.log(line),
    error: (line) => console.error(line),
  };
};

/**
 * Runs the job and returns its exit code. Dependencies are injectable for tests.
 *
 * @param {string[]} argv
 * @param {object} [deps]
 * @returns {Promise<number>}
 */
const main = async (argv, deps = loadDefaultDeps()) => {
  const { env, now, log, error, closePool } = deps;

  let args;
  let castos;
  let podcastId;
  let bucketUrl;
  try {
    args = parseArgs(argv, { today: londonToday(now) });
    if (args.help) {
      log(USAGE);
      return EXIT_OK;
    }
    castos = deps.getCastosConfig(env);
    podcastId = resolvePodcastId(args.podcast, castos);
    bucketUrl = deps.getEmailConfig(env).bucketUrl;
    if (!bucketUrl) {
      throw new Error('BUCKET_PATH is required');
    }
  } catch (err) {
    error(err.message);
    if (err instanceof UsageError) {
      error(USAGE);
    }
    return EXIT_USAGE;
  }

  let exitCode = EXIT_FAILURE;
  try {
    const content = await deps.getDailyContent(args.date);
    if (!content) {
      error(`${args.date} is not in dates_table`);
      return EXIT_FAILURE;
    }
    const result = await deps.publishDailyEpisode({
      content,
      podcastId,
      client: deps.createCastosClient({ apiKey: castos.apiKey }),
      now,
      timeZone: castos.timeZone,
      publishTime: castos.publishTime,
      bucketUrl,
      dryRun: args.dryRun,
    });
    log(formatResult(result, { ...args, timeZone: castos.timeZone }));
    exitCode = EXIT_OK;
  } catch (err) {
    error(`[${args.dryRun ? 'dry-run' : 'live'}] castos ${args.podcast} ${args.date} FAILED: ${err.message}`);
    // getDailyContent marks an invalid date with status 400; a Castos 400 is a failure.
    exitCode = err.status === 400 && err.name !== 'CastosError' ? EXIT_USAGE : EXIT_FAILURE;
  } finally {
    try {
      await closePool();
    } catch (err) {
      error(`Closing the DB pool failed: ${err.message}`);
    }
  }
  return exitCode;
};

if (require.main === module) {
  main(process.argv.slice(2)).then((code) => {
    process.exitCode = code;
  });
}

module.exports = { parseArgs, resolvePodcastId, formatResult, main, UsageError, USAGE };
