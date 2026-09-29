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
