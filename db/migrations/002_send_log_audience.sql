-- send_log audience (feature/in-app-scheduler). Run once on an existing
-- database, passing the Mailchimp audience ID that the existing live emails
-- went to (your real audience, i.e. MAILCHIMP_AUDIENCE_ID before any test):
--
--   mysql --init-command="SET @live_audience_id='<real audience id>'" \
--     -u <user> -p <database> < db/migrations/002_send_log_audience.sql
--
-- A fresh database gets the same from db/setup.sql.
--
-- Adds `audience` to the send_log key, so a send to a test audience no longer
-- marks the date as sent for the real audience (and vice versa). It is the
-- Mailchimp audience ID for an email send and '' when there is none
-- (WhatsApp, or a dry-run without Mailchimp config).

-- Stop before changing anything if there are live email rows and no
-- @live_audience_id: left as '', they would no longer block a resend to the
-- real audience. (The two-row subquery makes MySQL raise "Subquery returns
-- more than 1 row", which ends the script.)
SELECT IF(
  (@live_audience_id IS NULL OR @live_audience_id = '')
    AND EXISTS (SELECT 1 FROM send_log WHERE channel = 'email' AND mode = 'live'),
  (SELECT 'set @live_audience_id: see the top of this file' UNION ALL SELECT 'aborted'),
  'ok'
) AS live_audience_check;

ALTER TABLE send_log
  ADD COLUMN audience VARCHAR(64) NOT NULL DEFAULT '' AFTER mode,
  DROP INDEX send_log_once,
  ADD UNIQUE KEY send_log_once (send_date, program, channel, mode, audience);

-- Live emails have only ever gone to the real audience. Dry-run rows stay ''
-- (they never reached Mailchimp; at worst a dry-run repeats its outbox files).
UPDATE send_log
SET audience = TRIM(@live_audience_id)
WHERE channel = 'email' AND mode = 'live' AND audience = ''
  AND @live_audience_id IS NOT NULL AND TRIM(@live_audience_id) <> '';
