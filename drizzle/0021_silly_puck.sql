CREATE TABLE `workshop_opening_hours_imports` (
	`workshop_id` text PRIMARY KEY NOT NULL,
	`opening_hours` text,
	`source_metadata` text,
	`import_revision` text,
	`imported_at` text,
	`suppressed` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`workshop_id`) REFERENCES `workshops`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TRIGGER suppress_removed_owner_hours AFTER UPDATE OF opening_hours ON workshops
WHEN OLD.opening_hours IS NOT NULL AND NEW.opening_hours IS NULL
BEGIN
 INSERT INTO workshop_opening_hours_imports(workshop_id,suppressed) VALUES(NEW.id,1)
 ON CONFLICT(workshop_id) DO UPDATE SET suppressed=1;
END;
