CREATE TABLE `auth_identities` (
	`provider` text NOT NULL,
	`issuer` text NOT NULL,
	`subject` text NOT NULL,
	`account_id` text NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`provider`, `issuer`, `subject`)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_auth_identity_account` ON `auth_identities` (`account_id`,`provider`,`issuer`);--> statement-breakpoint
ALTER TABLE `auth_account_deletions` ADD `identity_issuer` text;--> statement-breakpoint
ALTER TABLE `auth_sessions` ADD `identity_provider` text;--> statement-breakpoint
ALTER TABLE `auth_sessions` ADD `identity_issuer` text;--> statement-breakpoint
ALTER TABLE `auth_sessions` ADD `identity_subject` text;
--> statement-breakpoint
-- Preserve every historical key as an opaque internal account ID. The parser
-- is confined to this one-time compatibility backfill; ownership is unchanged.
-- A fixed backfill marker keeps upgrades of old export snapshots deterministic.
INSERT OR IGNORE INTO auth_identities (provider,issuer,subject,account_id,created_at)
SELECT 'supabase','https://' || substr(tail,1,instr(tail,':')-1),substr(tail,instr(tail,':')+1),account_id,'2026-10-11T00:00:00.000Z'
FROM (
 SELECT account_id,substr(account_id,10) AS tail FROM (
  SELECT account_id FROM (
   SELECT owner AS account_id FROM visits
   UNION SELECT moderated_by AS account_id FROM visits
   UNION SELECT account_id AS account_id FROM auth_links
   UNION SELECT account_id AS account_id FROM auth_sessions
  )
  UNION
  SELECT account_id FROM (
   SELECT account_id AS account_id FROM auth_account_status
   UNION SELECT account_id AS account_id FROM auth_account_roles
   UNION SELECT assigned_by AS account_id FROM auth_account_roles
   UNION SELECT account_id AS account_id FROM auth_account_deletions
  )
  UNION
  SELECT account_id FROM (
   SELECT owner AS account_id FROM evidence_uploads
   UNION SELECT owner AS account_id FROM workshop_claims
   UNION SELECT moderated_by AS account_id FROM workshop_claims
   UNION SELECT account_id AS account_id FROM workshop_owners
  )
  UNION
  SELECT account_id FROM (
   SELECT confirmed_by AS account_id FROM workshop_owners
   UNION SELECT owner AS account_id FROM workshop_changes
   UNION SELECT moderated_by AS account_id FROM workshop_changes
   UNION SELECT owner AS account_id FROM review_notifications
  )
 ) WHERE account_id LIKE 'supabase:%'
) WHERE instr(tail,':')>1 AND length(substr(tail,instr(tail,':')+1))=36;
--> statement-breakpoint
UPDATE auth_account_deletions SET identity_issuer=(SELECT issuer FROM auth_identities WHERE auth_identities.account_id=auth_account_deletions.account_id AND provider='supabase' AND subject=auth_account_deletions.user_id);
