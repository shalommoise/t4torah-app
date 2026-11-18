-- send_log for Time4Tefilla (feature/time4tefilla). Run once on an existing
-- database (after 002_send_log_audience.sql):
--
--   mysql -u <user> -p <database> < db/migrations/003_send_log_time4tefilla.sql
--
-- A fresh database gets the same from db/setup.sql.
--
-- - adds 'time4tefilla' to the program ENUM;
-- - adds shiur_key, which identifies a Time4Tefilla shiur (its number, e.g.
--   '877', or its normalised title when it has none) and is '' for the daily
--   programs. It joins send_log_once, so two different shiurim can go out on
--   the same day;
-- - adds send_log_shiur_once on the generated shiur_key_unique (NULL when
--   shiur_key is ''), so the same shiur can't be claimed twice on any date,
--   while the daily programs' rows (all NULL) never collide on it.
--
-- Existing rows keep shiur_key = '', so their send_log_once keys are unchanged.

ALTER TABLE send_log
  MODIFY COLUMN program ENUM('time4mishna', 'time4nach', 'combined', 'time4tefilla') NOT NULL,
  ADD COLUMN shiur_key VARCHAR(191) NOT NULL DEFAULT '' AFTER audience;

ALTER TABLE send_log
  ADD COLUMN shiur_key_unique VARCHAR(191) AS (NULLIF(shiur_key, '')) STORED AFTER shiur_key;

ALTER TABLE send_log
  DROP INDEX send_log_once,
  ADD UNIQUE KEY send_log_once (send_date, program, channel, mode, audience, shiur_key),
  ADD UNIQUE KEY send_log_shiur_once (program, channel, mode, audience, shiur_key_unique);
