-- Resolve duplicate login.userid values before applying this constraint.
-- Never rename or delete accounts automatically during schema initialization.
ALTER TABLE login ADD UNIQUE KEY happyro_account_username (userid);
