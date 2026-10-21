-- HappyRO administration jobs, consumed by char-server.
CREATE TABLE IF NOT EXISTS happyro_admin_workers (
 worker_name VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
 heartbeat_at DATETIME(6) NOT NULL
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS happyro_admin_account_deletions (
 account_id INT UNSIGNED PRIMARY KEY,
 requested_by BIGINT UNSIGNED NOT NULL,
 requested_username VARCHAR(64) NOT NULL,
 account_name VARCHAR(23) NOT NULL,
 status ENUM('queued','disconnecting','deleting','failed','completed') NOT NULL DEFAULT 'queued',
 error_code VARCHAR(64) NULL,
 total_characters INT UNSIGNED NOT NULL DEFAULT 0,
 deleted_characters INT UNSIGNED NOT NULL DEFAULT 0,
 created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
 completed_at DATETIME(6) NULL,
 INDEX deletion_queue (status,updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
