export function openingHoursImportQuery(
  manifest,
  now = null,
  { matchedProfilesOnly = false } = {},
) {
  // Standalone imports reject every stale identity atomically. Catalogue seeds
  // instead leave newer/draft profiles alone and write only matching identities.
  const payload = JSON.stringify(manifest.records);
  const source = matchedProfilesOnly ? "valid" : "incoming";
  const suppression = matchedProfilesOnly
    ? "0"
    : "CASE WHEN (SELECT count(*) FROM valid)=(SELECT count(*) FROM incoming) THEN 0 ELSE NULL END";
  const sql = `WITH incoming AS (SELECT value AS item FROM json_each(?)), valid AS (SELECT i.item FROM incoming i JOIN workshops w ON w.id=json_extract(i.item,'$.id') AND w.status='published' AND w.name=json_extract(i.item,'$.expected.name') AND w.city=json_extract(i.item,'$.expected.city') AND w.address=json_extract(i.item,'$.expected.address') AND w.phone=json_extract(i.item,'$.expected.phone'))
 INSERT INTO workshop_opening_hours_imports(workshop_id,opening_hours,source_metadata,import_revision,imported_at,suppressed)
 SELECT json_extract(item,'$.id'),json_extract(item,'$.hours'),json_extract(item,'$.metadata'),?,COALESCE(?,strftime('%Y-%m-%dT%H:%M:%fZ','now')),${suppression} FROM ${source} WHERE 1
 ON CONFLICT(workshop_id) DO UPDATE SET opening_hours=excluded.opening_hours,source_metadata=excluded.source_metadata,import_revision=excluded.import_revision,imported_at=excluded.imported_at WHERE workshop_opening_hours_imports.suppressed=0 AND workshop_opening_hours_imports.import_revision IS NOT excluded.import_revision AND COALESCE(json_extract(workshop_opening_hours_imports.source_metadata,'$.checkedAt'),'') <= json_extract(excluded.source_metadata,'$.checkedAt') AND (workshop_opening_hours_imports.opening_hours IS NOT excluded.opening_hours OR COALESCE(json_extract(workshop_opening_hours_imports.source_metadata,'$.checkedAt'),'') < json_extract(excluded.source_metadata,'$.checkedAt'))`;
  return { sql, params: [payload, manifest.revision, now] };
}

export function openingHoursImportQueries(manifest, now = null) {
  // Released SQL embeds the JSON payload: keep each statement bounded while
  // preserving newer/draft profiles, just like catalogue contact imports.
  // Standalone imports retain the stricter all-identities-must-match contract.
  const queries = [];
  for (let start = 0; start < manifest.records.length; start += 10)
    queries.push(
      openingHoursImportQuery(
        { ...manifest, records: manifest.records.slice(start, start + 10) },
        now,
        { matchedProfilesOnly: true },
      ),
    );
  return queries;
}
