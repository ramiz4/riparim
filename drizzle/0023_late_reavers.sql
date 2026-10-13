CREATE TABLE `workshop_email_addresses` (
	`workshop_id` text NOT NULL,
	`email_key` text NOT NULL,
	`email` text NOT NULL,
	`source_urls` text NOT NULL,
	`checked_at` text NOT NULL,
	`position` integer NOT NULL,
	`matched_name` text NOT NULL,
	`matched_phone` text NOT NULL,
	`matched_city` text NOT NULL,
	`import_revision` text NOT NULL,
	PRIMARY KEY(`workshop_id`, `email_key`),
	FOREIGN KEY (`workshop_id`) REFERENCES `workshops`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `workshops` ADD `editorial_emails` text;
--> statement-breakpoint
INSERT INTO workshop_email_addresses (workshop_id,email_key,email,source_urls,checked_at,position,matched_name,matched_phone,matched_city,import_revision)
SELECT workshop_id,lower(trim(email)),trim(email),source_urls,checked_at,0,matched_name,matched_phone,matched_city,'legacy-contact-migration' FROM workshop_contact_details;

--> statement-breakpoint
CREATE TRIGGER workshop_email_address_limit BEFORE INSERT ON workshop_email_addresses
WHEN NOT EXISTS (SELECT 1 FROM workshop_email_addresses WHERE workshop_id=NEW.workshop_id AND email_key=NEW.email_key)
 AND (SELECT count(*) FROM workshop_email_addresses WHERE workshop_id=NEW.workshop_id)>=10
BEGIN SELECT RAISE(ABORT,'workshop_email_address_limit'); END;
