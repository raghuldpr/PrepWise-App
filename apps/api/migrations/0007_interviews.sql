CREATE TABLE `interviews` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`interview_type` text NOT NULL,
	`target_role` text NOT NULL,
	`role_id` text,
	`company_name` text,
	`difficulty` text DEFAULT 'MEDIUM' NOT NULL,
	`question_count` integer NOT NULL,
	`status` text DEFAULT 'IN_PROGRESS' NOT NULL,
	`plan_json` text NOT NULL,
	`answers_json` text DEFAULT '[]' NOT NULL,
	`report_json` text,
	`overall_score` integer,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`completed_at` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `interviews_user_idx` ON `interviews` (`user_id`,`created_at`);