import {readFileSync} from 'node:fs';

const allowedIds=new Set(JSON.parse(readFileSync(new URL('../../data/workshop-removals.json',import.meta.url),'utf8')).workshopIds);
const relations=[['visits','workshop'],['workshop_claims','workshop_id'],['workshop_owners','workshop_id'],['workshop_changes','workshop_id']];
const noRelations=relations.map(([table,column])=>`NOT EXISTS (SELECT 1 FROM ${table} r WHERE r.${column}=w.id)`).join(' AND ');
const wanted="wanted AS (SELECT json_extract(value,'$.id') AS id,json_extract(value,'$.updatedAt') AS updated_at FROM json_each(?))";
const eligible=`w.status='draft' AND w.updated_at=t.updated_at AND NOT EXISTS (SELECT 1 FROM workshop_google_places g WHERE g.workshop_id=w.id AND g.place_id IS NOT NULL) AND ${noRelations}`;

// One atomic D1 batch: a stale, published, mapped or customer-linked target
// suppresses the whole removal; private relation tables are never written.
export function workshopRetirementBatch(targets,operationId,removedAt){
 if(targets.length!==allowedIds.size||new Set(targets.map(t=>t.id)).size!==targets.length||targets.some(t=>!allowedIds.has(t.id)||!Number.isFinite(Date.parse(t.updatedAt))))throw Error('Removal must cover exactly the reviewed 27 drafts');
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
