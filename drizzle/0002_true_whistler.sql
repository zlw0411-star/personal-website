CREATE TABLE `admin_security` (
	`id` integer PRIMARY KEY NOT NULL,
	`password_hash` text NOT NULL,
	`salt` text NOT NULL,
	`algorithm` text NOT NULL,
	`version` text NOT NULL,
	`failed_attempts` integer DEFAULT 0 NOT NULL,
	`locked_until` text
);
--> statement-breakpoint
CREATE TABLE `admin_sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`version` text NOT NULL,
	`expires_at` text NOT NULL
);
--> statement-breakpoint
INSERT INTO admin_security (id, password_hash, salt, algorithm, version, failed_attempts, locked_until)
SELECT 1, password_hash, salt, algorithm, lower(hex(randomblob(16))), 0, NULL
FROM life_security WHERE id = 1;
