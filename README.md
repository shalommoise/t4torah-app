# Time4Torah Automate Porject

Task is to automate all Time4 Torah Porgrams

- Time4Mishna
- Time4Nach
- Time4Tefilla

## Features required

- Hebrew date APi to skip Shabbos ad Yom tov
- storage of all shiurim
- mishna texts (Sefaria API)
- Database index of shiurim
- storage of summary sheets and diagrams
- Database indexing of summary sheets diagrams
- upload and convert Time4Tefilla shiurim from WhatsApp
- Regenerate RSS Feed
- track links
- integrate with mailchimp
- Admin Level users (time4torah and jfuture emails only)
- Admin Upload of new summarry sheets
- Daily email + WhatsApp send automation: see [docs/SENDING.md](docs/SENDING.md) (email via Mailchimp; WhatsApp not yet)


## Daily Mailchimp email

The daily Time4Mishna email goes to the existing Mailchimp audience, Sunday to Friday, scheduled for 05:15 Europe/London. Shabbos and Yom Tov (`dates_table.is_yom_tov`) are skipped. Full details: [docs/SENDING.md](docs/SENDING.md#mailchimp).

### Setup

1. `npm install`
2. `cp .env.example .env` and fill it in. `.env` is gitignored, so never commit it. Besides the `DATABASE_*` variables and `BUCKET_PATH`, set:

   | Variable | |
   |---|---|
   | `MAILCHIMP_API_KEY` | API key, e.g. `…-us21` |
   | `MAILCHIMP_SERVER_PREFIX` | optional, taken from the key |
   | `MAILCHIMP_AUDIENCE_ID` | the audience (list) ID |
   | `MAILCHIMP_FROM_NAME` | sender name |
   | `MAILCHIMP_REPLY_TO` | reply-to address |
   | `SEND_TIME` / `SEND_TIMEZONE` | default `05:15` / `Europe/London` |
   | `EMAIL_UNSUBSCRIBE_URL` | `*\|UNSUB\|*` |
   | `SEND_CHANNELS` / `SEND_PROGRAMS` | `email` / `time4mishna` |
   | `SEND_MODE` | `live` on the server; leave `dry-run` elsewhere |

### Dry-run (default)

```sh
npm run send:daily -- --date=2026-10-19
```

Builds everything and sends nothing: it writes `outbox/2026-10-19/email-time4mishna.html`, `.txt` and, when the `MAILCHIMP_*` variables are set, `email-time4mishna.mailchimp.json` with the exact requests a live run would make. It makes no Mailchimp calls.

### Live

```sh
npm run send:daily -- --dry-run=false        # needs SEND_MODE=live
```

The app runs it itself once hosted: set `SCHEDULER_ENABLED=true` (and `SEND_MODE=live`) and `npm start` runs the email and Castos jobs every evening and morning (see [docs/SENDING.md](docs/SENDING.md#in-app-scheduler)). A system cron line is still an option. Each date is sent at most once (`send_log`). Failures show in the job output and exit code; there is no separate alert yet.

### Tests

```sh
npm run test:ci   # offline; Mailchimp is always mocked
```


## Time4Tefilla upload

Replaces the manual Time4Tefilla send (download the WhatsApp audio, convert it, upload to Castos, send the Mailchimp campaign). One upload does all of it:

1. Install ffmpeg on the machine running the app (`sudo apt install ffmpeg`). `npm start` logs `[time4tefilla] upload ready (ffmpeg version …)`, or `UPLOADS WILL FAIL` if ffmpeg is missing.
2. Set the `TEFILLA_*`, `CASTOS_TEFILLA_PODCAST_ID` and `MAILCHIMP_TEFILLA_*` / `MAILCHIMP_TEST_AUDIENCE_ID` variables (see `.env.example`), plus `SENDS_ADMIN_TOKEN`. On an existing database, run `db/migrations/003_send_log_time4tefilla.sql` once.
3. Open `http://localhost:3000/admin/time4tefilla`. The browser asks you to sign in: type anything as the user name and `SENDS_ADMIN_TOKEN` as the password.
4. Choose the audio file the rabbi sent (WhatsApp voice note or audio file: OGG/Opus, MP4/M4A or MP3), type the shiur title exactly as he wrote it (e.g. `877. Which ‘Good Years’ Do We Refer To?`) and pick a mode:
   - **Dry run**: converts and renders only. Listen to the MP3 and open the email in `outbox/<date>/time4tefilla-…`. Nothing is created anywhere.
   - **Test**: a real episode on the Castos test show and a real campaign to the test audience.
   - **Live**: the Time4Tefilla show and audience (asks you to confirm).
5. Press **Upload** and wait (up to a couple of minutes). Before 05:15 London time the episode and email are scheduled for 05:15 that morning; from 16:00 (`TEFILLA_NEXT_DAY_AFTER`) until midnight, for 05:15 the next morning; between 05:15 and 16:00 they go out straight away. The page shows the campaign and episode, or what went wrong.

`TEFILLA_SEND_MODE` (default `dry-run`) is the most the server allows, so a local copy can't send by accident. Each shiur goes out once per audience: its number (`877`) is recorded in `send_log`, and uploading it again is refused. If a run fails after Castos (say the audio check), upload again: the episode with the same title is reused rather than duplicated. API details: [API_ROUTES.md](API_ROUTES.md#time4tefilla-upload-admin-only).

# bonus

- users to create own schedules
- Users can save where they are up to 
- Swap in API into App
- enhaced tracking of links
- Custom emails  not using mailchimp
- Google form quizes and results (AI generated)


## Tools

- Hebrew Date API
- Sefaria API
- Firebase user login
- API Client (Express for node?)
- MYSQL DB
- (Google) Cloud storage
- 


## API split

1. Internal 
   - Creating DB
   - Pulling from Sefaria
    - creating dates

2. Admin
  - uploading new shiurim
  - Editing different shiurim
  - uploading new summary sheets

3. Standard
  - Fetching shiurim
  - Downloading Bulk shiurim
  - Fetching Schedule


## Projects
 1. date  -store all dates or function to calculate from start date? 


