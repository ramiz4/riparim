import {readFileSync} from 'node:fs';

const reviewedGroups=['workshop-removals.json','workshop-final-removals.json'].map(file=>JSON.parse(readFileSync(new URL('../../data/'+file,import.meta.url),'utf8')));
const relations=[['visits','workshop'],['workshop_claims','workshop_id'],['workshop_owners','workshop_id'],['workshop_changes','workshop_id']];
const noRelations=relations.map(([table,column])=>`NOT EXISTS (SELECT 1 FROM ${table} r WHERE r.${column}=w.id)`).join(' AND ');
const wanted="wanted AS (SELECT json_extract(value,'$.id') AS id,json_extract(value,'$.updatedAt') AS updated_at,json_extract(value,'$.placeId') AS place_id FROM json_each(?))";
const eligible=`w.status='draft' AND w.updated_at=t.updated_at AND (SELECT place_id FROM workshop_google_places g WHERE g.workshop_id=w.id) IS t.place_id AND ${noRelations}`;

// One atomic D1 batch: a stale, published, newly mapped or customer-linked target
// suppresses the whole removal; private relation tables are never written.
export function workshopRetirementBatch(targets,operationId,removedAt){
 const group=reviewedGroups.find(g=>g.workshopIds.length===targets.length&&g.workshopIds.every(id=>targets.some(t=>t.id===id)));
 if(!group||new Set(targets.map(t=>t.id)).size!==targets.length||targets.some(t=>!Number.isFinite(Date.parse(t.updatedAt))||(t.placeId??null)!==(group.confirmedPlaceIds?.[t.id]??null)))throw Error('Removal must cover exactly one reviewed draft group with its confirmed identities');
 if(!/^[a-zA-Z0-9-]{10,100}$/.test(operationId)||!Number.isFinite(Date.parse(removedAt)))throw Error('Invalid removal operation metadata');
 const input=JSON.stringify(targets),operationKey=`workshop-removal-run:${operationId}`;
 const operation="EXISTS (SELECT 1 FROM catalog_state WHERE key=? AND value=?)";
 const current=`EXISTS (SELECT 1 FROM workshops w JOIN wanted t ON t.id=w.id WHERE w.id=workshop_id AND ${eligible})`;
 return [
  {sql:`WITH ${wanted} INSERT OR IGNORE INTO catalog_state(key,value) SELECT ?,? WHERE (SELECT COUNT(*) FROM workshops w JOIN wanted t ON t.id=w.id WHERE ${eligible})=?`,params:[input,operationKey,removedAt,targets.length]},
  {sql:`WITH ${wanted} INSERT OR IGNORE INTO catalog_state(key,value) SELECT 'workshop-retired:'||id,? FROM wanted WHERE ${operation}`,params:[input,JSON.stringify({removedAt,operationId}),operationKey,removedAt]},
  {sql:`WITH ${wanted} DELETE FROM workshop_google_ratings WHERE workshop_id IN (SELECT id FROM wanted) AND ${operation} AND ${current}`,params:[input,operationKey,removedAt]},
  {sql:`WITH ${wanted} DELETE FROM workshop_google_places WHERE workshop_id IN (SELECT id FROM wanted) AND ${operation} AND ${current}`,params:[input,operationKey,removedAt]},
  {sql:`WITH ${wanted} DELETE FROM workshops WHERE id IN (SELECT id FROM wanted) AND ${operation} AND EXISTS (SELECT 1 FROM wanted t WHERE t.id=workshops.id AND t.updated_at=workshops.updated_at) AND status='draft' AND ${noRelations.replaceAll('w.id','workshops.id')}`,params:[input,operationKey,removedAt]}
 ];
}
