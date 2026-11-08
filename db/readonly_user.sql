-- Read-only MySQL user for the public API server (src/server.js).
--
-- Apply by hand as a MySQL admin; the app never runs this file.
-- 1. Replace <strong-password> with a long random value (e.g. `openssl rand -hex 24`).
-- 2. Narrow the host ('%') to the address the API server connects from, if you can.
-- 3. Put the same user and password in the server's DATABASE_READ_USER and
--    DATABASE_READ_PASSWORD. Jobs keep using DATABASE_USER, which can write.

CREATE USER IF NOT EXISTS 't4torah_read'@'%' IDENTIFIED BY '<strong-password>';
GRANT SELECT ON time4torah_db.* TO 't4torah_read'@'%';

-- Check: should list only USAGE and SELECT.
SHOW GRANTS FOR 't4torah_read'@'%';
