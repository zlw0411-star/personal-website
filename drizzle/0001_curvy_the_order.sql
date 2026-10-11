CREATE TABLE `life_security` (
	`id` integer PRIMARY KEY NOT NULL,
	`password_hash` text NOT NULL,
	`salt` text NOT NULL,
	`algorithm` text NOT NULL,
	`version` text NOT NULL,
	`failed_attempts` integer DEFAULT 0 NOT NULL,
	`locked_until` text
);
--> statement-breakpoint
CREATE TABLE `life_sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`version` text NOT NULL,
	`expires_at` text NOT NULL
);
--> statement-breakpoint
UPDATE entries SET category = 'learning' WHERE category = 'project';
--> statement-breakpoint
UPDATE entries SET visibility = 'private' WHERE category = 'life';
