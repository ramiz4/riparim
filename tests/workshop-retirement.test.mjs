import assert from 'node:assert/strict';
import {readFile,readdir,mkdir,writeFile} from 'node:fs/promises';
import {DatabaseSync} from 'node:sqlite';
import {build} from 'esbuild';
import {workshopRetirementBatch} from '../scripts/lib/workshop-retirement.mjs';
const manifest=JSON.parse(await readFile('data/workshop-removals.json','utf8'));
const catalogue=JSON.parse(await readFile('data/workshops.json','utf8'));
const targetRevision='2026-10-01T00:00:00Z',targets=manifest.workshopIds.map(id=>({id,updatedAt:targetRevision}));
const batch=workshopRetirementBatch(targets,'fixture-removal-operation','2026-10-05T00:00:00Z');
const migrations=await Promise.all((await readdir('drizzle')).filter(p=>p.endsWith('.sql')).sort().map(p=>readFile('drizzle/'+p,'utf8')));
function database(groupTargets=targets){const db=new DatabaseSync(':memory:');for(const sql of migrations)db.exec(sql);const base=catalogue.workshops[0],insert=db.prepare('INSERT INTO workshops(id,name,city,address,phone,brands,services,specialty,description,sources,checked_at,status,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)');for(const t of groupTargets){insert.run(t.id,'Fixture workshop',base.city,'Fixture address','+383441234567','[]','["Inspektion & Wartung"]','Fixture service','Fixture workshop description','[]','2026-10-01','draft',t.updatedAt);if(t.placeId)db.prepare('INSERT INTO workshop_google_places VALUES(?,?,?,?,?)').run(t.id,t.placeId,'fixture',1,2);}return db;}
function apply(db,statements=batch){db.exec('BEGIN');try{const result=statements.map(s=>Number(db.prepare(s.sql).run(...s.params).changes));db.exec('COMMIT');return result;}catch(error){db.exec('ROLLBACK');throw error;}}
const db=database();assert.deepEqual(apply(db),[1,27,0,0,27]);assert.equal(db.prepare('SELECT COUNT(*) AS n FROM workshops').get().n,0);assert(apply(db).every(n=>n===0),'repeat application changes nothing');
const retired=targets[0].id,base=catalogue.workshops[0];
const legacyInsert=db.prepare('INSERT INTO workshops(id,name,city,address,phone,brands,services,specialty,description,sources,checked_at,status,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)');
assert.equal(legacyInsert.run(retired,'Legacy fixture',base.city,'Fixture address','+383441234567','[]','[]','Fixture','Fixture legacy source','[]','2026-10-01','draft',targetRevision).changes,0,'an older release cannot resurrect a retired ID');
assert.equal(db.prepare('INSERT INTO workshop_google_places VALUES(?,?,?,?,?)').run(retired,'ChIJLegacyFixturePlace','fixture',1,2).changes,0,'retired Google identity metadata stays absent');
assert.equal(db.prepare('INSERT INTO workshop_google_ratings(workshop_id,maps_url,checked_at) VALUES(?,?,?)').run(retired,'https://www.google.com/maps/',targetRevision).changes,0,'retired Google links stay absent');
assert.equal(legacyInsert.run('fresh-workshop-fixture','Fresh fixture',base.city,'Fixture address','+383441234567','[]','[]','Fixture','Fixture new source','[]','2026-10-01','draft',targetRevision).changes,1,'unrelated inserts remain supported');const bulk=db.prepare('INSERT INTO workshops(id,name,city,address,phone,brands,services,specialty,description,sources,checked_at,status,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?),(?,?,?,?,?,?,?,?,?,?,?,?,?)');const row=id=>[id,'Mixed fixture',base.city,'Fixture address','+383441234567','[]','[]','Fixture','Fixture mixed source','[]','2026-10-01','draft',targetRevision];assert.equal(bulk.run(...row(retired),...row('mixed-fresh-fixture')).changes,1,'ignoring a retired row preserves unrelated rows in a bulk seed');db.close();
for(const scenario of ['newer_revision','published','mapped','visit','claim','owner','change']){const db=database(),id=targets[0].id;
 if(scenario==='newer_revision')db.prepare('UPDATE workshops SET updated_at=? WHERE id=?').run('2026-10-05T12:00:00Z',id);
 if(scenario==='published')db.prepare("UPDATE workshops SET status='published' WHERE id=?").run(id);
 if(scenario==='mapped')db.prepare('INSERT INTO workshop_google_places VALUES(?,?,?,?,?)').run(id,'ChIJFixtureExistingPlace','fixture',1,2);
 if(scenario==='visit')db.prepare('INSERT INTO visits(id,owner,workshop,date,vehicle,service,evidence_type,created_at) VALUES(?,?,?,?,?,?,?,?)').run('visit-fixture','private-owner-fixture',id,'2026-10-01','Fixture vehicle','Fixture service','Rechnung',targetRevision);
 if(scenario==='claim')db.prepare('INSERT INTO workshop_claims(id,workshop_id,owner,evidence,created_at) VALUES(?,?,?,?,?)').run('claim-fixture',id,'private-owner-fixture','Private fixture proof',targetRevision);
 if(scenario==='owner')db.prepare('INSERT INTO workshop_owners VALUES(?,?,?,?,?)').run(id,'private-owner-fixture','claim-fixture',targetRevision,'moderator-fixture');
 if(scenario==='change')db.prepare('INSERT INTO workshop_changes(id,workshop_id,owner,profile,base_updated_at,created_at) VALUES(?,?,?,?,?,?)').run('change-fixture',id,'private-owner-fixture','{}',targetRevision,targetRevision);
 const tables=['workshops','visits','workshop_claims','workshop_owners','workshop_changes','workshop_google_places','catalog_state'];const before=tables.map(t=>db.prepare('SELECT * FROM '+t+' ORDER BY 1').all());assert(apply(db).every(n=>n===0),scenario);assert.deepEqual(tables.map(t=>db.prepare('SELECT * FROM '+t+' ORDER BY 1').all()),before,'blocked removal preserves all rows: '+scenario);db.close();}
await mkdir('.test-runtime/workshop-retirement',{recursive:true});const bundle=await build({entryPoints:['lib/workshop-source.ts','db/directory.ts'],outdir:'.test-runtime/workshop-retirement',bundle:true,format:'esm',platform:'node',write:false,plugins:[{name:'storage-fixture',setup(b){b.onResolve({filter:/^cloudflare:workers$/},()=>({path:'env',namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:'export const env={};',loader:'js'}));}}]});for(const file of bundle.outputFiles){await mkdir(file.path.slice(0,file.path.lastIndexOf('/')),{recursive:true});await writeFile(file.path.replace(/\.js$/,'.mjs'),file.contents);}const source=await import(new URL('../.test-runtime/workshop-retirement/lib/workshop-source.mjs',import.meta.url));const directory=await import(new URL('../.test-runtime/workshop-retirement/db/directory.mjs',import.meta.url));
const incoming={...structuredClone(base),id:retired,status:'draft',google:{placeId:null,matchedAt:null,snapshot:null}};assert.throws(()=>source.mergeWorkshopCatalogue(catalogue,[incoming]),/Entfernte Werkstattkennung/);assert.throws(()=>directory.validateProfile(incoming,retired),/entfernt/);assert.throws(()=>workshopRetirementBatch(targets.slice(1),'fixture-removal-operation',targetRevision),/exactly/);
const finalManifest=JSON.parse(await readFile('data/workshop-final-removals.json','utf8'));
const finalTargets=finalManifest.workshopIds.map(id=>({id,updatedAt:targetRevision,placeId:finalManifest.confirmedPlaceIds[id]??null}));
const finalBatch=workshopRetirementBatch(finalTargets,'fixture-final-operation',targetRevision);
const finalDb=database(finalTargets);
for(const t of finalTargets)finalDb.prepare('INSERT INTO workshop_google_ratings(workshop_id,maps_url,checked_at) VALUES(?,?,?)').run(t.id,'https://www.google.com/maps/',targetRevision);
assert.deepEqual(apply(finalDb,finalBatch),[1,8,8,6,8],'the authorized final group removes only its unchanged confirmed mappings');
assert(apply(finalDb,finalBatch).every(n=>n===0));finalDb.close();
assert.throws(()=>workshopRetirementBatch(finalTargets.map(t=>({...t,placeId:null})),'fixture-final-operation',targetRevision),/confirmed identities/,'caller cannot weaken the reviewed identity preconditions');
assert.throws(()=>workshopRetirementBatch([...targets,...finalTargets],'fixture-mixed-operation',targetRevision),/exactly/,'separately reviewed groups cannot be combined implicitly');
for(const scenario of ['newer_revision','published','mapped','removed_mapping','visit','claim','owner','change']){
 const db=database(finalTargets),id=finalTargets.find(t=>t.placeId).id;
 if(scenario==='newer_revision')db.prepare('UPDATE workshops SET updated_at=? WHERE id=?').run('2026-10-05T12:00:00Z',id);
 if(scenario==='published')db.prepare("UPDATE workshops SET status='published' WHERE id=?").run(id);
 if(scenario==='mapped')db.prepare('UPDATE workshop_google_places SET place_id=? WHERE workshop_id=?').run('ChIJChangedFixturePlace',id);
 if(scenario==='removed_mapping')db.prepare('DELETE FROM workshop_google_places WHERE workshop_id=?').run(id);
 if(scenario==='visit')db.prepare('INSERT INTO visits(id,owner,workshop,date,vehicle,service,evidence_type,created_at) VALUES(?,?,?,?,?,?,?,?)').run('visit-fixture','private-owner-fixture',id,'2026-10-01','Fixture vehicle','Fixture service','Rechnung',targetRevision);
 if(scenario==='claim')db.prepare('INSERT INTO workshop_claims(id,workshop_id,owner,evidence,created_at) VALUES(?,?,?,?,?)').run('claim-fixture',id,'private-owner-fixture','Private fixture proof',targetRevision);
 if(scenario==='owner')db.prepare('INSERT INTO workshop_owners VALUES(?,?,?,?,?)').run(id,'private-owner-fixture','claim-fixture',targetRevision,'moderator-fixture');
 if(scenario==='change')db.prepare('INSERT INTO workshop_changes(id,workshop_id,owner,profile,base_updated_at,created_at) VALUES(?,?,?,?,?,?)').run('change-fixture',id,'private-owner-fixture','{}',targetRevision,targetRevision);
 const tables=['workshops','visits','workshop_claims','workshop_owners','workshop_changes','workshop_google_places','workshop_google_ratings','catalog_state'];
 const before=tables.map(t=>db.prepare('SELECT * FROM '+t+' ORDER BY 1').all());assert(apply(db,finalBatch).every(n=>n===0),scenario);assert.deepEqual(tables.map(t=>db.prepare('SELECT * FROM '+t+' ORDER BY 1').all()),before,'final removal preserves all rows when blocked: '+scenario);db.close();
}
for(const id of finalManifest.workshopIds){const reimport={...incoming,id};assert.throws(()=>source.mergeWorkshopCatalogue(catalogue,[reimport]),/Entfernte Werkstattkennung/);assert.throws(()=>directory.validateProfile(reimport,id),/entfernt/);}
console.log(JSON.stringify({removedIds:35,sourceAndAdminReimportBlocked:true,legacySeedBlocked:true,unrelatedInsertsAllowed:true,blockedScenarios:15,privateRowsPreserved:true,repeatIsIdempotent:true,liveWrites:false}));
