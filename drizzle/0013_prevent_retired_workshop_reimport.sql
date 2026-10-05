-- Retirements remain effective when an older release repeats its catalogue seed.
-- Only explicitly retired IDs are ignored; other inserts and edits are unchanged.
CREATE TRIGGER `workshops_ignore_retired_insert`
BEFORE INSERT ON `workshops`
WHEN EXISTS (
  SELECT 1 FROM `catalog_state`
  WHERE `key` = 'workshop-retired:' || NEW.id
)
BEGIN
  SELECT RAISE(IGNORE);
END;
--> statement-breakpoint
CREATE TRIGGER `workshop_google_places_ignore_retired_insert`
BEFORE INSERT ON `workshop_google_places`
WHEN EXISTS (
  SELECT 1 FROM `catalog_state`
  WHERE `key` = 'workshop-retired:' || NEW.workshop_id
)
BEGIN
  SELECT RAISE(IGNORE);
END;
--> statement-breakpoint
CREATE TRIGGER `workshop_google_ratings_ignore_retired_insert`
BEFORE INSERT ON `workshop_google_ratings`
WHEN EXISTS (
  SELECT 1 FROM `catalog_state`
  WHERE `key` = 'workshop-retired:' || NEW.workshop_id
)
BEGIN
  SELECT RAISE(IGNORE);
END;
