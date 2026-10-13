import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdir,readFile,readdir} from 'node:fs/promises';
import {DatabaseSync} from 'node:sqlite';
import {workshopEmailImportQuery,workshopEmailRevision} from '../scripts/lib/workshop-email-import.mjs';

await mkdir('.test-runtime/workshop-emails',{recursive:true});
const output='.test-runtime/workshop-emails/source.mjs';
await build({stdin:{contents:"export * from './lib/workshop-emails';export {validateWorkshopEmailContacts} from './lib/workshop-contacts';export {catalogueImportStatements} from './db/catalogue-import';export {listWorkshops} from './db/directory';",resolveDir:process.cwd(),loader:'ts'},bundle:true,platform:'node',format:'esm',outfile:output,plugins:[{name:'email-storage',setup(b){b.onResolve({filter:/^cloudflare:workers$/},()=>({path:'env',namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:'export const env=globalThis.emailFixtureEnv;',loader:'js'}));}}]});
const db=new DatabaseSync(':memory:');db.exec('PRAGMA foreign_keys=ON');
const adapter={prepare(sql){const statement=db.prepare(sql);const bound=(values=[])=>({bind:(...values)=>bound(values),run:async()=>({meta:statement.run(...values)}),first:async()=>statement.get(...values)??null,all:async()=>({results:statement.all(...values)})});return bound();},async batch(statements){db.exec('BEGIN');try{const result=[];for(const statement of statements)result.push(await statement.run());db.exec('COMMIT');return result;}catch(error){db.exec('ROLLBACK');throw error;}}};
globalThis.emailFixtureEnv={DB:adapter,BUCKET:{}};
const contracts=await import(new URL('../'+output,import.meta.url));
const catalogue=JSON.parse(await readFile('data/workshops.json','utf8')),legacy=JSON.parse(await readFile('data/workshop-contacts.json','utf8')).contacts;
const migrations=(await readdir('drizzle')).filter(n=>n.endsWith('.sql')).sort();
for(const name of migrations.filter(n=>n<'0023'))db.exec(await readFile('drizzle/'+name,'utf8'));
for(const statement of await contracts.catalogueImportStatements(adapter,catalogue,legacy))await statement.run();
const oldContacts=db.prepare('SELECT * FROM workshop_contact_details ORDER BY workshop_id').all(),oldProfiles=db.prepare('SELECT * FROM workshops ORDER BY id').all().map(row=>({...row}));
for(const name of migrations.filter(n=>n>='0023'))db.exec(await readFile('drizzle/'+name,'utf8'));
assert.equal(db.prepare('SELECT count(*) AS n FROM workshop_email_addresses').get().n,10);
for(const contact of oldContacts){const row=db.prepare('SELECT * FROM workshop_email_addresses WHERE workshop_id=?').get(contact.workshop_id);assert.equal(row.email,contact.email);assert.equal(row.checked_at,contact.checked_at);assert.equal(row.source_urls,contact.source_urls);}
assert.deepEqual(db.prepare('SELECT * FROM workshop_contact_details ORDER BY workshop_id').all(),oldContacts);
assert.deepEqual(db.prepare('SELECT * FROM workshops ORDER BY id').all().map(row=>{const copy={...row};delete copy.editorial_emails;return copy;}),oldProfiles);
const source=JSON.parse(await readFile('data/workshop-emails.json','utf8'));
contracts.validateWorkshopEmailContacts(source,catalogue.workshops);
for(const mutate of [m=>m.contacts.push(m.contacts[0]),m=>m.contacts[0].workshopId='missing-workshop',m=>m.contacts[0].matchedPhone='+38344123456',m=>m.contacts[0].emails=[{address:'invalid',sourceUrls:['https://example.test/'],checkedAt:'2026-10-13',emailVerification:'publicly_listed'}],m=>m.contacts[0].emails=[...Array(11)].map((_,i)=>({address:`email${i}@example.test`,sourceUrls:['https://example.test/'],checkedAt:'2026-10-13',emailVerification:'publicly_listed'})),m=>{m.contacts[0].emails=[{address:'dup@example.test',sourceUrls:['https://example.test/'],checkedAt:'2026-10-13',emailVerification:'publicly_listed'},{address:'DUP@example.test',sourceUrls:['https://example.test/'],checkedAt:'2026-10-13',emailVerification:'publicly_listed'}];}]){const invalid=structuredClone(source);mutate(invalid);assert.throws(()=>contracts.validateWorkshopEmailContacts(invalid,catalogue.workshops));}
assert.deepEqual(contracts.workshopEmailsSchema.parse([' first@example.test ','Second@example.test']),['first@example.test','Second@example.test']);
assert.throws(()=>contracts.workshopEmailsSchema.parse(['a@example.test','A@example.test']));
assert.throws(()=>contracts.workshopEmailSchema.parse('x'.repeat(255)+'@example.test'));
assert.equal(contracts.workshopEmailHref('service+local@example.test'),'mailto:service%2Blocal%40example.test');
const edited=[{address:'first@example.test',active:true,verified:true},{address:'other@example.test',active:false,verified:false}];
assert.deepEqual(contracts.workshopEmailEdits(JSON.stringify(edited),'["research@example.test"]'),edited);
assert.deepEqual(contracts.workshopEmailEdits('[]','["research@example.test"]'),[]);
assert.deepEqual(contracts.workshopEmailEdits(null,'["research@example.test"]'),[{address:'research@example.test',active:true,verified:false}]);
const fixture=structuredClone(source),w=catalogue.workshops[0];
fixture.contacts[0].emails=[{address:'one@example.test',sourceUrls:['https://workshop.example.test/contact'],checkedAt:'2026-10-13',emailVerification:'publicly_listed'},{address:'two@example.test',sourceUrls:['https://workshop.example.test/locations'],checkedAt:'2026-10-13',emailVerification:'publicly_listed'}];fixture.contacts[0].researchStatus='found';
const apply=manifest=>{const query=workshopEmailImportQuery(manifest);db.exec('BEGIN');try{const changes=query.batch.map(q=>db.prepare(q.sql).run(...q.params).changes);db.exec('COMMIT');return changes;}catch(error){db.exec('ROLLBACK');throw error;}};
apply(fixture);const imported=db.prepare('SELECT * FROM workshop_email_addresses ORDER BY workshop_id,email_key').all();assert.deepEqual(apply(fixture),[0,0]);assert.deepEqual(db.prepare('SELECT * FROM workshop_email_addresses ORDER BY workshop_id,email_key').all(),imported);
const modified=structuredClone(fixture);modified.contacts[0].notes+=' modified';assert.throws(()=>workshopEmailImportQuery(modified,workshopEmailRevision(fixture)),/immutable/);
db.prepare("UPDATE workshop_email_addresses SET email='newer@example.test',checked_at='2099-01-01' WHERE workshop_id=? AND email_key='one@example.test'").run(w.id);apply(fixture);assert.equal(db.prepare("SELECT email FROM workshop_email_addresses WHERE workshop_id=? AND email_key='one@example.test'").get(w.id).email,'newer@example.test');
for(const column of ['name','phone','city','status']){const before=db.prepare('SELECT * FROM workshop_email_addresses ORDER BY workshop_id,email_key').all();db.prepare(`UPDATE workshops SET ${column}=? WHERE id=?`).run(column==='status'?'draft':'Changed',w.id);assert.throws(()=>apply(fixture),/NOT NULL/);assert.deepEqual(db.prepare('SELECT * FROM workshop_email_addresses ORDER BY workshop_id,email_key').all(),before);db.prepare(`UPDATE workshops SET ${column}=? WHERE id=?`).run(w[column],w.id);}
const empty=structuredClone(fixture);for(const c of empty.contacts){c.emails=[];c.researchStatus='not_found';}empty.contacts[0].workshopId='unknown';assert.throws(()=>apply(empty),/NOT NULL/);
// Use the real directory query: email count must not multiply visit aggregates.
db.prepare('INSERT INTO visits(id,owner,workshop,date,vehicle,service,evidence_type,status,rating,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)').run('email-review-fixture','fixture-owner',w.id,'2026-10-13','Fixture car','Diagnose','receipt','published',4,'2026-10-13');
let workshop=(await contracts.listWorkshops()).find(row=>row.id===w.id);assert.equal(workshop.count,1);assert.equal(workshop.rating,4);assert(workshop.emails.length>=2);assert(workshop.emailContacts.every(e=>!e.verified));assert(!Object.hasOwn(workshop,'editableEmailContacts'));assert(!JSON.stringify(workshop).includes('importRevision'));
db.prepare('UPDATE workshops SET editorial_emails=? WHERE id=?').run(JSON.stringify(edited),w.id);workshop=(await contracts.listWorkshops()).find(row=>row.id===w.id);assert.deepEqual(workshop.emails,['first@example.test']);assert.deepEqual(workshop.emailContacts,[{address:'first@example.test',verified:true}]);assert.deepEqual((await contracts.listWorkshops(true)).find(row=>row.id===w.id).editableEmailContacts,edited);
db.prepare("UPDATE workshops SET editorial_emails='[]' WHERE id=?").run(w.id);apply(fixture);assert.deepEqual((await contracts.listWorkshops()).find(row=>row.id===w.id).emails,[]);
db.close();delete globalThis.emailFixtureEnv;
console.log('Workshop emails: ten-address migration, per-address evidence, validation, immutable atomic replay, live identity fencing, newer evidence, verification/visibility precedence and unchanged review aggregates passed');
