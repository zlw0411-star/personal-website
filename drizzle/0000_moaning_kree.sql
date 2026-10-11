CREATE TABLE `entries` (
	`id` text PRIMARY KEY NOT NULL,
	`category` text NOT NULL,
	`title` text NOT NULL,
	`summary` text NOT NULL,
	`body` text NOT NULL,
	`cover_id` text,
	`status` text NOT NULL,
	`visibility` text NOT NULL,
	`project_url` text DEFAULT '' NOT NULL,
	`repository_url` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`published_at` text
);
--> statement-breakpoint
CREATE TABLE `entry_media` (
	`entry_id` text NOT NULL,
	`media_id` text NOT NULL,
	PRIMARY KEY(`entry_id`, `media_id`),
	FOREIGN KEY (`entry_id`) REFERENCES `entries`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`media_id`) REFERENCES `media`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `media` (
	`id` text PRIMARY KEY NOT NULL,
	`object_key` text NOT NULL,
	`mime_type` text NOT NULL,
	`size` integer NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `media_object_key_unique` ON `media` (`object_key`);--> statement-breakpoint
CREATE TABLE `profile` (
	`id` integer PRIMARY KEY NOT NULL,
	`site_name` text NOT NULL,
	`nickname` text NOT NULL,
	`bio` text NOT NULL,
	`about` text NOT NULL,
	`experience` text NOT NULL,
	`avatar_id` text,
	`email` text NOT NULL,
	`links` text NOT NULL
);
