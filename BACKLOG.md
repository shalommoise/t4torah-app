# Backlog — daily send automation (`feature/send-automation`)

Goal: a single daily job that reads the day's Time4Mishna and Time4Nach schedule from the DB, renders an email and a WhatsApp message, and hands them to pluggable senders. Email provider (MailerLite / Brevo) and WhatsApp BSP (Wati / AiSensy) are **not chosen yet**, so everything here is provider-agnostic and defaults to dry-run.

Legend: `[ ]` todo · `[x]` done · `[!]` blocked (reason noted)
Work top to bottom. Read CLAUDE.md first.

## A. Content

- [x] **A1 Daily content service** — `src/services/dailyContentService.js`: `getDailyContent(gregorianDate)` → looks up the date row (via `selectDates` filter or a new `selectDateByGregorianDate` model fn), then `selectTime4MishnaScheduleByDateId` and `selectTime4NachScheduleByDateId`. Returns `{ date, time4mishna: [...], time4nach: [...] }`. Returns `null` when the date isn't in `dates_table`. Validate `YYYY-MM-DD`. Tests with mocked models.
- [x] **A2 Send-day rules** — `shouldSendOn(dateRow)` in a small `src/services/sendRules.js`: no send when `day_of_week === 'Shabbos'` or `is_yom_tov` is true. Pure function, well tested (weekday, Friday, Shabbos, Yom Tov, Chol HaMoed = send).
- [x] **A3 Shiur label formatting** — pure helpers: Mishna range label (e.g. `Brachos 1:1–1:4`, and cross-masechta `Brachos 9:5 – Peah 1:3`) from the joined schedule row fields; Nach label (`<sefer_name> <perek>`). Reuse/align with `parseShiurTitle` in `utils/utils.js`. Handle `null` shiur (no-shiur days) and `additional_notice`.
- [x] **A4 Sefaria links** — helper that builds a Sefaria URL for a Mishna range and a Nach perek (e.g. `https://www.sefaria.org/Mishnah_Berakhot.1.1-4`). Needs a masechta → Sefaria name map: derive from `db/data/masechtaNames.json` / `SefariaUtils/getmishnayos.js` if possible; otherwise mark `[!]` and use `alt_names`. No network calls. — **reverted in R1 (owner: no external links).**

## R. Revisions

- [x] **R1 Remove Sefaria links** — owner decision: daily messages contain no external links.
  Delete `src/services/sefariaLinkService.js` and its tests. Remove all link output from
  `emailRenderer.js` and `src/templates/dailyEmail.html` (including the "Learn on Sefaria"
  text), and any link field from the `DailyMessage` model. Leave the existing
  `SefariaUtils/` folder alone (it's pre-branch code). Update tests; `npm run test:ci` must pass.
  Note the reversal of A4 in PROGRESS.md.
- [x] **R2 Special date in subject line** — owner decision (2026-09-29): append `| <special_date>` to the subject when present (links stripped), e.g. `Time4Mishna – Monday 28 Sep | 17 Tishrei | Chol HaMoed Sukkos`.
- [x] **R3 Strip WhatsApp formatting characters** — owner decision (2026-09-29): remove `*`, `_`, `~` and backticks from DB text in the WhatsApp renderer so it can't break message formatting.
- [x] **R4 URLs in notices** — owner decision (2026-09-29): keep silently stripping URLs from `special_date` / `additional_notice` for now. No code change.

## B. Rendering

- [x] **B1 Message model** — define (JSDoc) the `DailyMessage` shape: `{ date, program: 'time4mishna'|'time4nach'|'combined', email: { subject, html, text }, whatsapp: { text } }`.
- [x] **B2 Email renderer** — `src/services/render/emailRenderer.js`: HTML + plain-text email from daily content. Template in `src/templates/dailyEmail.html` with simple `{{token}}` replacement (no templating dependency). Inline CSS, mobile-friendly, Hebrew date shown RTL (`dir="rtl"` on that element), special_date / additional_notice shown when present. Snapshot or string-contains tests.
- [x] **R1 Remove Sefaria links** — *(duplicate of R1 above; done in `02c76ac`, verified 2026-09-29)* — owner decision: daily messages contain no external links. Delete `src/services/sefariaLinkService.js` and its tests. Remove all link output from `emailRenderer.js` and `src/templates/dailyEmail.html` (including the "Learn on Sefaria" text), and any link field from the `DailyMessage` model. Leave the existing `SefariaUtils/` folder alone (pre-branch code). Update tests; `npm run test:ci` must pass. Note the reversal of A4 in PROGRESS.md.
- [x] **B3 WhatsApp renderer** — `src/services/render/whatsappRenderer.js`: WhatsApp-formatted text (`*bold*`, line breaks, no links). Keep under 1,000 characters; test the limit.
- [x] **B4 Subject lines** — deterministic subject format, e.g. `Time4Mishna – Monday 28 Sep | 26 Tishrei`. Put the format in one place so it's easy to change.

## C. Sending (dry-run only)

- [x] **C1 Sender interface** — `src/services/senders/index.js`: documented interface `{ name, channel: 'email'|'whatsapp', send(message) → Promise<{ ok, id?, error? }> }`, plus `getSenders(config)` factory.
- [x] **C2 Console + file senders** — `consoleSender` (logs a summary) and `fileSender` (writes `outbox/<date>/<channel>-<program>.{html,txt}`; `outbox/` is gitignored). These are the defaults.
- [x] **C3 Live-mode stubs** — `emailProviderSender` and `whatsappProviderSender` stubs that throw `Not implemented: provider not chosen` and are only selectable when `SEND_MODE=live`. Tests prove dry-run is the default and live mode without a provider fails loudly.
- [x] **C4 Config** — `src/config/send.js` reading `SEND_MODE` (`dry-run` default), `SEND_CHANNELS` (`email,whatsapp`), `SEND_PROGRAMS`, `OUTBOX_DIR`. Add placeholders to a new `.env.example` (create it; never touch `.env`).

## D. Orchestration

- [x] **D1 Dispatch service** — `src/services/dailySendService.js`: `runDailySend({ date, dryRun, channels })` → content → send-day rules → render → send via each sender → returns a result report (per channel/program: ok/error). One sender failing must not stop the others. Tests with mocked content + senders.
- [x] **D2 Idempotency / send log** — add a `send_log` table to `db/setup.sql` (date, program, channel, status, provider_message_id, created_at) and a model (`insertSendLog`, `selectSendLog(date, program, channel)`). Dispatch skips a channel/program already logged `sent` for that date unless `force`. Tests mock the model. Note the schema addition in PROGRESS.md.
- [x] **D3 CLI job** — `jobs/dailySend.js` + npm script `send:daily`: flags `--date=YYYY-MM-DD` (default: today in Europe/London), `--dry-run` (default true), `--channel=email|whatsapp`, `--force`. Exit code non-zero on any failure. Closes the DB pool on exit. Test the argument parsing as a pure function.
- [x] **D4 Send-time helper** — Europe/London "today"/"tomorrow" date helper (handles BST/GMT without a new dependency, via `Intl.DateTimeFormat`). Tested across the late-October clock change.

## E. Admin preview API

- [x] **E1 Preview routes** — `GET /api/v1/sends/preview?date=YYYY-MM-DD&channel=email|whatsapp&program=...` returns rendered content as JSON; `GET /api/v1/sends/preview.html?date=...` returns the email HTML directly for viewing in a browser. 400 on bad date, 404 when no date row. Router → controller → service pattern; supertest tests with mocked service.
- [x] **E2 Send log route** — `GET /api/v1/sends/log?date=...` (read-only). Tests.

## F. Docs & hygiene

- [x] **F1 Docs** — `docs/SENDING.md`: architecture, config, how to preview, how to run the job via cron (e.g. `crontab` line for 5am London), and a checklist for plugging in a real provider later. Update `API_ROUTES.md` for the new routes and README features list.
- [x] **F2 Tests for existing untested controllers** — add mocked supertest coverage for dates (`/dates`, `/dates/:id/full`), tanach, time4mishna and time4nach routes, including 400/404 cases.
- [x] **F3 Final review pass** — read the whole diff vs `master`, remove dead code/console noise, make sure `npm run test:ci` passes, and write a PROGRESS.md summary listing: what was built, schema changes, open decisions for the owner, and suggested next steps.

## G. Pre-live hardening (from Codex review of `0e608c7`, owner-approved 2026-10-01)

Must be done before any real provider is plugged in. Still dry-run only; same hard rules.

- [x] **G1 Fail-closed send rules** — `shouldSendOn` currently sends unless the row says Shabbos or `is_yom_tov` is truthy, so `{ day_of_week: null, is_yom_tov: null }` sends. Change to: send only when `day_of_week` is one of the known weekday names (Sunday–Friday, matching the values used in `dates_table`) and `is_yom_tov` is explicitly `false`/`0`. Anything missing or unrecognised → no send, and `runDailySend` reports it as an error (`invalid calendar row`) rather than a silent skip, so the CLI exits non-zero. Tests: null/undefined/unknown values for each field, MySQL tinyint `0`/`1`, existing weekday/Friday/Shabbos/Yom Tov/Chol HaMoed cases unchanged.
- [ ] **G2 Atomic send claim** — replace read-then-send-then-insert in `dailySendService.sendChannel`. In `db/setup.sql`, change the (new, not yet deployed) `send_log` table to one row per `(send_date, program, channel, mode)` with a `UNIQUE` key, `status` (`claimed`|`sent`|`failed`), `attempts`, `provider_message_id`, `created_at`, `updated_at`. Flow: claim with `INSERT` (duplicate key → no claim) or, for a `failed` row, `UPDATE … SET status='claimed', attempts=attempts+1 WHERE … AND status='failed'` (claim only if `affectedRows === 1`); send only after a successful claim; then set `sent`/`failed`. A row left `claimed` (crash mid-send) is never auto-resent: report it as `needs attention: possibly sent` and only `--force` overrides. Update the model, E2 log route and `docs/SENDING.md`. Tests mock the model, including two concurrent `runDailySend` calls where only one sends. Note the schema change in PROGRESS.md. (Provider idempotency keys: leave a TODO in the live stubs' JSDoc.)
- [ ] **G3 Protect `/api/v1/sends/*`** — middleware on `sendsRouter` requiring `Authorization: Bearer <token>` matching `SENDS_ADMIN_TOKEN` (compare with `crypto.timingSafeEqual`). If the env var is unset or empty, the routes return 503 (fail closed, never open). 401 for missing/wrong token. Add the placeholder to `.env.example` (never `.env`). Don't change the global CORS setup in `src/app.js` (other routes may depend on it); note it in PROGRESS.md as an owner decision. supertest tests for 503/401/200.
- [ ] **G4 Subject sanitising** — in `subjectLine.js`, replace CR/LF/tabs and other control characters (incl. Unicode bidi controls except those needed for Hebrew display) in all DB-derived parts with a single space, collapse whitespace, and cap the subject at a sensible length (e.g. 150 chars) without cutting mid-word. Tests with `\r\n` injection attempts and long special dates.
- [ ] **G5 One strict date parser** — a shared helper (e.g. `src/utils/dateUtils.js`) that accepts only real `YYYY-MM-DD` dates (no rollover: reject `2026-02-30`, `2026-99-99`). Use it in `dailyContentService.js`, `render/dailyMessage.js`, `render/dailySections.js`, `render/subjectLine.js` and `utils/londonDate.js` (keep existing error types/statuses). Tests for leap years, month ends and malformed input.
- [ ] **G6 Docs + hygiene** — `docs/SENDING.md`: soften "messages never contain links" to what R4 actually does (http(s)/`www.` URLs are stripped; bare domains, emails and phone numbers are not, and WhatsApp may auto-link them). Fix trailing whitespace in `db/setup.sql` and confirm `git diff --check master...HEAD` is clean. Add a PROGRESS.md summary of section G and refresh the F3 summary's open-decisions list. Also list for the owner: run `npm run test:integration` against a real MySQL after applying the new `send_log` schema.
