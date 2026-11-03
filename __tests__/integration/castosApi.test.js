// Opt-in check of the Castos API behaviour the spec leaves open. It creates
// real episodes, so it only runs with RUN_CASTOS_INTEGRATION=1, and only ever
// on the TEST show (CASTOS_PODCAST_ID), which must have "test" in its title:
//
//   RUN_CASTOS_INTEGRATION=1 npx jest __tests__/integration/castosApi.test.js
//
// It records (as a JSON report printed at the end):
//   a. an episode created with an uploaded mp3 and a post_date a few hours
//      ahead: whether Castos shows it as scheduled or published;
//   b. whether episode_file is accepted as a URL instead of a file;
//   c. that the new episodes appear in the episode list.
// The token is never printed, and URLs are cut down to their file names.

require('dotenv').config();
const { createCastosClient } = require('../../src/services/castos/client');
const { getCastosConfig } = require('../../src/config/castos');
const { fetchAudio, prepareAudio } = require('../../src/services/castos/audio');
const { computePublishPlan } = require('../../src/services/castos/publishPlan');

const ENABLED = process.env.RUN_CASTOS_INTEGRATION === '1';
const AUDIO_PATH = process.env.CASTOS_INTEGRATION_AUDIO_PATH || 'mishna/shiurim/shabbos_19.4-20.1.mp3';
const HOURS_AHEAD = 3;

/** Keeps only a URL's file name, so reports never carry full URLs. */
const shortenUrls = (value) =>
  JSON.parse(
    JSON.stringify(value, (_key, field) =>
      typeof field === 'string' && /^https?:\/\//.test(field) ? `…/${field.split('?')[0].split('/').pop()}` : field
    )
  );

const pick = (episode) =>
  episode && {
    id: episode.id,
    post_title: episode.post_title,
    post_date: episode.post_date,
    episode_status_id: episode.episode_status_id,
    status: episode.status,
    post_status: episode.post_status,
    created_at: episode.created_at,
    file: episode.file && {
      file_name: episode.file.file_name,
      file_duration: episode.file.file_duration,
      file_size: episode.file.file_size,
      import_status: episode.file.import_status,
    },
  };

const describeIf = ENABLED ? describe : describe.skip;

describeIf('Castos API (live calls, test show only)', () => {
  jest.setTimeout(10 * 60 * 1000);

  const report = {};
  let config;
  let client;
  let podcastId;
  const stamp = new Date().toISOString().replace(/\.\d+Z$/, 'Z');

  beforeAll(async () => {
    config = getCastosConfig(process.env);
    podcastId = config.testPodcastId;
    client = createCastosClient({ apiKey: config.apiKey });

    // Guard: refuse anything that isn't clearly the test show.
    if (config.livePodcastId && config.livePodcastId === podcastId) {
      throw new Error('CASTOS_PODCAST_ID is the live show; refusing');
    }
    const podcasts = await client.listPodcasts();
    const title = podcasts[podcastId];
    if (!title || !/test/i.test(title)) {
      throw new Error(`Podcast ${podcastId} is "${title}", not a test show; refusing`);
    }
    report.podcast = { id: podcastId, title };
  });

  afterAll(() => {
    // eslint-disable-next-line no-console
    console.log(`CASTOS INTEGRATION REPORT\n${JSON.stringify(shortenUrls(report), null, 2)}`);
  });

  test('a. upload with a future post_date: scheduled or published?', async () => {
    const bucketUrl = String(process.env.BUCKET_PATH).replace(/\/+$/, '');
    const source = await fetchAudio(`${bucketUrl}/${AUDIO_PATH}`);
    const title = `[integration a] ${stamp}`;
    const audio = prepareAudio(source, {
      baseName: 'integration_a',
      tags: { title, artist: 'Time4Mishna', album: 'Time4Mishna', year: stamp.slice(0, 4) },
    });

    const ahead = new Date(Date.now() + HOURS_AHEAD * 60 * 60 * 1000);
    const londonTime = new Intl.DateTimeFormat('en-GB', {
      timeZone: config.timeZone,
      hourCycle: 'h23',
      hour: '2-digit',
      minute: '2-digit',
    }).format(ahead);
    const plan = computePublishPlan(new Date(), config.timeZone, {
      date: new Intl.DateTimeFormat('en-CA', { timeZone: config.timeZone }).format(ahead),
      publishTime: londonTime,
    });

    const response = await client.createEpisode(
      podcastId,
      { post_title: title, post_content: '<p>Integration test episode (a).</p>', post_date: plan.post_date },
      audio
    );
    const id = response && response.data && (response.data.id || response.data.episode_id);
    report.a = {
      sent_post_date: plan.post_date,
      sent_post_date_zone: config.timeZone,
      create_response: response,
      episode_after_create: id ? pick(await client.getEpisode(podcastId, id)) : null,
    };
    expect(response).toBeTruthy();
  });

  test('b. episode_file as a URL: accepted?', async () => {
    const bucketUrl = String(process.env.BUCKET_PATH).replace(/\/+$/, '');
    const title = `[integration b] ${stamp}`;
    try {
      const response = await client.createEpisode(podcastId, {
        post_title: title,
        post_content: '<p>Integration test episode (b): episode_file sent as a URL.</p>',
        episode_file: `${bucketUrl}/${AUDIO_PATH}`,
      });
      const id = response && response.data && (response.data.id || response.data.episode_id);
      report.b = {
        accepted: true,
        create_response: response,
        episode_after_create: id ? pick(await client.getEpisode(podcastId, id)) : null,
      };
    } catch (error) {
      report.b = { accepted: false, status: error.status, error: error.message };
    }
  });

  test('c. the new episodes appear in the list', async () => {
    const episodes = await client.listEpisodes(podcastId);
    const ours = episodes.filter((episode) => String(episode.post_title).endsWith(stamp));
    report.c = { listed: ours.map((episode) => pick(episode)), total_on_show: episodes.length };
    expect(ours.some((episode) => episode.post_title.startsWith('[integration a]'))).toBe(true);
  });
});

if (!ENABLED) {
  test('Castos integration is opt-in (set RUN_CASTOS_INTEGRATION=1)', () => {});
}
