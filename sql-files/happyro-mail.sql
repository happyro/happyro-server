-- Mail delivery receipts owned by the HappyRO game database.
CREATE TABLE IF NOT EXISTS happyro_admin_mail_receipts (
 idempotency_key VARBINARY(64) NOT NULL PRIMARY KEY,
 request_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 mail_id BIGINT UNSIGNED NULL,
 created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB;
