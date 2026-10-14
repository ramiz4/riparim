import type { SqlDatabase } from "@/lib/runtime/contracts";
import type { WorkshopEmailContacts } from "@/lib/workshop-contacts";

export function workshopEmailImportStatements(
  db: SqlDatabase,
  contacts: WorkshopEmailContacts["contacts"],
  revision: string,
) {
  return contacts.flatMap((contact) =>
    contact.emails.map((email, position) =>
      db
        .prepare(
          `INSERT INTO workshop_email_addresses
  (workshop_id,email_key,email,source_urls,checked_at,position,matched_name,matched_phone,matched_city,import_revision)
  SELECT id,?,?,?,?,?,?,?,?,? FROM workshops WHERE id=? AND name=? AND phone=? AND city=? AND status='published'
  ON CONFLICT(workshop_id,email_key) DO UPDATE SET email=excluded.email,source_urls=excluded.source_urls,checked_at=excluded.checked_at,position=excluded.position,
   matched_name=excluded.matched_name,matched_phone=excluded.matched_phone,matched_city=excluded.matched_city,import_revision=excluded.import_revision
  WHERE workshop_email_addresses.checked_at < excluded.checked_at`,
        )
        .bind(
          email.address.toLowerCase(),
          email.address,
          JSON.stringify(email.sourceUrls),
          email.checkedAt,
          position,
          contact.matchedName,
          contact.matchedPhone,
          contact.matchedCity,
          revision,
          contact.workshopId,
          contact.matchedName,
          contact.matchedPhone,
          contact.matchedCity,
        ),
    ),
  );
}
