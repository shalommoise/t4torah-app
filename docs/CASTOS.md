# Castos episodes

`npm run castos:publish` creates the day's Time4Mishna episode on Castos. Castos's RSS feed is already linked to Spotify, so the episode reaches Spotify from there. Nothing here talks to Spotify.

```sh
npm run castos:publish -- --date=2026-11-03                                 # dry run, test show
npm run castos:publish -- --date=2026-11-03 --dry-run=false                 # create it on the test show
npm run castos:publish -- --date=2026-11-03 --dry-run=false --podcast=live  # the real show
```

The defaults are the safe ones. Without flags it does a dry run against the **test** show (`CASTOS_PODCAST_ID`). A dry run reads the database, lists the show's episodes, downloads and checks the mp3, and builds the description, but creates nothing. The live show needs both `--podcast=live` and `CASTOS_LIVE_PODCAST_ID`.

## What it does

| Step | Rule |
|---|---|
| Day | Same rules as the daily email (`sendRules.shouldSendOn`): no episode on Shabbos or Yom Tov. Chazara days and days without a shiur are skipped, because there's no shiur audio. |
| Title | The dotted shiur label used on the show and in the email, e.g. `Shabbos 20.2-20.5`. |
| Duplicates | Skips the day if the show already has an episode with that title. Case and spacing don't matter. Re-runs never create a second copy. |
| Audio | `<BUCKET_PATH>/mishna/shiurim/<shiur_title, lower case, _ for spaces>.mp3`. The file's first bytes are checked: MP3 gets ID3 tags (title, artist and album `Time4Mishna`, year), M4A is uploaded as is, and anything else is refused (convert it, e.g. with ffmpeg). Uploaded as multipart `episode_file`. |
| Description | HTML links to the shiur text PDF, the masechta Overview/Key Terms PDFs and the month's calendar (each only if the file exists), then Time4Torah, the Jewish Futures line and the donate link. |
| Episode number | Not set. It's empty on the live show too. |
| Publish time | `computePublishPlan` in `src/services/castos/publishPlan.js`. Before `CASTOS_PUBLISH_TIME` (default 05:15, in `SEND_TIMEZONE`) on the date, or on an earlier day, the episode is sent with `post_date` = `<date> 05:15:00`. At or after that time, it's published at once with no `post_date`. A date that has already passed is refused. |

Reads (GET) retry 429 and 5xx responses. A create retries only on 429. After a 5xx the episode may already exist, so the next run's duplicate check takes care of it instead of a retry.

## Config

| Variable | |
|---|---|
| `CASTOS_API_KEY` | API token, sent as `Authorization: Bearer …`. Never logged. |
| `CASTOS_PODCAST_ID` | The **test** show. The default target, and the only show the integration script uses. |
| `CASTOS_LIVE_PODCAST_ID` | The Time4Mishna show, used only with `--podcast=live`. |
| `CASTOS_PUBLISH_TIME` | HH:MM, default `05:15` |
| `SEND_TIMEZONE`, `BUCKET_PATH` | shared with the daily send |

Exit codes: 0 means created, skipped, already there or a dry run. 1 means a failure or a date missing from `dates_table`. 2 means a usage or config error.

## Integration check

The Castos spec doesn't say how a future `post_date` behaves, or whether `episode_file` can be a URL. This opt-in script finds out. It creates real episodes, so it refuses any show whose title doesn't contain "test":

```sh
RUN_CASTOS_INTEGRATION=1 npx jest __tests__/integration/castosApi.test.js
```

It prints a JSON report with full URLs cut down to their file names.
