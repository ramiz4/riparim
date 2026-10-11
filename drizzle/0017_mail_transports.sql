ALTER TABLE `review_notifications` ADD `transport` text;--> statement-breakpoint
ALTER TABLE `review_notifications` ADD `wire_payload` text;--> statement-breakpoint
ALTER TABLE `review_notifications` ADD `smtp_in_flight` integer DEFAULT 0 NOT NULL;