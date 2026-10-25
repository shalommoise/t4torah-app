# Mailchimp Controller: Implementation Plan

## Goal

Build a controller in the t4torah-app codebase that sends the daily Time4Mishna / Time4Nach email to the existing Mailchimp audience, Sunday to Friday, with no manual steps. Content comes from the existing structured database. Mailchimp stays the email provider for now, so the subscriber list does not move.

Out of scope: WhatsApp sending (separate tool, per the overview), changes to the content database schema, and migrating to another ESP.

## Assumptions to confirm

- Unsubscribed contacts are never sent to. Mailchimp only delivers to subscribed members of the audience, so the job targets the audience ID and does not filter by segment. Do not send to any member whose status is not subscribed.

- Sends run once per day, Sunday to Friday, at 05:15 London time, all year (follows British Summer Time).
- Each subscriber receives one email per day.
- Volume is about 2,000 to 3,000 contacts, so roughly 52,000 to 78,000 sends a month.
- Mailchimp audience ID and API key are available. The API key includes a server prefix (e.g. `us21`) used in the base URL.

## Configuration

Store these in the env file. Do not commit it. Confirm `.env` is in `.gitignore`.

| Variable | Purpose |
|---|---|
| `MAILCHIMP_API_KEY` | API key, including the server prefix |
| `MAILCHIMP_SERVER_PREFIX` | Derived from the key, or set explicitly (e.g. `us21`) |
| `MAILCHIMP_AUDIENCE_ID` | The existing audience (list) ID to send to |
| `MAILCHIMP_FROM_NAME` | Sender name shown to subscribers |
| `MAILCHIMP_REPLY_TO` | Reply-to address |
| `MAILCHIMP_TEMPLATE_ID` | Saved Mailchimp template used for layout (required) |
| `SEND_TIME` | `05:15` (London time) |
| `SEND_TIMEZONE` | `Europe/London` |

Load and validate these at startup. Fail fast with a clear error if any required variable is missing.

## Mailchimp API calls

Per daily send:

1. **Create campaign**: `POST /3.0/campaigns`. Set type `regular`, the audience ID, from name, reply-to, and the subject line.
2. **Set content**: `PUT /3.0/campaigns/{campaign_id}/content`. Use the saved Mailchimp template (`MAILCHIMP_TEMPLATE_ID`) and pass the day's database content into it as the template's content sections.
3. **Schedule or send**: `POST /3.0/campaigns/{campaign_id}/actions/schedule` with the send time, or `actions/send` for an immediate send. Scheduling is preferred so the send time is explicit.
4. **Check status**: `GET /3.0/campaigns/{campaign_id}` to confirm the status moved to `schedule` or `sent`.

Subject line: include the special date when there is one, per the existing decision.

## Content rules (carry over from existing decisions)

- No external links to Sefaria in daily messages.
- URLs in special dates or notices are stripped silently, not the whole notice.
- Email subject includes the special date when applicable.
- The WhatsApp formatting strip (`* _ ~ \``) applies only to WhatsApp output, not email.

## Scheduling

- A single daily job queries the content database for that day's Time4Mishna entries. Time4Nach is out of scope for now.
- It runs Sunday to Friday only. Skip Saturday (Shabbat).
- Yom tov is `dates_table.is_yom_tov` (BOOLEAN), reached via `date_id`. If it is true for that day, the job does not create or schedule a campaign, and logs the skip.
- Day lookup: `dates_table.gregorian_date` is a `VARCHAR(12)`. Store and match dates as ISO `YYYY-MM-DD` (e.g. `2026-10-19`). This fits the column, sorts correctly, and avoids day/month ambiguity. Validate the format on insert.
- Special dates: `dates_table.special_date` (VARCHAR(150)) feeds the subject line and any notice.
- Run the job a fixed time before the 05:15 London send, so there is room to fail and retry.

## Error handling and observability

- Retry transient failures (HTTP 429 and 5xx) with exponential backoff, a small fixed number of times.
- Duplicate protection uses the existing `send_log` table, which has a unique key on (send_date, program, channel, mode). The job first inserts a `claimed` row; a duplicate-key error means it has already been claimed and the job stops. On success it sets `sent` and stores `provider_message_id` (the Mailchimp campaign ID). On failure it sets `failed`, and only a `failed` row can be re-claimed.
- A row left `claimed` after a crash is never resent automatically. It is flagged for manual review.
- For the Mailchimp send, use one `send_log` row per date with program `time4mishna` and channel `email`. Use mode `dry-run` for dry runs and `live` for real sends.
- Log each run with date, campaign ID, status, recipient count, and any error.
- Alert on failure by email so a missed send is noticed the same day.
- Provide a dry-run mode that builds the campaign and content but does not schedule or send.

## Testing

- Unit tests (Jest, per the existing backend stack) for the content builder, link stripping, subject generation, and the day-of-week and holiday skip logic.
- Mock the Mailchimp client in unit tests. Do not call the live API from tests.
- One manual end-to-end run to a test audience or to yourself, using dry-run first.

## Tasks

1. Add config loading and validation for the env variables.
2. Build a thin Mailchimp client wrapper for the four endpoints above, with retry logic.
3. Build the content builder from the database query output (HTML generation, link stripping, subject line).
4. Build the daily job: day/holiday check, create campaign, set content, schedule, verify status.
5. Add logging and failure alerts.
6. Add dry-run mode.
7. Write unit tests for the pure logic.
8. Run an end-to-end dry run, then a live test send to a test audience.
9. Schedule the daily job (cron or host scheduler) for Sunday to Friday.

## Open questions

- Recipient address for failure alerts.