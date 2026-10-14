import {createHash} from 'node:crypto';

export function csvRows(text){
 const rows=[];let row=[],value='',quoted=false;
 for(let i=0;i<text.length;i++){
  const c=text[i];
  if(c==='"'){if(quoted&&text[i+1]==='"'){value+='"';i++;}else quoted=!quoted;}
  else if(c===';'&&!quoted){row.push(value);value='';}
  else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(value);if(row.some(Boolean))rows.push(row);row=[];value='';}
  else value+=c;
 }
 if(quoted)throw Error('Unterminated CSV field');
 if(value||row.length){row.push(value);rows.push(row);}
 if(!rows.length||new Set(rows[0]).size!==rows[0].length||rows.some(r=>r.length!==rows[0].length))throw Error('Invalid CSV columns');
 return rows.slice(1).map(r=>Object.fromEntries(rows[0].map((key,i)=>[key,r[i]])));
}
const standard=['08:00-18:00','08:00-18:00','08:00-18:00','08:00-18:00','08:00-18:00','08:00-16:00','Geschlossen'];
export const weekdays=['Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag','Sonntag'];
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
export const unresearchedOpeningHoursReason='Nicht recherchiert – neuer Katalogeintrag';
export const openingHoursImportRevision=({records,excluded})=>hash({records,excluded});
export function prepareOpeningHoursImport(csv,catalogue,parseHours){
 const known=new Map(catalogue.workshops.map(w=>[w.id,w])),seen=new Set(),records=[],excluded=[];
 for(const row of csvRows(csv)){
  const id=row['Werkstatt-ID'],w=known.get(id);
  if(!w||seen.has(id))throw Error(`Unknown or duplicate workshop: ${id}`);
  seen.add(id);
  if(row.Name!==w.name||row.Ort!==w.city)throw Error(`Workshop identity changed: ${id}`);
  if(row['Zeitzone']!=='Europe/Belgrade'||!/^\d{4}-\d{2}-\d{2}$/.test(row['Geprüft am']))throw Error(`Invalid provenance: ${id}`);
  if(['Dauerhaft geschlossen laut Google Maps',unresearchedOpeningHoursReason].includes(row['Recherche-Status'])){excluded.push({id,reason:row['Recherche-Status']});continue;}
  const assume=row['Recherche-Status']==='Standardzeiten (angenommen)'||['Widersprüchliche Quellen','Älterer Standort – prüfen','Zuordnung geklärt – Zeiten abweichend'].includes(row['Recherche-Status']);
  const dayValues=assume?standard:weekdays.map(d=>row[d]);
  const week=dayValues.map(value=>value==='Geschlossen'?{mode:'closed'}:{mode:'open',intervals:value.split(',').map(interval=>{const match=/^(\d{2}:\d{2})-(\d{2}:\d{2})$/.exec(interval);if(!match)throw Error(`Invalid interval for ${id}`);return {start:match[1],end:match[2]};})});
  const hours=parseHours({week,exceptions:[]});
  records.push({id,expected:{name:w.name,city:w.city,address:w.address,phone:w.phone},hours,metadata:{kind:assume?'assumed':'researched',checkedAt:row['Geprüft am'],source:row['Öffnungszeiten-Quelle'],sourceName:row['Name in der Quelle'],researchStatus:row['Recherche-Status'],notes:row.Hinweise,originalWeek:weekdays.map(d=>row[d]),earlierPlan:row['Abweichender Quellenplan (Mo–So)']}});
 }
 if(seen.size!==known.size)throw Error('CSV does not cover the complete catalogue');
 records.sort((a,b)=>a.id.localeCompare(b.id));excluded.sort((a,b)=>a.id.localeCompare(b.id));
 return {schemaVersion:1,revision:openingHoursImportRevision({records,excluded}),records,excluded};
}
export function validateOpeningHoursImport(manifest,catalogue,parseHours){
 if(manifest.schemaVersion!==1||!Array.isArray(manifest.records)||!Array.isArray(manifest.excluded))throw Error('Invalid opening-hours manifest');
 const known=new Map(catalogue.workshops.map(w=>[w.id,w])),seen=new Set();
 for(const r of manifest.records){
  const w=known.get(r.id);if(!w||seen.has(r.id)||w.status!=='published')throw Error('Invalid workshop identity');seen.add(r.id);
  if(JSON.stringify(r.expected)!==JSON.stringify({name:w.name,city:w.city,address:w.address,phone:w.phone}))throw Error('Stale workshop identity');
  parseHours(r.hours);
  if(!['assumed','researched'].includes(r.metadata?.kind)||!/^\d{4}-\d{2}-\d{2}$/.test(r.metadata.checkedAt))throw Error('Invalid import provenance');
 }
 for(const r of manifest.excluded){if(!known.has(r.id)||seen.has(r.id)||!['Dauerhaft geschlossen laut Google Maps',unresearchedOpeningHoursReason].includes(r.reason))throw Error('Invalid excluded record');seen.add(r.id);}
 if(seen.size!==known.size||manifest.revision!==openingHoursImportRevision(manifest))throw Error('Incomplete or modified import');
 return manifest;
}
export function openingHoursImportQuery(manifest,now){
 // A single statement is atomic. A stale/missing identity violates the NOT NULL
 // suppression flag before any upsert commits, including on repeated imports.
 const payload=JSON.stringify(manifest.records);
 const sql=`WITH incoming AS (SELECT value AS item FROM json_each(?)), valid AS (SELECT i.item FROM incoming i JOIN workshops w ON w.id=json_extract(i.item,'$.id') AND w.status='published' AND w.name=json_extract(i.item,'$.expected.name') AND w.city=json_extract(i.item,'$.expected.city') AND w.address=json_extract(i.item,'$.expected.address') AND w.phone=json_extract(i.item,'$.expected.phone'))
 INSERT INTO workshop_opening_hours_imports(workshop_id,opening_hours,source_metadata,import_revision,imported_at,suppressed)
 SELECT json_extract(item,'$.id'),json_extract(item,'$.hours'),json_extract(item,'$.metadata'),?,?,CASE WHEN (SELECT count(*) FROM valid)=(SELECT count(*) FROM incoming) THEN 0 ELSE NULL END FROM incoming WHERE 1
 ON CONFLICT(workshop_id) DO UPDATE SET opening_hours=excluded.opening_hours,source_metadata=excluded.source_metadata,import_revision=excluded.import_revision,imported_at=excluded.imported_at WHERE workshop_opening_hours_imports.suppressed=0 AND workshop_opening_hours_imports.import_revision IS NOT excluded.import_revision`;
 return {sql,params:[payload,manifest.revision,now]};
}
