import { createHash } from "node:crypto";

export const workshopEmailRevision = (manifest) =>
  createHash("sha256").update(JSON.stringify(manifest)).digest("hex");
export function workshopEmailImportQuery(
  manifest,
  revision = workshopEmailRevision(manifest),
  now = new Date().toISOString(),
) {
  if (revision !== workshopEmailRevision(manifest))
    throw Error("Email import revision differs from its immutable content");
  // D1 batch and the local transaction commit revision and address rows together.
  // A NOT NULL guard also validates an entirely empty research manifest.
  const guard = `INSERT INTO workshop_email_imports(revision,applied_at)
 SELECT ?,CASE WHEN NOT EXISTS (SELECT 1 FROM json_each(?,'$.contacts') c LEFT JOIN workshops w ON w.id=json_extract(c.value,'$.workshopId') WHERE w.id IS NULL OR w.status<>'published' OR w.name<>json_extract(c.value,'$.matchedName') OR w.phone<>json_extract(c.value,'$.matchedPhone') OR w.city<>json_extract(c.value,'$.matchedCity')) THEN ? ELSE NULL END
 ON CONFLICT(revision) DO NOTHING`;
  const sql = `WITH contacts AS (SELECT value AS contact FROM json_each(?,'$.contacts')),
 incoming AS (SELECT contact,e.value AS email,CAST(e.key AS INTEGER) AS position FROM contacts,json_each(contact,'$.emails') e),
 valid AS (SELECT c.contact FROM contacts c JOIN workshops w ON w.id=json_extract(c.contact,'$.workshopId') AND w.status='published' AND w.name=json_extract(c.contact,'$.matchedName') AND w.phone=json_extract(c.contact,'$.matchedPhone') AND w.city=json_extract(c.contact,'$.matchedCity'))
 INSERT INTO workshop_email_addresses(workshop_id,email_key,email,source_urls,checked_at,position,matched_name,matched_phone,matched_city,import_revision)
 SELECT json_extract(contact,'$.workshopId'),CASE WHEN (SELECT count(*) FROM valid)=(SELECT count(*) FROM contacts) THEN lower(json_extract(email,'$.address')) ELSE NULL END,
 json_extract(email,'$.address'),json_extract(email,'$.sourceUrls'),json_extract(email,'$.checkedAt'),position,json_extract(contact,'$.matchedName'),json_extract(contact,'$.matchedPhone'),json_extract(contact,'$.matchedCity'),? FROM incoming WHERE 1
 ON CONFLICT(workshop_id,email_key) DO UPDATE SET email=excluded.email,source_urls=excluded.source_urls,checked_at=excluded.checked_at,position=excluded.position,matched_name=excluded.matched_name,matched_phone=excluded.matched_phone,matched_city=excluded.matched_city,import_revision=excluded.import_revision
 WHERE workshop_email_addresses.checked_at < excluded.checked_at AND workshop_email_addresses.import_revision<>excluded.import_revision`;
  return {
    batch: [
      { sql: guard, params: [revision, JSON.stringify(manifest), now] },
      { sql, params: [JSON.stringify(manifest), revision] },
    ],
  };
}
