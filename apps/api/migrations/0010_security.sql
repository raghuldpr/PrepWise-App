ALTER TABLE `users` ADD `failed_logins` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `locked_until` text;--> statement-breakpoint
ALTER TABLE `users` ADD `session_version` integer DEFAULT 1 NOT NULL;