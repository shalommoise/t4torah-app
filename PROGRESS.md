# Progress log — `feature/send-automation`

Newest entries at the bottom. Each unattended run appends one entry.

## 2026-09-28 13:10 — setup (Claude, interactive)

- Created branch `feature/send-automation` from `master` (a6b2e4c).
- Added `CLAUDE.md` (rules for unattended runs), `BACKLOG.md`, this log.
- Moved `__tests__/masechtaRoute.test.js` → `__tests__/integration/` (it needs a live MySQL and failed without one).
- Added npm scripts `test:ci` (non-watch, excludes integration tests) and `test:integration`.
- Added `outbox/` to `.gitignore` (dry-run output).
- Baseline: `npm run test:ci` → 4 suites, 17 tests passing.

## 2026-09-28 23:26 — unattended run

Completed 3 items (per-run limit):

- **A1 Daily content service** (`src/services/dailyContentService.js`): `getDailyContent(gregorianDate)` validates `YYYY-MM-DD` (rejects malformed and non-existent calendar dates like `2026-02-30`), then reuses `selectDates({ gregorianDate }, ...)` rather than adding a new model function (the existing filter already covers it) to look up the date row, and fetches both schedules by `date_id`. Returns `null` when the date isn't in `dates_table`; throws a `{ status: 400 }` error on an invalid date string, matching the convention in `calendarService.parseMonthYear`.
- **A2 Send-day rules** (`src/services/sendRules.js`): `shouldSendOn(dateRow)` — no send on `day_of_week === 'Shabbos'` or a truthy `is_yom_tov` (tested with both a JS boolean and a MySQL tinyint `1`); sends on weekdays, Fridays and Chol HaMoed; `false` for a missing date row.
- **A3 Shiur label formatting** (`src/services/shiurLabelService.js`): `formatMishnaShiurLabel`, `formatNachShiurLabel`, `getAdditionalNotice`. Mishna labels use a compact en-dash for a single masechta (`Brachos 1:1–1:4`) and a spaced en-dash across masechtos (`Brachos 9:5 – Peah 1:3`); falls back to parsing the raw `shiur_title` via `utils/utils.js`'s `parseShiurTitle` when the joined masechta/perek/mishna fields aren't populated. Both label functions return `'Chazara'` for any non-`'regular'` `shiur_type`, matching the existing convention in `calendarService.normalizeShiur`, and `null` for a no-shiur day (no schedule row) or insufficient data.

Decisions / notes for the owner:

- A1 did not add `selectDateByGregorianDate` to `datesModel.js` — the backlog offered it as an option, and the existing `selectDates` filter already does the job with no new model code.
- No schema, config, or dependency changes this run.

`npm run test:ci` → 7 suites, 43 tests passing (baseline 4/17).

Next up: A4 (Sefaria links — check `db/data/masechtaNames.json` / `SefariaUtils/getmishnayos.js` for a usable masechta→Sefaria name map before assuming `[!]`), then section B (rendering).

## 2026-09-29 — run (Claude, local, owner-supervised)

Pre-run fix (own commit, `11cd7a1`):

- **`.gitignore` repair.** The setup commit (`bb0f207`) appended `outbox/` to a last line that had no trailing newline, producing `calendar/generatedoutbox/`. That un-ignored `calendar/generated/` (~82k generated calendar files locally) and never ignored `outbox/`. Split back into two lines; owner approved.
- The first `npm run test:ci` after `npm ci` reported 4 failed suites (0 failed tests); every rerun since has passed (7 suites / 43 tests). Treated as a cold-start flake. That first result was piped through `tail`, so the `.gitignore` commit went in before the failure was noticed. Its content doesn't touch any code and the suite passes on it. From now on commits are gated on the `test:ci` exit code.

Completed 3 items:

- **A4 Sefaria links** (`src/services/sefariaLinkService.js`): no `[!]` needed. The masechta → Sefaria map is derived at load time from `db/data/masechtaNames.json` (the order matches the ids in `masechta_table`) joined to `db/data/mishnaIndex.json`'s `masechtaNameAlt`. `SefariaUtils/getmishnayos.js` used those exact titles to fetch from Sefaria. Nach titles come from `tanach_index.json` `alt_name`, with `1 `/`2 ` rewritten to `I `/`II ` (Sefaria's `I_Samuel`). URL formats: `Mishnah_Berakhot.1.1-4`, `Mishnah_Berakhot.1.5-2.3`, `Psalms.42`.
- **B1 Message model** (`src/services/render/dailyMessage.js`): JSDoc `DailyMessage` typedef, plus `createDailyMessage()`, which validates the shape and throws `TypeError` so that renderer bugs fail before reaching a sender.
- **B2 Email renderer** (`src/services/render/emailRenderer.js`, `src/templates/dailyEmail.html`): `renderEmail(content, { program })` → `{ html, text }`. Uses `{{token}}` replacement (throws on an unknown token), escapes all DB values, uses table layout with inline CSS and max-width 600px, puts the Hebrew date in `<p dir="rtl" lang="he">`, and shows `special_date` / `additional_notice` when present. A no-shiur day shows "No shiur today."; chazara shows "Chazara" with no link.

Decisions / for owner review:

- **Cross-masechta Sefaria links:** Sefaria refs can't span books, so a shiur like `Brachos 9:5 – Peah 1:3` yields two links (`Mishnah_Berakhot.9.5`, `Mishnah_Peah.1.1-3`). The end of the first masechta comes from `chapterIndex.json`.
- **Subject lines are not in B2:** `renderEmail` returns only `html`/`text`. The subject is B4, and D1 will assemble the full `DailyMessage`.
- Link text is "Learn on Sefaria"; `combined` title is "Time4Mishna & Time4Nach". Both are easy to change.
- No schema, config or dependency changes.

`npm run test:ci` → 10 suites, 89 tests passing.

Next up: B3 (WhatsApp renderer, can reuse the section-building in `emailRenderer.js`; consider extracting it), B4 (subject lines), then section C.

## 2026-09-29 — R1 (Claude, local, owner-requested)

- **R1 Remove Sefaria links — reverses A4.** The owner decided that daily messages contain no external links. Deleted `src/services/sefariaLinkService.js` and `__tests__/sefariaLinkService.test.js`, and removed the "Learn on Sefaria" output (HTML and text) from `emailRenderer.js`. `dailyEmail.html` and the `DailyMessage` model had no link fields, so they are unchanged. `SefariaUtils/` is untouched. A4 stays `[x]` in BACKLOG.md as history; R1 (new section "R. Revisions") records the reversal.
- Added a test asserting that no program's email (HTML or text) contains `<a`, `href=` or an `http(s)://` URL.

For owner review:

- **B3 still says "links on their own line"** (WhatsApp renderer). That conflicts with the no-links decision. I left the backlog text unchanged. Please reword it, or a future run should treat the no-links decision as overriding it.

`npm run test:ci` → 9 suites, 73 tests passing.

## 2026-09-29 — run: R1 (verify), B3, B4 (Claude, local, owner-supervised)

**Correction to the previous entry.** The owner edited BACKLOG.md in the working tree during the R1 session: added a second R1 entry under section B, reworded B3 to "no links", and annotated A4. The R1 commit (`02c76ac`) used `git add BACKLOG.md` and swept those edits in without them being noticed. No content was lost, but it means the previous entry's claim that "B3 still says links on their own line" was wrong. Runs now review the staged diff before every commit.

Completed 3 items:

- **R1 (duplicate entry)**: the code work landed in `02c76ac`. This run checked that `sefariaLinkService` and its tests are gone and that the renderers/template have no link output, then ticked the second R1 entry with a pointer to `02c76ac`. R1 is now enforced more strictly (see decisions below).
- **B3 WhatsApp renderer** (`src/services/render/whatsappRenderer.js`): `renderWhatsapp(content, { program })` → `{ text }`. `*bold*` title and shiur labels, `_italic_` special date and notices, blank line between blocks. Section titles appear only for `combined`, since a single-program header already names the program. Output is capped below 1,000 Unicode code points and truncated with `…`. Shared section building has moved to `src/services/render/dailySections.js`, which the email renderer now uses too.
- **B4 Subject lines** (`src/services/render/subjectLine.js`): `buildSubject(dateRow, program)` → e.g. `Time4Mishna – Monday 28 Sep | 17 Tishrei`. The format is the single `SUBJECT_FORMAT` constant. The Hebrew part is `hebrew_date` (Hebcal `hdate`, e.g. `17 Tishrei 5787`) without its year, and is dropped if missing. Uses fixed English day/month names because `Intl` en-GB gives `Sept` on this machine's ICU (77.1).

Decisions / for owner review:

- **URLs in DB free text are stripped.** To make "no external links anywhere" hold, both renderers remove `http(s)://…` and `www.…` from `special_date` and `additional_notice` before output (`stripLinks`). A notice like "Register at https://x.com today" renders as "Register at today". If notices should instead be rejected or flagged, say so.
- WhatsApp text doesn't escape `*`/`_` in DB text (WhatsApp has no escape syntax); a notice containing them may render with odd formatting.
- `combined` subject/title is `Time4Mishna & Time4Nach`.
- The subject line has no special_date; say if you want one.
- No schema, config or dependency changes.

`npm run test:ci` → 12 suites, 99 tests passing.

Next up: C1 (sender interface), C2 (console + file senders), C3 (live-mode stubs).

## 2026-09-29 — run: C1 (Claude, local, owner-requested single item)

Owner asked for "the next thing", so this run did one item.

- **C1 Sender interface** (`src/services/senders/index.js`): JSDoc `Sender` / `SendResult` / `SenderFactory` typedefs; `assertSender()` checks for a non-empty `name`, a known `channel` and a `send()` function; `getSenders(config, registry = SENDER_REGISTRY)` returns the sender instances for `config.mode` (default `dry-run`) and `config.channels` (default all).

Decisions / for owner review:

- **Registry, not hard-wired senders.** `SENDER_REGISTRY` maps mode → channel → factory list. It is empty for now, so `getSenders()` returns `[]` until C2 registers the console/file senders under `dry-run` and C3 registers the stubs under `live`. Tests use their own registry.
- **Live is opt-in and strict.** Only `mode === 'live'` selects live senders. Any other value (`'LIVE'`, `''`) throws rather than silently falling back, so a typo in `SEND_MODE` fails loudly. An unknown channel also throws.
- The senders module doesn't import `src/config/env.js`, because that file opens the MySQL pool as soon as it's loaded.
- No schema, config or dependency changes.

`npm run test:ci` → 13 suites, 110 tests passing.

Next up: C2 (console + file senders; register them in `SENDER_REGISTRY['dry-run']`), C3, C4.

## 2026-09-29 — run: C2 (Claude, local, owner-requested single item)

**Owner package update (`1d65a45`).** Jest moved to devDependencies (^30.5.2) and mysql2 went to ^3.24.4. `npm ci` and `npm run test:ci` pass on it. The same commit also accidentally committed a stale BACKLOG.md, which dropped the "R. Revisions" section and un-ticked R1/B3/B4/C1. The owner confirmed it was an accident, so `2faa690` restores BACKLOG.md from `94be356`; that diff is the exact inverse of `1d65a45`'s BACKLOG change.

Completed 1 item:

- **C2 Console + file senders** (`src/services/senders/consoleSender.js`, `fileSender.js`), registered as the `dry-run` defaults in `SENDER_REGISTRY`, so `getSenders()` now returns console + file senders for both channels.
  - `consoleSender` logs one line, e.g. `[dry-run] email time4mishna 2026-09-28: "<subject>" (N chars text, M chars html)`. Its logger can be swapped via `config.logger`.
  - `fileSender` writes `<outboxDir>/<date>/<channel>-<program>.{html,txt}`. Email writes `.html` plus a `.txt` with a `Subject:` line on top; WhatsApp writes `.txt` only. `outboxDir` defaults to `./outbox` (gitignored), and re-runs overwrite. The message goes through `createDailyMessage()` first, so a bad `date`/`program` can't produce a path outside the outbox.
  - Both return `{ ok: false, error }` instead of throwing, which D1 needs so that one failing sender doesn't stop the others.

Notes:

- While writing the tests, one test briefly wrote `outbox/2026-09-28/whatsapp-time4mishna.txt` into the repo, because `path.resolve` doesn't use a mocked `process.cwd()`. That file was removed, and `fileSender` now resolves against `process.cwd()` explicitly. Tests write only to `os.tmpdir()`.
- No schema, config or dependency changes.

`npm run test:ci` → 14 suites, 119 tests passing.

Next up: C3 (live-mode stubs → `SENDER_REGISTRY.live`), C4 (config + `.env.example`).

## 2026-09-29 — run: C3 (Claude, local, owner-requested single item)

Completed 1 item:

- **C3 Live-mode stubs** (`src/services/senders/providerSenders.js`): `emailProviderSender` and `whatsappProviderSender` implement the Sender interface, and `send()` always rejects with `Not implemented: provider not chosen`. There's no provider code, no dependency and no network access. They are registered only in `SENDER_REGISTRY.live`.

Decisions / for owner review:

- **The stubs reject; they don't return `{ ok: false }`.** The backlog says they "throw", and a rejection is louder than a failed result. D1 must therefore treat a rejected `send()` as a failure for that channel (e.g. `Promise.allSettled`), not only `ok: false`. That keeps "one sender failing must not stop the others".
- **Mode selection is explicit.** `getSenders()` never reads `process.env`; `SEND_MODE` is turned into `config.mode` by C4. A test confirms that setting `SEND_MODE=live` in the environment doesn't select the stubs on its own.
- Live mode uses only the provider senders (no console/file alongside them).
- No schema, config or dependency changes.

`npm run test:ci` → 15 suites, 126 tests passing.

Next up: C4 (config: `src/config/send.js` + `.env.example`).

## 2026-09-29 — run: C4 (Claude, local, owner-requested single item)

Completed 1 item:

- **C4 Config** (`src/config/send.js`): `getSendConfig(env = process.env)` → `{ mode, channels, programs, outboxDir }`, which passes straight into `getSenders()`. Unset or blank variables use the defaults. Lists are trimmed and de-duplicated. An invalid value throws with the allowed values: `SEND_MODE=Live`, an unknown channel/program, or an empty list such as `SEND_CHANNELS=,`.
- **`.env.example`** (new): placeholders for the `SEND_*` / `OUTBOX_DIR` variables, plus every variable the existing code reads (`PORT`, `DATABASE_*`, seeding/schedule vars, `BUCKET_PATH`, `CHROME_BIN`, `CALENDAR_EXPORT_HOST`). Names and defaults were taken from `process.env.*` usages in the code; `.env` was not opened.

Decisions / for owner review:

- **`SEND_PROGRAMS` defaults to `time4mishna,time4nach`** (two separate messages per channel). The backlog gave no default. Set `SEND_PROGRAMS=combined` for a single joint message.
- **Mode values are case-sensitive and strict**: only `dry-run` or `live`. Anything else throws rather than falling back to dry-run, so a misspelt live setting can't go unnoticed.
- `send.js` doesn't load dotenv or `src/config/env.js`, which opens the MySQL pool as soon as it's loaded. D3 (CLI job) should call `require('dotenv').config()` itself and then `getSendConfig()`.
- No schema changes or new dependencies.

`npm run test:ci` → 16 suites, 138 tests passing.

Next up: D1 (dispatch service). It must treat a rejected `send()` (the C3 stubs) as a per-channel failure, as well as `ok: false`.

## 2026-09-29 — run: D1 (Claude, local, owner-requested single item)

Completed 1 item:

- **D1 Dispatch service** (`src/services/dailySendService.js`): `runDailySend({ date, dryRun = true, channels, programs, outboxDir, logger })`. It fetches content (`getDailyContent`), applies the send-day rules (`shouldSendOn`), renders each program once into a validated `DailyMessage` (B4 subject, B2 email, B3 WhatsApp), then sends it through every sender from `getSenders`. It returns a report: `{ date, mode, status, ok, reason?, results: [{ program, channel, sender, ok, id? | error? }] }`.
  - **Isolation:** a sender that rejects (e.g. the C3 stubs), returns `ok: false` or returns nothing becomes a failed entry for that sender only. A render failure fails that program only (`sender: null`, `error: "Render failed: …"`). The other programs and senders still run.
  - **Status:** `sent` (everything ok), `partial`, `failed` (nothing ok, including when there are no senders), `skipped` (Shabbos/Yom Tov; `ok: true`, no senders built), `no-date` (date missing from `dates_table`; `ok: false`). An invalid date string still throws (status 400) from `getDailyContent`.
  - Tests mock the content service and `getSenders`. Two tests use the real dry-run senders with an `os.tmpdir()` outbox (6 files written, 4 console lines), and live mode, where all 4 sends fail with the stub error and nothing is written.

Decisions / for owner review:

- **Live only when `dryRun === false`.** `undefined`, `'false'`, `0`, `null` all stay dry-run. D3's `--dry-run` flag must turn into a real boolean `false` to go live.
- **A missing date is a failure** (`ok: false`) so the cron job exits non-zero when `dates_table` hasn't been seeded far enough ahead. A skipped Shabbos/Yom Tov is success.
- `programs` defaults to the C4 default (`time4mishna,time4nach`). D3 should pass `getSendConfig().programs` / `.channels` / `.outboxDir`.
- No schema, config or dependency changes.

`npm run test:ci` → 17 suites, 156 tests passing.

Next up: D2 (send log + idempotency). Adds a `send_log` table to `db/setup.sql` (schema addition only; not run) and a `force` option to `runDailySend`.
