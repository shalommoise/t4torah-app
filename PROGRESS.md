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
