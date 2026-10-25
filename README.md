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

Schedule it with cron at 04:30 Europe/London every day (see [docs/SENDING.md](docs/SENDING.md#cron-0430-london-for-the-0515-send)). Each date is sent at most once (`send_log`). Failures show in the job output and exit code; there is no separate alert yet.

### Tests

```sh
npm run test:ci   # offline; Mailchimp is always mocked
```


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


