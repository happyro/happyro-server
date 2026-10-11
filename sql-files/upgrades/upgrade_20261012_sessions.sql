-- HappyRO resumable game sessions. Tokens and tickets are stored only as hashes.
CREATE TABLE IF NOT EXISTS `happyro_sessions` (
  `token_hash` varbinary(64) NOT NULL,
  `account_id` int unsigned NOT NULL,
  `password_hash` varbinary(64) NOT NULL,
  `persistent` tinyint unsigned NOT NULL DEFAULT 0,
  `expires` bigint unsigned NOT NULL,
  `ticket_hash` varbinary(64) DEFAULT NULL,
  `ticket_expires` bigint unsigned NOT NULL DEFAULT 0,
  PRIMARY KEY (`token_hash`),
  KEY `account_id` (`account_id`),
  KEY `expires` (`expires`),
  UNIQUE KEY `ticket_hash` (`ticket_hash`)
) ENGINE=InnoDB;

-- Revoke immediately, including if a password or ban is later changed back.
DROP TRIGGER IF EXISTS `happyro_revoke_sessions`;
DELIMITER $$
CREATE TRIGGER `happyro_revoke_sessions` AFTER UPDATE ON `login` FOR EACH ROW
BEGIN
  IF NOT (NEW.user_pass <=> OLD.user_pass) OR NEW.state <> OLD.state
     OR NEW.unban_time > OLD.unban_time OR NEW.expiration_time <> OLD.expiration_time THEN
    DELETE FROM happyro_sessions WHERE account_id=NEW.account_id;
  END IF;
END$$
DELIMITER ;
