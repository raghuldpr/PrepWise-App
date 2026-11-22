CREATE TABLE `ai_provider_state` (
	`provider` text PRIMARY KEY NOT NULL,
	`blocked_until` text NOT NULL,
	`reason` text,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `ai_site_usage` (
	`day` text PRIMARY KEY NOT NULL,
	`count` integer DEFAULT 0 NOT NULL
);
