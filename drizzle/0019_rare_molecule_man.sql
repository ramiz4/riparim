CREATE TABLE `workshop_premium` (
	`workshop_id` text PRIMARY KEY NOT NULL,
	`active` integer DEFAULT 0 NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`workshop_id`) REFERENCES `workshops`(`id`) ON UPDATE no action ON DELETE cascade
);
