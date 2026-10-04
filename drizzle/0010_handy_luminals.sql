CREATE TABLE `evidence_uploads` (
	`file_key` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_evidence_uploads_owner` ON `evidence_uploads` (`owner`);