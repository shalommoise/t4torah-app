-- DROP DATABASE IF EXISTS time4torah_db;
-- CREATE DATABASE time4torah_db;

CREATE TABLE dates_table (
    date_id INT NOT NULL AUTO_INCREMENT,
    gregorian_date VARCHAR(12) NOT NULL,
    hebrew_date VARCHAR(12),
    day_of_week INT NOT NULL,
    is_yom_tov BOOLEAN,
    PRIMARY KEY (date_id)
);

CREATE TABLE sedarim_table (
    seder_id INT NOT NULL AUTO_INCREMENT,
    seder_name VARCHAR(15) NOT NULL,
    alt_names VARCHAR(50),
    PRIMARY KEY (seder_id)
);

CREATE TABLE masechta_table (
    masechta_id INT NOT NULL AUTO_INCREMENT,
    masechta_name VARCHAR(20) NOT NULL,
    alt_names VARCHAR(100),
    seder_id INT,
    masechta_summary_sheet VARCHAR(50),
    PRIMARY KEY (masechta_id),
    FOREIGN KEY (seder_id) REFERENCES sedarim_table(seder_id)
);

CREATE TABLE mishnayos_table (
    mishna_id INT NOT NULL AUTO_INCREMENT,
    masechta_id INT,
    perek INT NOT NULL,
    mishna INT NOT NULL,
    mishna_text TEXT NOT NULL,
    PRIMARY KEY (mishna_id),
    FOREIGN KEY (masechta_id) REFERENCES masechta_table(masechta_id)
);

CREATE TABLE time4mishna_shiurim (
    time4mishna_shiur_id INT NOT NULL AUTO_INCREMENT,
    shiur_title VARCHAR(30) UNIQUE,
    PRIMARY KEY (time4mishna_shiur_id)
);
