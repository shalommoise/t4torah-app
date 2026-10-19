# Daily send automation

One daily job reads the day's Time4Mishna and Time4Nach schedule from the database, renders an email and a WhatsApp message, and hands them to pluggable senders.

**Status:** live email goes through **Mailchimp** (Time4Mishna only, to the existing audience). WhatsApp has no BSP yet (Wati / AiSensy), so its live sender is a stub that always fails. See [Mailchimp](#mailchimp) below.

## Architecture

```
jobs/dailySend.js                  CLI: flags, config, exit code, closes DB pool
  └─ src/services/dailySendService.js   runDailySend(): the pipeline below
       1. dailyContentService.getDailyContent(date)   dates_table row + both schedules
       2. sendRules.shouldSendOn(dateRow)             no send on Shabbos / Yom Tov
       3. for each program:
            renderDailyMessage(content, program)      → DailyMessage
              render/subjectLine.js     subject
              render/emailRenderer.js   HTML + text (src/templates/dailyEmail.html)
              render/whatsappRenderer.js
       4. for each channel: check send_log → send via each sender → write send_log
       5. return a report
```

| Piece | File | Notes |
|---|---|---|
| Content | `src/services/dailyContentService.js` | Looks up the date in `dates_table`, then the Time4Mishna/Time4Nach schedule rows. |
| Send-day rules | `src/services/sendRules.js` | Fails closed: sends only when `day_of_week` is Sunday–Friday and `is_yom_tov` is explicitly `0`/`false`. Shabbos/Yom Tov skip; a missing or unrecognised value is an error. Chol HaMoed and Fridays send. |
| Labels | `src/services/shiurLabelService.js` | `Brachos 1:1–1:4`, `Brachos 9:5 – Peah 1:3`, `Tehillim 42`, `Chazara`. |
| Shared sections | `src/services/render/dailySections.js` | Per-program sections, date formatting, `stripLinks`. |
| Message model | `src/services/render/dailyMessage.js` | `DailyMessage = { date, program, email: { subject, html, text }, whatsapp: { text } }`. |
| Subject | `src/services/render/subjectLine.js` | `SUBJECT_FORMAT`, e.g. `Time4Mishna – Monday 28 Sep | 17 Tishrei | Chol HaMoed Sukkos`. Empty parts are dropped. |
| Email | `src/services/render/emailRenderer.js` | `{{token}}` template, inline CSS, 600px max width, Hebrew date in `dir="rtl"`. |
| WhatsApp | `src/services/render/whatsappRenderer.js` | `*bold*` / `_italic_`, under 1,000 characters (truncated with `…`). |
| Senders | `src/services/senders/` | `index.js` (interface, registry, `getSenders`), `consoleSender.js`, `fileSender.js`, `mailchimpSender.js` (live email + dry-run preview), `providerSenders.js` (WhatsApp stub). |
| Mailchimp | `src/services/mailchimp/` | `client.js` (four API calls, retry on 429/5xx), `campaign.js` (request bodies, schedule-or-send decision). |
| Config | `src/config/send.js`, `src/config/mailchimp.js` | `getSendConfig(env)`, `getMailchimpConfig(env)`. |
| Send log | `src/models/sendLogModel.js`, `send_log` table | Stops a program/channel from going out twice on the same date. |
| London dates | `src/utils/londonDate.js` | `londonToday`, `londonTomorrow`, `addDays`; handles BST/GMT. |
| Preview API | `src/routes/sendsRouter.js` (bearer token: `src/middleware/requireSendsAdminToken.js`) → `src/controllers/sendsController.js` → `sendPreviewService.js` / `sendLogService.js` | See [API_ROUTES.md](../API_ROUTES.md#sends). |

### Content rules

- **Only Time4Torah's own links.** The email links to the day's SHIUR (mp3) and TEXT (pdf) in the bucket, plus the fixed links in `src/services/render/emailLinks.js` (apps, WhatsApp group, website, donate, social) and the provider's unsubscribe link. No Sefaria links. URLs typed into `special_date` or `additional_notice` are still removed.
- **WhatsApp sends the files, not links.** The text has no URLs; the day's shiur mp3 (`audio`) and text pdf (`document`) come in `message.whatsapp.attachments` as `{ type, url, filename }`, for the provider to fetch by URL. Dry-run output lists them after the text.
- **Email design** follows the Time4Torah Mailchimp template (`src/templates/dailyEmail.html`): logo banner, shiur with SHIUR/TEXT links, app/WhatsApp links, sign-off, signature, donate links, social links, unsubscribe footer. Fridays add "Have a Good Shabbos!".
- **Shiur file links** use the same naming as the time4mishna API (`utils/findFile.js`): `<BUCKET_PATH>/mishna/shiurim/<title>.mp3` and `<BUCKET_PATH>/mishna/texts/<title>.pdf`, where `<title>` is `shiur_title` lower-cased with spaces as `_` (e.g. `bava_kama_1:1-1:4`). Only regular Time4Mishna shiurim get links; chazara days and Time4Nach have none yet (the weekly text/summaries need their own generation workflow).
- **WhatsApp formatting characters** (`*`, `_`, `~`, `` ` ``) are removed from database text, so a notice can't break the message's formatting. Email is not affected.
- A day with no shiur shows "No shiur today."; a non-regular shiur shows "Chazara".
- `special_date` and `additional_notice` are shown when present.

### Programs and channels

- Programs: `time4mishna`, `time4nach`, `combined` (one message with both).
- Channels: `email`, `whatsapp`.
- Each program is rendered once and sent on every selected channel.

## Configuration

Set these in `.env` (see [`.env.example`](../.env.example)). Unset or blank values use the default. An invalid value makes the job exit with code 2 rather than guessing.

| Variable | Default | Values |
|---|---|---|
| `SEND_MODE` | `dry-run` | `dry-run` or `live` (exact, lower case) |
| `SEND_CHANNELS` | `email,whatsapp` | comma-separated `email`, `whatsapp` |
| `SEND_PROGRAMS` | `time4mishna,time4nach` | comma-separated `time4mishna`, `time4nach`, `combined` |
| `OUTBOX_DIR` | `outbox` | folder for dry-run files (gitignored); relative to the working directory |
| `SENDS_ADMIN_TOKEN` | *(unset → 503)* | bearer token for `/api/v1/sends/*` (API server only, not the job) |
| `BUCKET_PATH` | *(unset → no SHIUR/TEXT links)* | public base URL of the shiurim bucket; **required for a live send** |
| `EMAIL_ASSETS_URL` | `<BUCKET_PATH>/email` | where the logo images are (upload `imgs/Time-4-Mishnah-logo_black_NEW.png` and `imgs/Time-4-Torah-logo_NEW.png`); without it the banner shows the title as text |
| `EMAIL_UNSUBSCRIBE_URL` | *(unset → no footer link)* | the provider's unsubscribe link or merge tag; **`*\|UNSUB\|*` for Mailchimp** (required) |
| `MAILCHIMP_*`, `SEND_TIME`, `SEND_TIMEZONE` | see [Mailchimp](#mailchimp) | |

The job also needs the usual `DATABASE_*` variables.

### Dry-run vs live

- **Dry-run** (default): each channel has a console sender (one summary line) and a file sender, which writes `OUTBOX_DIR/<date>/<channel>-<program>.html|.txt`. Email gets `.html` plus `.txt` with a `Subject:` line; WhatsApp gets `.txt`. Re-runs overwrite. When any `MAILCHIMP_*` variable is set, email also gets `email-<program>.mailchimp.json`: the exact Mailchimp requests a live run would make (no API calls; the key is not written).
- **Live** needs **both** `SEND_MODE=live` **and** `--dry-run=false`.
  - `SEND_MODE=live` on its own still runs a dry-run.
  - `--dry-run=false` without `SEND_MODE=live` is a usage error (exit 2).
  - Live email goes to Mailchimp. Live WhatsApp is still a stub and fails with `Not implemented: provider not chosen`, so use `SEND_CHANNELS=email` (or `--channel=email`).

## Previewing

The preview and log routes need `SENDS_ADMIN_TOKEN` set on the server (see `.env.example`) and the same value sent as a bearer token. Without the variable they return `503`; with a missing or wrong token, `401`.

With the API running (`npm start` or `npm run dev`):

```sh
AUTH="Authorization: Bearer $SENDS_ADMIN_TOKEN"

# Rendered email + WhatsApp as JSON (program defaults to time4mishna)
curl -H "$AUTH" "http://localhost:3000/api/v1/sends/preview?date=2026-09-28&program=time4nach"

# Just one channel
curl -H "$AUTH" "http://localhost:3000/api/v1/sends/preview?date=2026-09-28&channel=whatsapp"

# The email itself: save it, then open the file in a browser
curl -H "$AUTH" "http://localhost:3000/api/v1/sends/preview.html?date=2026-09-28&program=combined" --output preview.html

# What has been sent for a date
curl -H "$AUTH" "http://localhost:3000/api/v1/sends/log?date=2026-09-28"
```

The preview renders exactly what the job would send. `sendDay: false` means the job would skip that date (Shabbos/Yom Tov). Previews never send anything or write to `send_log`.

A dry-run of the job is also a preview: run it and open the files in `outbox/<date>/`.

## Running the job

```sh
npm run send:daily                                  # today (Europe/London), dry-run
npm run send:daily -- --date=2026-09-28             # a specific date
npm run send:daily -- --channel=whatsapp            # one channel (comma-separate for several)
npm run send:daily -- --force                       # send even if send_log says sent/claimed
npm run send:daily -- --help
```

| Flag | Default | Meaning |
|---|---|---|
| `--date=YYYY-MM-DD` | today in Europe/London | Date to send |
| `--dry-run[=true\|false]` | `true` | `false` also needs `SEND_MODE=live` |
| `--channel=email\|whatsapp` | `SEND_CHANNELS` | Overrides the channels |
| `--force` | off | Sends even if `send_log` says `sent` or `claimed` |

The job prints one line per program/channel/sender, e.g.

```
[dry-run] 2026-09-28: sent
  time4mishna email console-email: ok console-email-time4mishna-2026-09-28
  time4mishna email file-email: ok /app/outbox/2026-09-28/email-time4mishna.html
  ...
```

### Exit codes

| Code | Meaning |
|---|---|
| `0` | Everything sent (or already sent), or the date is Shabbos/Yom Tov (skipped) |
| `1` | Any send failed, a `send_log` read/write failed, the date isn't in `dates_table`, or its row has a missing/unrecognised `day_of_week` or `is_yom_tov` (`invalid-calendar-row`) |
| `2` | Bad flags, invalid `SEND_*` config, or an invalid date |

A date missing from `dates_table` is a failure on purpose: it means the calendar hasn't been seeded far enough ahead.

### Idempotency (`send_log`)

`send_log` has one row per date/program/channel/mode (unique key), with `status` `claimed`, `sent` or `failed`, plus `attempts`. A run must **claim** the row before sending:

1. `INSERT` a `claimed` row. A duplicate key means another run already has it.
2. Otherwise, if the row is `failed`, flip it to `claimed` (`UPDATE … WHERE status = 'failed'`; only one run can win, since `affectedRows` must be 1).
3. Send, then set the row to `sent` or `failed`.

So two jobs running at once can't both send. What a run does with an existing row:

| Row status | Without `--force` | With `--force` |
|---|---|---|
| none | claim and send | claim and send |
| `failed` | retry (attempts + 1) | retry |
| `sent` | skip (ok) | send again |
| `claimed` | **not sent**; reported as `needs attention: possibly sent` (exit 1) | send again |

A sender can also report an **uncertain** outcome (e.g. Mailchimp's schedule call failed and the campaign status couldn't be read back). The row is then left `claimed`, not `failed`, so it is never retried automatically; the report says `outcome unknown, send_log left claimed`.

A row stuck at `claimed` means a run was interrupted mid-send (or another run is still going). The message may or may not have gone out, so it is never resent automatically. Check with the provider, then use `--force` if it needs sending.

Dry-run and live are tracked separately, so a dry-run never blocks a live send. Any `send_log` error before sending blocks that channel (to avoid double-sending). An error recording the outcome is reported (`logError`) and the run exits 1.

The table is defined at the end of `db/setup.sql`. `setup.sql` drops and recreates the whole database, so on an existing database run only the `CREATE TABLE send_log …` statement (and drop any earlier `send_log` from before this change first).

### Cron (04:30 London, for the 05:15 send)

The job works out "today" in Europe/London itself and asks Mailchimp to send at `SEND_TIME` (05:15), so it runs a while before that to leave room for a retry. Use `CRON_TZ` where your cron supports it (cronie, most Linux distributions). It can run every day: Shabbos and Yom Tov are skipped by the job (exit 0).

```cron
CRON_TZ=Europe/London
30 4 * * * cd /path/to/t4torah-app && /usr/bin/env PATH=/usr/local/bin:/usr/bin:/bin npm run send:daily -- --dry-run=false >> "$HOME/t4torah-send-daily.log" 2>&1
```

Cron runs with a minimal `PATH`, so make sure `npm`/`node` can be found (as above, or with the full path from `which npm`). Log outside the repo, or add the log file to `.gitignore`.

Without `CRON_TZ`, schedule it in the server's time zone. On a UTC server, `30 4 * * *` is 04:30 GMT in winter but 05:30 BST in summer, which is after the send time (the job would then send at once, late). Use `CRON_TZ` or `30 3 * * *` on UTC.

A run after 05:15 on the same day (e.g. a manual retry) sends at once instead of scheduling and logs it as late. A run for a date that has already passed is refused.

Cron treats a non-zero exit as a failure; point `MAILTO` or your monitoring at it. There is no separate failure alert yet: failures are visible in the job's output and log. Re-running after a failure is safe: already-sent channels are skipped.

## Mailchimp

Live email sends one Mailchimp campaign per day to the existing audience. The campaign targets the audience ID with no segment, so Mailchimp delivers only to **subscribed** members; unsubscribed and cleaned contacts never receive it.

Per send (`src/services/senders/mailchimpSender.js`):

1. `POST /campaigns`: type `regular`, `list_id` = `MAILCHIMP_AUDIENCE_ID`, subject (with the special date when there is one), from name, reply-to.
2. `PUT /campaigns/{id}/content`: our rendered HTML and plain text (`src/templates/dailyEmail.html`). No Mailchimp template is used.
3. `POST /campaigns/{id}/actions/schedule` for `SEND_TIME` in `SEND_TIMEZONE` (05:15 Europe/London, BST-aware). If the run is less than 5 minutes before the send time, or later that day, it uses `actions/send` instead (logged as late).
4. `GET /campaigns/{id}`: confirms the status is `schedule` (or `sending`/`sent`) and logs the recipient count.

The campaign ID is stored in `send_log.provider_message_id`, and the log line reads e.g.

```
[live] mailchimp time4mishna 2026-10-19: campaign 3f2a… scheduled for 2026-10-19T04:15:00.000Z (status schedule, 2431 recipients)
```

Only `time4mishna` goes to Mailchimp (Time4Nach is out of scope and would reach the same audience). Set `SEND_PROGRAMS=time4mishna`; any other program fails loudly. The email must contain `*|UNSUB|*`, so set `EMAIL_UNSUBSCRIBE_URL=*|UNSUB|*`; without it the send is refused before contacting Mailchimp.

**Retries:** 429 and 5xx responses are retried 3 times with exponential backoff (1s, 2s, 4s). Other errors fail at once.

**Failures:**

| What failed | Outcome | send_log |
|---|---|---|
| Config, content, or a past date | nothing sent to Mailchimp | `failed` (retryable) |
| Create campaign or set content | nothing scheduled; any draft is named in the error | `failed` (retryable) |
| Schedule/send call, but the campaign is scheduled/sent | ok | `sent` |
| Schedule/send call, and the campaign is still a draft | nothing scheduled | `failed` (retryable) |
| Schedule/send call, and the status can't be read | **unknown** | left `claimed`: check Mailchimp, then `--force` if needed |

A retry after a failure creates a new campaign; delete any leftover drafts in Mailchimp.

| Variable | Default | |
|---|---|---|
| `MAILCHIMP_API_KEY` | *(required)* | ends in the server prefix, e.g. `…-us21` |
| `MAILCHIMP_SERVER_PREFIX` | from the key | e.g. `us21` |
| `MAILCHIMP_AUDIENCE_ID` | *(required)* | the audience (list) ID |
| `MAILCHIMP_FROM_NAME` | *(required)* | |
| `MAILCHIMP_REPLY_TO` | *(required)* | an email address |
| `SEND_TIME` | `05:15` | `HH:MM`, on the quarter hour (Mailchimp's rule) |
| `SEND_TIMEZONE` | `Europe/London` | IANA time zone |

A live run with email checks these at startup and exits 2 listing every problem. A dry-run checks them only if a `MAILCHIMP_*` variable is set.

Live `.env` for the daily Mailchimp send:

```sh
SEND_MODE=live
SEND_CHANNELS=email
SEND_PROGRAMS=time4mishna
EMAIL_UNSUBSCRIBE_URL=*|UNSUB|*
```

### First live send

1. Dry-run with the Mailchimp variables set: `npm run send:daily -- --date=<a send day>`. Check `outbox/<date>/email-time4mishna.html` and `.mailchimp.json`.
2. Point `MAILCHIMP_AUDIENCE_ID` at a **test audience** containing only yourself, then `npm run send:daily -- --dry-run=false --date=<tomorrow's send day>`. The campaign is scheduled for 05:15; check it in Mailchimp (you can unschedule it there), and `GET /api/v1/sends/log?date=…`.
3. Switch to the real audience ID and add the cron line.

## WhatsApp provider (checklist)

1. **Choose a BSP** (Wati / AiSensy) and record the decision (e.g. in this file or the PR description).
2. **Credentials** go in `.env` only. Add placeholder names to `.env.example`. Never commit real keys.
3. **Implement the sender** (e.g. `src/services/senders/<bsp>Sender.js`, as `mailchimpSender.js` does for email) and register it for `live.whatsapp` in `src/services/senders/index.js`, replacing the stub in `providerSenders.js`:
   - keep the interface: `{ name, channel, send(message) → Promise<{ ok, id?, error?, uncertain? }> }`;
   - return the provider's message id as `id` (it goes into `send_log.provider_message_id`, max 255 characters);
   - return `{ ok: false, error }` for provider errors, and add `uncertain: true` when the message may have gone out anyway.
4. **Attachments:** send `message.whatsapp.attachments` as media messages (audio + document) by URL. The bucket files must be publicly reachable. Check with the BSP how this works for a broadcast: business-initiated messages need an approved template, and template headers support documents but (as far as we know) not audio, so the mp3 may have to go as a document or as a follow-up message. Also confirm whether the BSP can post to the existing WhatsApp groups or only to individual numbers.
5. **Templates:** check that the rendered text fits the BSP's template/variable rules, and whether the 1,000-character cap (`WHATSAPP_MAX_LENGTH`) should change.
6. **Tests:** mock the provider's HTTP client and never call the real API in tests (`npm run test:ci` must stay offline).
7. **Try it safely first:** send to a test number with `SEND_MODE=live` and `--dry-run=false --channel=whatsapp --date=<a test date>`, then check `GET /api/v1/sends/log`.
8. **Only then** add `whatsapp` to `SEND_CHANNELS` on the server.
