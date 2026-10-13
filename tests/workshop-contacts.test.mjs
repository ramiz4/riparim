import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdir,readFile,readdir} from 'node:fs/promises';
import {DatabaseSync} from 'node:sqlite';

await mkdir('.test-runtime/workshop-contacts',{recursive:true});
await build({stdin:{contents:"export {validateWorkshopContacts} from './lib/workshop-contacts';export {catalogueImportStatements,catalogueImportKey} from './db/catalogue-import';export {decodeProfile} from './db/workshop-record';",resolveDir:process.cwd(),loader:'ts'},bundle:true,format:'esm',platform:'node',outfile:'.test-runtime/workshop-contacts/source.mjs'});
const {validateWorkshopContacts,catalogueImportStatements,catalogueImportKey,decodeProfile}=await import(new URL('../.test-runtime/workshop-contacts/source.mjs',import.meta.url));
const catalogue=JSON.parse(await readFile('data/workshops.json','utf8'));
const source=JSON.parse(await readFile('data/workshop-contacts.json','utf8'));
const contacts=validateWorkshopContacts(source,catalogue.workshops).contacts;
assert.equal(contacts.length,10);
for(const change of [
 c=>c.contacts.push(c.contacts[0]),
 c=>c.contacts[0].workshopId='missing-workshop',
 c=>c.contacts[0].matchedPhone='+38344000000',
 c=>c.contacts[0].matchedCity='Wrong city',
 c=>c.contacts[0].matchedName='Another workshop',
 c=>c.contacts[0].email='not an email',
 c=>c.contacts[0].sourceUrls=['https://user:password@example.test/'],
 c=>c.contacts[0].checkedAt='2099-01-01',
 c=>c.contacts[0].emailVerification='delivered'
]){const invalid=structuredClone(source);change(invalid);assert.throws(()=>validateWorkshopContacts(invalid,catalogue.workshops));}
const db=new DatabaseSync(':memory:');db.exec('PRAGMA foreign_keys=ON');
for(const name of (await readdir('drizzle')).filter(name=>name.endsWith('.sql')).sort())db.exec(await readFile('drizzle/'+name,'utf8'));
const adapter={prepare(sql){const query=db.prepare(sql);return {bind(...values){assert(values.length<=95);return {run:async()=>query.run(...values)};}};}};
async function seed(data=contacts){const statements=await catalogueImportStatements(adapter,catalogue,data);for(const statement of statements)await statement.run();}
await seed();
assert.equal(db.prepare('SELECT count(*) AS n FROM workshop_contact_details').get().n,10);
for(const c of contacts){const row=db.prepare('SELECT * FROM workshop_contact_details WHERE workshop_id=?').get(c.workshopId);assert.equal(row.email,c.email);assert.deepEqual(JSON.parse(row.source_urls),c.sourceUrls);assert.equal(row.email_verification,'publicly_listed');}
const profiles=db.prepare('SELECT * FROM workshops ORDER BY id').all();
const before=db.prepare('SELECT * FROM workshop_contact_details ORDER BY workshop_id').all();
await seed();assert.deepEqual(db.prepare('SELECT * FROM workshop_contact_details ORDER BY workshop_id').all(),before);
assert.deepEqual(db.prepare('SELECT * FROM workshops ORDER BY id').all(),profiles,'contact imports never change profile fields');
assert.notEqual(await catalogueImportKey(catalogue),await catalogueImportKey(catalogue,contacts),'contact-only revisions trigger the runtime import');
const changed=structuredClone(contacts);changed[0].checkedAt='2026-10-12';
assert.notEqual(await catalogueImportKey(catalogue,contacts),await catalogueImportKey(catalogue,changed));
db.prepare("UPDATE workshop_contact_details SET email='newer@example.test',checked_at='2099-01-01' WHERE workshop_id=?").run(contacts[0].workshopId);
await seed();assert.equal(db.prepare('SELECT email FROM workshop_contact_details WHERE workshop_id=?').get(contacts[0].workshopId).email,'newer@example.test','newer contact edits survive a catalogue refresh');
for(const [column,value] of [['name','Changed owner name'],['phone','+38344000000'],['city','Changed city'],['status','draft']]){
 const c=contacts[1];db.prepare('DELETE FROM workshop_contact_details WHERE workshop_id=?').run(c.workshopId);
 db.prepare(`UPDATE workshops SET ${column}=?,updated_at='2099-01-01T00:00:00Z' WHERE id=?`).run(value,c.workshopId);
 await seed();assert.equal(db.prepare('SELECT count(*) AS n FROM workshop_contact_details WHERE workshop_id=?').get(c.workshopId).n,0,'live identity and publication are checked in the write');
 const original=profiles.find(w=>w.id===c.workshopId);db.prepare(`UPDATE workshops SET ${column}=?,updated_at=? WHERE id=?`).run(original[column],original.updated_at,c.workshopId);
}
await seed();
const publicProfile=decodeProfile(db.prepare('SELECT * FROM workshops WHERE id=?').get(contacts[0].workshopId));
for(const field of ['email','website','sourceUrls','emailVerification'])assert(!Object.hasOwn(publicProfile,field),'new contact research is not exposed in the public profile response');
assert.throws(()=>db.prepare('INSERT INTO workshop_contact_details SELECT ?,email,website,source_urls,checked_at,matched_name,matched_phone,matched_city,email_verification FROM workshop_contact_details LIMIT 1').run('missing-workshop'),/FOREIGN KEY/);
db.prepare('DELETE FROM workshops WHERE id=?').run(contacts[0].workshopId);
assert.equal(db.prepare('SELECT count(*) AS n FROM workshop_contact_details WHERE workshop_id=?').get(contacts[0].workshopId).n,0,'profile removal removes the associated contacts');
db.close();
console.log('Workshop contacts: sourced records, identity guards, additive migration, bounded idempotent import, newer edits and public response boundary passed');
