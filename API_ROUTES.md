# API Routes

Base prefix: `/api/v1`

Calendar and static asset routes are served outside `/api/v1`.

All routes are `GET` only.

## Calendar Pages

- `GET /calendar/maker`
  - Returns the calendar generation form.
  - Example: `curl http://localhost:3000/calendar/maker`

- `GET /calendar`
  - Generates month assets and returns the rendered HTML calendar page.
  - Query params: `month`, `year`
  - Example: `curl "http://localhost:3000/calendar?month=4&year=2026"`

- `GET /calendar/export`
  - Generates export files for a month calendar.
  - Query params: `month`, `year`, `format`
  - `format` may be `pdf`, `png`, or `all`
  - `pdf` returns the generated PDF file
  - `png` returns the generated PNG file
  - `all` returns JSON with both generated file paths
  - Examples:
    - `curl -OJ "http://localhost:3000/calendar/export?month=4&year=2026&format=pdf"`
    - `curl -OJ "http://localhost:3000/calendar/export?month=4&year=2026&format=png"`
    - `curl "http://localhost:3000/calendar/export?month=4&year=2026&format=all"`

## Static Assets

- `GET /imgs/:filename`
  - Serves calendar image assets from the repo root `imgs` folder.
  - Example: `curl http://localhost:3000/imgs/wholeHeader.png --output wholeHeader.png`

- `GET /calendar-files/:path`
  - Serves files from the `calendar` folder, including generated HTML, JSON, PDF, and PNG files.
  - Example: `curl http://localhost:3000/calendar-files/generated/calendar_04_2026.pdf --output calendar_04_2026.pdf`

## Health

- `GET /health`
  - Example: `curl http://localhost:3000/api/v1/health`

## Mishnayos

- `GET /mishnas`
  - Query params: `masechta_id`, `perek`, `mishna`, `limit`, `offset`
  - Example: `curl "http://localhost:3000/api/v1/mishnas?masechta_id=1&perek=2&limit=50&offset=0"`
- `GET /mishnas/:mishnaId`
  - Example: `curl http://localhost:3000/api/v1/mishnas/123`

## Sedarim

- `GET /sedarim`
  - Example: `curl http://localhost:3000/api/v1/sedarim`

## Masechtos

- `GET /masechtos`
  - Example: `curl http://localhost:3000/api/v1/masechtos`
- `GET /masechtos/:masechtaId`
  - Example: `curl http://localhost:3000/api/v1/masechtos/5`

## Dates

- `GET /dates`
  - Query params: `gregorian_date`, `hebrew_date`, `is_yom_tov`, `special_date`, `limit`, `offset`
  - Example: `curl "http://localhost:3000/api/v1/dates?gregorian_date=2024-01-01&limit=50"`
- `GET /dates/:dateId`
  - Example: `curl http://localhost:3000/api/v1/dates/10`
- `GET /dates/:dateId/full`
  - Example: `curl http://localhost:3000/api/v1/dates/10/full`

## Tanach

- `GET /tanach`
  - Query params: `section`, `subsection`, `sefer_name`
  - Example: `curl "http://localhost:3000/api/v1/tanach?section=Torah"`
- `GET /tanach/:seferId`
  - Example: `curl http://localhost:3000/api/v1/tanach/3`

## Time4Mishna

- `GET /time4mishna/shiurim`
  - Query params: `start_mishna`, `end_mishna`, `shiur_title`
  - Example: `curl "http://localhost:3000/api/v1/time4mishna/shiurim?shiur_title=Weekday"`
- `GET /time4mishna/shiurim/:shiurId`
  - Example: `curl http://localhost:3000/api/v1/time4mishna/shiurim/2`
- `GET /time4mishna/schedule`
  - Query params: `date_id`, `limit`, `offset`
  - Example: `curl "http://localhost:3000/api/v1/time4mishna/schedule?date_id=10&limit=50"`
- `GET /time4mishna/schedule/:dailyScheduleId`
  - Example: `curl http://localhost:3000/api/v1/time4mishna/schedule/7`

## Time4Nach

- `GET /time4nach/shiurim`
  - Query params: `sefer_id`, `perek`, `shiur_title`
  - Example: `curl "http://localhost:3000/api/v1/time4nach/shiurim?sefer_id=4&perek=2"`
- `GET /time4nach/shiurim/:shiurId`
  - Example: `curl http://localhost:3000/api/v1/time4nach/shiurim/3`
- `GET /time4nach/schedule`
  - Query params: `date_id`, `limit`, `offset`
  - Example: `curl "http://localhost:3000/api/v1/time4nach/schedule?date_id=10&limit=50"`
- `GET /time4nach/schedule/:dailyScheduleId`
  - Example: `curl http://localhost:3000/api/v1/time4nach/schedule/9`

## Sends

Daily send automation. Previews never send anything or write to `send_log`. See [docs/SENDING.md](docs/SENDING.md).

- `GET /sends/preview`
  - Returns the rendered message for a date as JSON: `{ date, program, sendDay, email?: { subject, html, text }, whatsapp?: { text } }`.
  - Query params: `date` (required, `YYYY-MM-DD`), `program` (`time4mishna` default, `time4nach`, `combined`), `channel` (`email` or `whatsapp`; both when omitted)
  - `sendDay` is `false` when the job would skip the date (Shabbos/Yom Tov).
  - `400` for a bad date, program or channel; `404` when the date isn't in `dates_table`.
  - Example: `curl "http://localhost:3000/api/v1/sends/preview?date=2026-09-28&program=time4nach&channel=whatsapp"`
- `GET /sends/preview.html`
  - Returns the email HTML directly (`text/html`), for viewing in a browser.
  - Query params: `date` (required), `program`
  - `400` / `404` as above (as JSON).
  - Example: `curl "http://localhost:3000/api/v1/sends/preview.html?date=2026-09-28&program=combined" --output preview.html`
- `GET /sends/log`
  - Read-only send log for a date: `{ date, entries: [{ id, program, channel, mode, status, providerMessageId, createdAt }] }`, oldest first. Empty `entries` when nothing has been sent.
  - Query params: `date` (required, `YYYY-MM-DD`)
  - `400` for a bad date.
  - Example: `curl "http://localhost:3000/api/v1/sends/log?date=2026-09-28"`
