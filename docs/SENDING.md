# Daily send automation

One daily job reads the day's Time4Mishna and Time4Nach schedule from the database, renders an email and a WhatsApp message, and hands them to pluggable senders.

**Status:** dry-run only. No email provider (MailerLite / Brevo) or WhatsApp BSP (Wati / AiSensy) has been chosen, so the live senders are stubs that always fail. Nothing in this code can reach a real provider.

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
| Send-day rules | `src/services/sendRules.js` | Skips when `day_of_week` is `Shabbos` or `is_yom_tov` is set. Chol HaMoed and Fridays send. |
| Labels | `src/services/shiurLabelService.js` | `Brachos 1:1–1:4`, `Brachos 9:5 – Peah 1:3`, `Tehillim 42`, `Chazara`. |
| Shared sections | `src/services/render/dailySections.js` | Per-program sections, date formatting, `stripLinks`. |
| Message model | `src/services/render/dailyMessage.js` | `DailyMessage = { date, program, email: { subject, html, text }, whatsapp: { text } }`. |
| Subject | `src/services/render/subjectLine.js` | `SUBJECT_FORMAT`, e.g. `Time4Mishna – Monday 28 Sep | 17 Tishrei | Chol HaMoed Sukkos`. Empty parts are dropped. |
| Email | `src/services/render/emailRenderer.js` | `{{token}}` template, inline CSS, 600px max width, Hebrew date in `dir="rtl"`. |
| WhatsApp | `src/services/render/whatsappRenderer.js` | `*bold*` / `_italic_`, under 1,000 characters (truncated with `…`). |
| Senders | `src/services/senders/` | `index.js` (interface, registry, `getSenders`), `consoleSender.js`, `fileSender.js`, `providerSenders.js` (live stubs). |
| Config | `src/config/send.js` | `getSendConfig(env)`. |
| Send log | `src/models/sendLogModel.js`, `send_log` table | Stops a program/channel from going out twice on the same date. |
| London dates | `src/utils/londonDate.js` | `londonToday`, `londonTomorrow`, `addDays`; handles BST/GMT. |
| Preview API | `src/routes/sendsRouter.js` → `src/controllers/sendsController.js` → `sendPreviewService.js` / `sendLogService.js` | See [API_ROUTES.md](../API_ROUTES.md#sends). |

### Content rules

- **No external links.** Messages never contain links. URLs (`http(s)://…`, `www.…`) in `special_date` or `additional_notice` are removed.
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

The job also needs the usual `DATABASE_*` variables.

### Dry-run vs live

- **Dry-run** (default): each channel has a console sender (one summary line) and a file sender, which writes `OUTBOX_DIR/<date>/<channel>-<program>.html|.txt`. Email gets `.html` plus `.txt` with a `Subject:` line; WhatsApp gets `.txt`. Re-runs overwrite.
- **Live** needs **both** `SEND_MODE=live` **and** `--dry-run=false`.
  - `SEND_MODE=live` on its own still runs a dry-run.
  - `--dry-run=false` without `SEND_MODE=live` is a usage error (exit 2).
  - Today the live senders are stubs, so every live send fails with `Not implemented: provider not chosen`.

## Previewing

With the API running (`npm start` or `npm run dev`):

```sh
# Rendered email + WhatsApp as JSON (program defaults to time4mishna)
curl "http://localhost:3000/api/v1/sends/preview?date=2026-09-28&program=time4nach"

# Just one channel
curl "http://localhost:3000/api/v1/sends/preview?date=2026-09-28&channel=whatsapp"

# The email itself: open in a browser
open "http://localhost:3000/api/v1/sends/preview.html?date=2026-09-28&program=combined"

# What has been sent for a date
curl "http://localhost:3000/api/v1/sends/log?date=2026-09-28"
```

The preview renders exactly what the job would send. `sendDay: false` means the job would skip that date (Shabbos/Yom Tov). Previews never send anything or write to `send_log`.

A dry-run of the job is also a preview: run it and open the files in `outbox/<date>/`.

## Running the job

```sh
npm run send:daily                                  # today (Europe/London), dry-run
npm run send:daily -- --date=2026-09-28             # a specific date
npm run send:daily -- --channel=whatsapp            # one channel (comma-separate for several)
npm run send:daily -- --force                       # send again even if send_log says sent
npm run send:daily -- --help
```

| Flag | Default | Meaning |
|---|---|---|
| `--date=YYYY-MM-DD` | today in Europe/London | Date to send |
| `--dry-run[=true\|false]` | `true` | `false` also needs `SEND_MODE=live` |
| `--channel=email\|whatsapp` | `SEND_CHANNELS` | Overrides the channels |
| `--force` | off | Ignores `send_log` "sent" rows |

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
| `1` | Any send failed, a `send_log` read/write failed, or the date isn't in `dates_table` |
| `2` | Bad flags, invalid `SEND_*` config, or an invalid date |

A date missing from `dates_table` is a failure on purpose: it means the calendar hasn't been seeded far enough ahead.

### Idempotency (`send_log`)

Each run records one row per date/program/channel/mode (`sent` or `failed`). A later run for the same date and mode skips anything already `sent`, and still sends anything that `failed`. `--force` sends regardless. Dry-run and live are tracked separately, so a dry-run never blocks a live send.

If `send_log` can't be read, that channel is **not** sent (to avoid double-sending); use `--force` if you're sure.

The table is defined at the end of `db/setup.sql`. `setup.sql` drops and recreates the whole database, so on an existing database run only the `CREATE TABLE send_log …` statement.

### Cron (5am London)

The job works out "today" in Europe/London itself, so it only needs to run once in the London morning. Use `CRON_TZ` where your cron supports it (cronie, most Linux distributions):

```cron
CRON_TZ=Europe/London
0 5 * * * cd /path/to/t4torah-app && /usr/bin/env PATH=/usr/local/bin:/usr/bin:/bin npm run send:daily >> "$HOME/t4torah-send-daily.log" 2>&1
```

Cron runs with a minimal `PATH`, so make sure `npm`/`node` can be found (as above, or with the full path from `which npm`). Log outside the repo, or add the log file to `.gitignore`.

Without `CRON_TZ`, schedule it in the server's time zone. On a UTC server, `0 5 * * *` is 05:00 GMT in winter and 06:00 BST in summer.

Cron treats a non-zero exit as a failure; point `MAILTO` or your monitoring at it. Re-running after a failure is safe: already-sent channels are skipped.

## Plugging in a real provider (checklist)

1. **Choose providers** and record the decision in `PROGRESS.md` (email: MailerLite / Brevo; WhatsApp BSP: Wati / AiSensy).
2. **Credentials** go in `.env` only. Add placeholder names to `.env.example` (e.g. `EMAIL_PROVIDER_API_KEY=`). Never commit real keys.
3. **Implement the sender** in `src/services/senders/providerSenders.js`, replacing the stub:
   - keep the interface: `{ name, channel, send(message) → Promise<{ ok, id?, error? }> }`;
   - return the provider's message/campaign id as `id` (it goes into `send_log.provider_message_id`, max 255 characters);
   - return `{ ok: false, error }` for provider errors. Throwing is also handled, but a returned error is clearer.
4. **Decide the audience model.** The current `DailyMessage` has no recipients. Decide whether the provider sends to a list/segment per program (e.g. one MailerLite group per program) and keep that mapping in config, not code.
5. **WhatsApp specifics:** business-initiated messages usually need an approved template. Check that the rendered text fits the BSP's template/variable rules, and whether the 1,000-character cap (`WHATSAPP_MAX_LENGTH`) should change.
6. **Tests:** mock the provider's HTTP client and never call the real API in tests (`npm run test:ci` must stay offline).
7. **Try it safely first:** send to a test list/number with `SEND_MODE=live` and `--dry-run=false --date=<a test date>`, then check `GET /api/v1/sends/log`.
8. **Only then** add the cron line with `--dry-run=false`, and keep `SEND_MODE=live` in the server's `.env`.
