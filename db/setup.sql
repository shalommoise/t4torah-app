DROP DATABASE IF EXISTS time4torah_db;
CREATE DATABASE time4torah_db;
USE time4torah_db;
CREATE TABLE dates_table (
    date_id INT NOT NULL AUTO_INCREMENT,
    gregorian_date VARCHAR(12) NOT NULL,
    hebrew_date VARCHAR(30),
    hebrew_date_he VARCHAR(30),
    day_of_week VARCHAR(12),
    is_yom_tov BOOLEAN,
    special_date VARCHAR(150),
    PRIMARY KEY (date_id)
);

CREATE TABLE sedarim_table (
    seder_id INT NOT NULL AUTO_INCREMENT,
    seder_name VARCHAR(15) NOT NULL UNIQUE,
    alt_names VARCHAR(50),
    PRIMARY KEY (seder_id)
);

CREATE TABLE masechta_table (
    masechta_id INT NOT NULL AUTO_INCREMENT,
    masechta_name VARCHAR(20) NOT NULL UNIQUE,
    alt_names VARCHAR(100),
    number_of_perakim INT NOT NULL,
    number_of_mishnayos INT NOT NULL,
    seder_id INT,
    PRIMARY KEY (masechta_id),
    FOREIGN KEY (seder_id) REFERENCES sedarim_table(seder_id)
);

CREATE TABLE mishnayos_table (
    mishna_id INT NOT NULL AUTO_INCREMENT,
    masechta_id INT,
    perek INT NOT NULL,
    mishna INT NOT NULL,
    mishna_text TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
    PRIMARY KEY (mishna_id),
    FOREIGN KEY (masechta_id) REFERENCES masechta_table(masechta_id)
) CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE tanach_table (
    sefer_id INT NOT NULL AUTO_INCREMENT,
    sefer_name VARCHAR(50) NOT NULL,
    sefer_name_he VARCHAR(50) NOT NULL,
    sefer_alt_name VARCHAR(50) NOT NULL,
    sefer_chapter_count INT NOT NULL,
    section ENUM('Torah',"Nevi'im",'Kesuvim') NOT NULL,
    section_he ENUM('תורה','נביאים','כתובים') NOT NULL,
    subsection ENUM(
        "Nevi'im Rishonim",
        "Nevi'im Acharonim",
        "Trei Asar",
        "Nevi'im Acharonim - Trei Asar",
        "Megilos"
    ) NULL,
    subsection_he ENUM(
        'נביאים ראשונים',
        'נביאים אחרונים',
        'תרי עשר',
        'נביאים אחרונים - תריסר',
        'מגילות'
    ) NULL,

    PRIMARY KEY (sefer_id)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;


CREATE TABLE time4mishna_shiurim (
    time4mishna_shiur_id INT NOT NULL AUTO_INCREMENT,
    shiur_title VARCHAR(40) UNIQUE,
    start_mishna INT,
    end_mishna INT,
    PRIMARY KEY (time4mishna_shiur_id),
    FOREIGN KEY (start_mishna) REFERENCES mishnayos_table(mishna_id),
    FOREIGN KEY (end_mishna) REFERENCES mishnayos_table(mishna_id)
);

CREATE TABLE time4mishna_daily_schedule (
  daily_schedule_id INT NOT NULL AUTO_INCREMENT,
  shiur_type VARCHAR(25),
  time4mishna_shiur_id INT,
  date_id INT NOT NULL,
  additional_notice VARCHAR(255),
  PRIMARY KEY (daily_schedule_id),
  FOREIGN KEY (time4mishna_shiur_id) REFERENCES time4mishna_shiurim(time4mishna_shiur_id),
  FOREIGN KEY (date_id) REFERENCES dates_table(date_id)
); 

CREATE TABLE time4nach_shiurim (
    time4nach_shiur_id INT NOT NULL AUTO_INCREMENT,
    shiur_title VARCHAR(50) UNIQUE,
    sefer_id INT NOT NULL,
    perek INT NOT NULL,
    -- text_he TEXT  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
    -- text_eng TEXT, 
    PRIMARY KEY (time4nach_shiur_id),
    FOREIGN KEY (sefer_id) REFERENCES tanach_table(sefer_id)
)
-- CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
;

CREATE TABLE time4nach_daily_schedule (
  daily_schedule_id INT NOT NULL AUTO_INCREMENT,
  shiur_type VARCHAR(25),
  time4nach_shiur_id INT,
  date_id INT NOT NULL,
  additional_notice VARCHAR(255),
  PRIMARY KEY (daily_schedule_id),
  FOREIGN KEY (time4nach_shiur_id) REFERENCES time4nach_shiurim(time4nach_shiur_id),
  FOREIGN KEY (date_id) REFERENCES dates_table(date_id)
); 

-- Daily send automation (feature/send-automation, backlog D2).
-- One row per send attempt per date/program/channel/mode; a 'sent' row makes
-- later runs skip that combination unless forced.
CREATE TABLE send_log (
  send_log_id INT NOT NULL AUTO_INCREMENT,
  send_date VARCHAR(12) NOT NULL,
  program ENUM('time4mishna', 'time4nach', 'combined') NOT NULL,
  channel ENUM('email', 'whatsapp') NOT NULL,
  mode ENUM('dry-run', 'live') NOT NULL,
  status ENUM('sent', 'failed') NOT NULL,
  provider_message_id VARCHAR(255),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (send_log_id),
  INDEX send_log_lookup (send_date, program, channel, mode)
);
