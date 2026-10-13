ALTER TABLE `visits` ADD `services` text;
--> statement-breakpoint
UPDATE visits SET services=json_array(service) WHERE services IS NULL;
