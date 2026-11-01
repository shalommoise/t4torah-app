-- Summary sheets (feature/summary-sheets). Run once on an existing database:
--   mysql -u <user> -p <database> < db/migrations/001_summary_sheets.sql
-- A fresh database gets the same from db/setup.sql.

-- One row per summary/diagram PDF in the bucket, covering the mishnayos
-- start_mishna..end_mishna (mishna_id is in learning order, so a range can
-- cross perakim). Several files on the same range are ordered by `part`.
-- bucket_key is derived from masechta, kind, range and part, so re-importing
-- the same inventory row updates it instead of adding a duplicate.
CREATE TABLE summary_sheets (
  summary_sheet_id INT NOT NULL AUTO_INCREMENT,
  kind ENUM('summary', 'diagram', 'chart', 'overview', 'key_terms', 'cover', 'mikra', 'test', 'back_matter') NOT NULL,
  start_mishna INT NOT NULL,
  end_mishna INT NOT NULL,
  part INT NOT NULL DEFAULT 1,
  bucket_key VARCHAR(255) NOT NULL,
  source_ref VARCHAR(500),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (summary_sheet_id),
  UNIQUE KEY summary_sheets_bucket_key (bucket_key),
  KEY summary_sheets_range (start_mishna, end_mishna),
  FOREIGN KEY (start_mishna) REFERENCES mishnayos_table(mishna_id),
  FOREIGN KEY (end_mishna) REFERENCES mishnayos_table(mishna_id)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- To-do flag: this mishna should have a diagram. Whether one exists is a
-- summary_sheets row with kind = 'diagram'; this only marks what's wanted.
ALTER TABLE mishnayos_table ADD COLUMN needs_diagram BOOLEAN NOT NULL DEFAULT FALSE;
