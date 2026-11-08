# API Routes

Base prefix: `/api/v1`

Calendar and static asset routes are served outside `/api/v1`.

All routes are `GET` only.

Every route is rate limited per client: 300 requests per 15 minutes by default, and 30 for `/calendar` and `/calendar/export`. Over the limit the response is `429` with `{ "error": "Too many requests, try again later" }`; `RateLimit` headers show the remaining budget. Limits are set in `.env` (`RATE_LIMIT_*`, `TRUST_PROXY`).

## Calendar Pages

- `GET /calendar/maker`
  - Returns the calendar generation form.
  - Example: `curl http://localhost:3000/calendar/maker`

- `GET /calendar`
  - Generates month assets and returns the rendered HTML calendar page.
  - Query params: `month` (1-12), `year` (2000-2100); anything else returns 400.
  - Example: `curl "http://localhost:3000/calendar?month=4&year=2026"`

- `GET /calendar/export` (admin only)
  - Generates export files for a month calendar.
  - Requires `Authorization: Bearer $SENDS_ADMIN_TOKEN`: 401 without a valid token, 503 when the variable is unset.
  - Prefer `npm run calendars:export`, which does the same without HTTP.
  - Query params: `month` (1-12), `year` (2000-2100), `format`
  - `format` may be `pdf`, `png`, or `all`
  - `pdf` returns the generated PDF file
  - `png` returns the generated PNG file
  - `all` returns JSON with both generated file paths
  - Examples:
    - `curl -OJ -H "Authorization: Bearer $SENDS_ADMIN_TOKEN" "http://localhost:3000/calendar/export?month=4&year=2026&format=pdf"`
    - `curl -OJ -H "Authorization: Bearer $SENDS_ADMIN_TOKEN" "http://localhost:3000/calendar/export?month=4&year=2026&format=png"`
    - `curl -H "Authorization: Bearer $SENDS_ADMIN_TOKEN" "http://localhost:3000/calendar/export?month=4&year=2026&format=all"`

## Static Assets

- `GET /imgs/:filename`
  - Serves `.png` and `.svg` image assets from the repo root `imgs` folder.
  - Example: `curl http://localhost:3000/imgs/wholeHeader.png --output wholeHeader.png`

- `GET /calendar-files/generated/:filename`
  - Serves the exported calendar PDFs and PNGs from `calendar/generated`. Nothing else under `calendar/` is public (templates, data JSON and generated HTML return 404).
  - Examples:
    - `curl http://localhost:3000/calendar-files/generated/calendar_04_2026.pdf --output calendar_04_2026.pdf`
    - `curl http://localhost:3000/calendar-files/generated/T4M-04-26.png --output T4M-04-26.png`

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

There are no send routes on the API server. Previews and the send log are operator commands run where the jobs run, so the public process never loads the send, Mailchimp or Castos code:

- `npm run sends:preview -- --date=2026-09-28 [--program=time4nach] [--channel=whatsapp] [--html=preview.html]`
- `npm run sends:log -- --date=2026-09-28`

See [docs/SENDING.md](docs/SENDING.md#previewing).
