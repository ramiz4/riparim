CREATE TABLE `workshop_contact_details` (
	`workshop_id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`website` text NOT NULL,
	`source_urls` text NOT NULL,
	`checked_at` text NOT NULL,
	`matched_name` text NOT NULL,
	`matched_phone` text NOT NULL,
	`matched_city` text NOT NULL,
	`email_verification` text NOT NULL,
	FOREIGN KEY (`workshop_id`) REFERENCES `workshops`(`id`) ON UPDATE no action ON DELETE cascade
);
