import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {loadMigrationSet,snapshotDatabase,restoreSnapshot} from '../scripts/data-transfer.mjs';

const migrations=await loadMigrationSet(),db=new DatabaseSync(':memory:');
try {
 db.exec('CREATE TABLE riparim_node_migrations (name TEXT PRIMARY KEY,sha256 TEXT NOT NULL,applied_at TEXT NOT NULL)');
 for(const migration of migrations){db.exec(migration.sql);db.prepare('INSERT INTO riparim_node_migrations VALUES (?,?,?)').run(migration.name,migration.sha256,'2026-10-11T00:00:00Z');}
 const snapshot=snapshotDatabase(db,{projectId:'synthetic-exit',sourceCommit:'a'.repeat(40),exportedAt:'2026-10-11T00:00:00Z'});
 const restored=restoreSnapshot(snapshot,migrations);
 assert.deepEqual(restored.proof.history,['riparim_node_migrations']);
 restored.database.close();
 const changed=structuredClone(snapshot);changed.tables.find(table=>table.name==='riparim_node_migrations').rows[0].sha256='b'.repeat(64);
 assert.throws(()=>restoreSnapshot(changed,migrations),/migration history/i);
 const falseColumns=structuredClone(snapshot);falseColumns.tables.find(table=>table.name==='riparim_node_migrations').columns[1].type='BLOB';
 assert.throws(()=>restoreSnapshot(falseColumns,migrations),/migration history/i,'Runtime history columns must match the proved schema');
 console.log('Node restore recognizes and verifies actual applied migration receipts');
}finally{db.close();}

const {mkdtemp,mkdir,rm,stat,readFile,writeFile}=await import('node:fs/promises');
const {tmpdir}=await import('node:os'),{join}=await import('node:path');
const {backupFixture}=await import('./helpers/provider-exit-backup.mjs');
const parent=await mkdtemp(join(tmpdir(),'riparim-exit-restore-'));
try {
 const source=await backupFixture(parent,async storage=>{
  await storage.db.prepare("INSERT INTO visits (id,owner,workshop,date,vehicle,service,evidence_type,created_at) VALUES ('synthetic-review','stable-account','synthetic-workshop','2026-10-11','fixture','fixture','Rechnung','2026-10-11')").run();
  const reserve=await storage.bucket.put('reserved/private.bin',null,{customMetadata:{reservation:'synthetic'}});
  await storage.db.prepare('INSERT INTO evidence_uploads VALUES (?,?)').bind(reserve.key,'stable-account').run();
 });
 const {restoreNodeBackup}=await import('../scripts/restore-node.mjs');
 const historical=join(parent,'historical-trigger');await mkdir(historical,{mode:0o700});
 const ignored=await backupFixture(historical,async storage=>{
  await storage.db.prepare("INSERT INTO workshops(id,name,city,address,phone,brands,services,specialty,description,sources,checked_at,updated_at) VALUES ('retired-existing','Synthetic workshop','Prishtina','Synthetic road','+38344123456','[]','[]','Synthetic','Synthetic','[]','2026-10-11','2026-10-11')").run();
  await storage.db.prepare("INSERT INTO catalog_state VALUES ('workshop-retired:retired-existing','2026-10-11')").run();
 });
 assert.equal(ignored.snapshot.tables.find(table=>table.name==='workshops').rows.length,1);
 const refusedDirectory=join(historical,'target');
 await assert.rejects(restoreNodeBackup({sourceDirectory:ignored.backupDirectory,expectedProjectId:ignored.snapshot.projectId,expectedCommit:ignored.snapshot.sourceCommit,directory:refusedDirectory}),/rows.*checked-in schema/,'A schema-valid trigger-ignored row must stop the protected restore');
 await assert.rejects(stat(refusedDirectory),/ENOENT/,'Silent row loss cannot publish either destination database or a completion receipt');
 const options={sourceDirectory:source.backupDirectory,expectedProjectId:source.snapshot.projectId,expectedCommit:source.snapshot.sourceCommit,directory:join(parent,'target')};
 const result=await restoreNodeBackup(options);assert.equal(result.restored,true);
 assert.equal((await stat(options.directory)).mode&0o777,0o700);
 for(const filename of ['app.sqlite','files.sqlite','.restore.json'])assert.equal((await stat(join(options.directory,filename))).mode&0o777,0o600);
 const target=source.api.createNodeStorage(options.directory);
 try {
  const actual=await target.bucket.list();assert.equal(actual.objects.length,source.manifest.objects.length);
  for(const original of source.manifest.objects){
   const object=await target.bucket.get(original.key);
   assert.equal(object.etag,original.etag);assert.equal(object.uploaded.toISOString(),original.uploaded);
   assert.deepEqual(JSON.parse(JSON.stringify(object.httpMetadata)),original.httpMetadata);if(original.httpMetadata.cacheExpiry)assert(object.httpMetadata.cacheExpiry instanceof Date,'Node metadata preserves the Date contract after JSON storage');assert.deepEqual(object.customMetadata,original.customMetadata);
   assert.deepEqual(Buffer.from(await object.arrayBuffer()),await readFile(join(source.backupDirectory,original.file)));
  }
  const receipts=await target.db.prepare('SELECT name,sha256 FROM riparim_node_migrations ORDER BY name').all();
  assert.deepEqual(receipts.results.map(row=>({...row})),migrations.map(({name,sha256})=>({name,sha256})));
 }finally{target.close();}
 assert.equal((await restoreNodeBackup(options)).unchanged,true,'Unchanged completed restore is a verified no-op');
 const changedDb=new DatabaseSync(join(options.directory,'app.sqlite'));
 changedDb.prepare("DELETE FROM visits WHERE id='synthetic-review'").run();changedDb.close();
 await assert.rejects(restoreNodeBackup(options),/changed|active/i,'A deleted destination review must never return from an old backup');
 const after=new DatabaseSync(join(options.directory,'app.sqlite'));assert.equal(after.prepare('SELECT COUNT(*) AS n FROM visits').get().n,0);after.close();
 const object=source.manifest.objects.find(object=>object.size>0),path=join(source.backupDirectory,object.file),bytes=await readFile(path);
 await writeFile(path,Buffer.alloc(bytes.length));
 const broken={...options,directory:join(parent,'broken')};
 await assert.rejects(restoreNodeBackup(broken),/checksum/i);
 await assert.rejects(stat(broken.directory),/ENOENT/,'Neither database is exposed by an incomplete restore');
 await writeFile(path,bytes);
 await (await import('node:fs/promises')).chmod(path,0o644);
 const incomplete={...options,directory:join(parent,'incomplete')};
 await assert.rejects(restoreNodeBackup(incomplete),/private regular/i);
 await assert.rejects(stat(incomplete.directory),/ENOENT/,'App restoration alone must not expose a half-restored target');
 await (await import('node:fs/promises')).chmod(path,0o600);
 const updated={...options,directory:join(parent,'updated')};await restoreNodeBackup(updated);
 const newer=new DatabaseSync(join(updated.directory,'app.sqlite'));newer.prepare("UPDATE visits SET vehicle='newer target value'").run();newer.close();
 await assert.rejects(restoreNodeBackup(updated),/changed|active/i,'Newer customer changes stop an old retry');
 const preserved=new DatabaseSync(join(updated.directory,'app.sqlite'));assert.equal(preserved.prepare('SELECT vehicle FROM visits').get().vehicle,'newer target value');preserved.close();
 const fresh={...options,directory:join(parent,'fresh')};await restoreNodeBackup(fresh);
 const modified=source.api.createNodeStorage(fresh.directory);
 const reservation=await modified.bucket.head('reserved/private.bin');
 assert(await modified.bucket.put(reservation.key,'synthetic late upload',{onlyIf:{etagMatches:reservation.etag}}),'Preserved reservations retain their actual conditional write contract');modified.close();
 await assert.rejects(restoreNodeBackup(fresh),/changed|active/i,'New target file bytes are not overwritten by retry');
 console.log('Protected Node restore: complete atomic directory, original metadata/ETags, migration receipts, no-op retry, deleted/new data preservation and corrupt-byte refusal passed');
}finally{await rm(parent,{recursive:true,force:true});}
