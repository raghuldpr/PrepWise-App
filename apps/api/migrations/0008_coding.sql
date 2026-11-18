CREATE TABLE `coding_submissions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`problem_id` text NOT NULL,
	`language` text NOT NULL,
	`verdict` text NOT NULL,
	`passed` integer NOT NULL,
	`total` integer NOT NULL,
	`time_ms` integer DEFAULT 0 NOT NULL,
	`code` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `coding_user_problem_idx` ON `coding_submissions` (`user_id`,`problem_id`,`created_at`);