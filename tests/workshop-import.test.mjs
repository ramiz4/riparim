import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {DatabaseSync} from 'node:sqlite';

const require=createRequire(new URL('../package.json',import.meta.url));
const {build}=require('esbuild');
const React=require('react');
const {renderToStaticMarkup}=require('react-dom/server');
const output='.test-runtime/workshop-import';
const result=await build({entryPoints:['db/directory.ts','lib/catalogue-filters.ts','components/workshop-ratings.tsx'],outdir:output,bundle:true,write:false,format:'esm',platform:'node',jsx:'automatic',external:['react','react-dom','lucide-react'],plugins:[{name:'fixture-storage',setup(b){b.onResolve({filter:/^cloudflare:workers$/},a=>({path:a.path,namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},()=>({loader:'js',contents:'export const env=globalThis.fixtureEnv;'}));}}]});
for(const file of result.outputFiles){await mkdir(file.path.slice(0,file.path.lastIndexOf('/')),{recursive:true});await writeFile(file.path.replace(/\.js$/,'.mjs'),file.contents);}
const sqlite=new DatabaseSync(':memory:');
for(const file of (await readdir('drizzle')).filter(file=>file.endsWith('.sql')).sort())sqlite.exec(await readFile('drizzle/'+file,'utf8'));
const d1={prepare(sql){const statement=sqlite.prepare(sql);const adapter=(values=[])=>({bind:(...v)=>{assert(v.length<=95,'import respects D1 binding limits');return adapter(v);},first:async()=>statement.get(...values)??null,all:async()=>({results:statement.all(...values)}),run:async()=>({meta:statement.run(...values)})});return adapter();},async batch(statements){assert(statements.length<=50,'large imports use bounded batches');sqlite.exec('BEGIN');try{const result=[];for(const statement of statements)result.push(await statement.run());sqlite.exec('COMMIT');return result;}catch(error){sqlite.exec('ROLLBACK');throw error;}}};
globalThis.fixtureEnv={DB:d1,BUCKET:{}};
const load=file=>import(new URL(output+'/'+file,'file://'+process.cwd()+'/').href);
const realNow=Date.now;
let directory;
try{Date.now=()=>0;directory=await load('db/directory.mjs');}finally{Date.now=realNow;}
const filters=await load('lib/catalogue-filters.mjs');
const {WorkshopRatings}=await load('components/workshop-ratings.mjs');
const catalogue=JSON.parse(await readFile('data/workshops.json','utf8'));
const curated=catalogue.workshops.map(({google,...profile})=>profile);
const manifest=JSON.parse(await readFile('data/import-2026-10-03.json','utf8'));
const added=new Set(manifest.importedWorkshopIds);
const oldProfiles=curated.filter(w=>!added.has(w.id));
const newProfiles=curated.filter(w=>added.has(w.id));
assert.equal(newProfiles.length,50);
assert.equal(added.size,50);
assert.equal(oldProfiles.length,113);
assert.equal(new Set(curated.map(w=>w.id)).size,163);
const oldPhones=new Set(oldProfiles.map(w=>w.phone));
assert.equal(new Set(newProfiles.map(w=>w.phone)).size,50);
for(const w of newProfiles){assert(!oldPhones.has(w.phone),'new workshop has a distinct phone');assert.equal(directory.validateProfile(w,w.id).status,w.status);}

// Reproduce an installation seeded with the retained original profiles.
const insert=sqlite.prepare(`INSERT INTO workshops (${directory.profileColumns.join(',')}) VALUES (${directory.profileColumns.map(()=>'?').join(',')})`);
for(const profile of oldProfiles)insert.run(...directory.profileValues(profile));
sqlite.prepare('INSERT INTO catalog_state (key,value) VALUES (?,?)').run('initial-catalog-v3-113','2026-10-02');
const before=sqlite.prepare('SELECT * FROM workshops ORDER BY id').all();
let workshops=await directory.listWorkshops();
assert.equal(workshops.length,71,'only confirmed passenger-workshop profiles become public');
assert.equal((await directory.listWorkshops(true)).length,163);
for(const entry of JSON.parse(await readFile('data/workshop-scope.json','utf8')).excluded){
 assert(!workshops.some(w=>w.id===entry.workshopId),'out-of-scope entries are absent from the public catalogue');
 const retained=(await directory.listWorkshops(true)).find(w=>w.id===entry.workshopId);assert.equal(retained.status,'draft');
 assert.throws(()=>directory.validateProfile({...retained,status:'published'},retained.id),/Pkw/,'administrators cannot accidentally republish excluded truck entries');
}
assert(!workshops.some(w=>w.id==='auto-electronics'),'unconfirmed Google identity remains a draft');

assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM workshops WHERE status='draft'").get().n,92);
const after=sqlite.prepare('SELECT * FROM workshops ORDER BY id').all().filter(w=>!added.has(w.id));
assert.deepEqual(after,before,'existing profile fields and publication state are preserved');
assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM workshop_google_ratings').get().n,78);
assert(manifest.originalPublishedWorkshopIds.every(id=>(catalogue.workshops.find(w=>w.id===id)?.google.snapshot)),'all original profiles retain their separate Google metadata, including hidden profiles');
assert.equal(workshops.filter(w=>w.googleRating.rating!==null).length,5,'only sourced Google scores are numeric');
assert.equal(workshops.filter(w=>w.googleRating.count!==null).length,4);
assert(workshops.every(w=>w.rating===null&&w.count===0),'Google stars never create Riparim reviews');
assert.equal(filters.hasPublishedRatings(workshops),false);
assert.equal(filters.parseCatalogueFilters(new URLSearchParams('sort=bewertung'),workshops).sort,'name','Google scores do not enable Riparim sorting');
const unknown=workshops.find(w=>w.googleRating.rating===null&&w.googleRating.count===null);
assert.equal(unknown.googleRating.rating,null,'missing Google score stays null');
const unknownMarkup=renderToStaticMarkup(React.createElement(WorkshopRatings,{workshop:unknown,details:true}));
assert(unknownMarkup.includes('Google wird geladen …'),'unloaded Google ratings are not reported as absent');
assert(!unknownMarkup.includes('0,0'));
const emptyCardRatings=renderToStaticMarkup(React.createElement(WorkshopRatings,{workshop:unknown,hideUnavailable:true}));
assert(!emptyCardRatings.includes('Google wird geladen')&&!emptyCardRatings.includes('Noch keine'),'list cards preserve the absence of empty rating placeholders');
const sonic=workshops.find(w=>w.id==='sonic-garage');
assert.equal(sonic.googleRating.rating,null,'star icons do not establish an exact Google aggregate');
assert.equal(sonic.googleRating.count,19);
const beli=workshops.find(w=>w.id==='auto-beli-ferizaj');
assert.equal(beli.googleRating.rating,4);
assert.equal(beli.googleRating.count,52);
assert.equal(beli.googleRating.sourceUpdatedAt,'2026-02-20');
assert.equal(workshops.find(w=>w.id==='auto-servis-doni-skenderaj').googleRating.count,8);

// A canonical-source revision updates researched ratings without changing existing profiles.
const beforeRatingRevision=sqlite.prepare('SELECT * FROM workshops ORDER BY id').all();
sqlite.prepare("UPDATE workshop_google_ratings SET rating=NULL,review_count=NULL,checked_at='2026-10-03T17:13:16Z' WHERE workshop_id='auto-beli-ferizaj'").run();
sqlite.prepare("UPDATE workshop_google_ratings SET review_count=6,checked_at='2026-10-03T17:13:16Z' WHERE workshop_id='auto-servis-doni-skenderaj'").run();
sqlite.prepare("DELETE FROM catalog_state WHERE key=?").run(await directory.catalogueSeedKey());
await directory.ensureInitialCatalog();
assert.deepEqual(sqlite.prepare('SELECT * FROM workshops ORDER BY id').all(),beforeRatingRevision);
assert.equal(sqlite.prepare("SELECT review_count FROM workshop_google_ratings WHERE workshop_id='auto-beli-ferizaj'").get().review_count,52);
assert.equal(sqlite.prepare("SELECT review_count FROM workshop_google_ratings WHERE workshop_id='auto-servis-doni-skenderaj'").get().review_count,8);

await directory.ensureInitialCatalog();
assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM workshops').get().n,163,'repeated import adds no duplicates');
const insertVisit=sqlite.prepare('INSERT INTO visits (id,owner,workshop,date,vehicle,service,evidence_type,evidence_note,status,display_name,rating,review,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)');
for(const [id,rating,status] of [['a',2,'published'],['b',4,'published'],['c',5,'pending']])insertVisit.run(id,'fixture-owner','auto-mita','2026-10-02','Fixture car','Service','Rechnung','Fixture evidence',status,'Fixture reviewer',rating,'Fixture repair review','2026-10-03');
workshops=await directory.listWorkshops();
const mita=workshops.find(w=>w.id==='auto-mita');
assert.equal(mita.rating,3);
assert.equal(mita.count,2,'only published Riparim reviews are counted');
assert.equal(mita.googleRating.rating,4.8);
assert.equal(mita.googleRating.count,null,'unpublished Google count is not guessed');
const sorted=filters.matchCatalogue(workshops,{...filters.defaultCatalogueFilters,sort:'rating'});
assert.equal(sorted[0].id,'auto-mita','independent Google 5.0 scores do not outrank a Riparim rating');
const markup=renderToStaticMarkup(React.createElement(WorkshopRatings,{workshop:mita,details:true}));
for(const text of ['Riparim','Google','3,0'])assert(markup.includes(text),`rating display includes ${text}`);
for(const text of ['4,8','Anzahl nicht veröffentlicht','automita.com'])assert(!markup.includes(text),`historical Google content is not displayed: ${text}`);
const liveMarkup=renderToStaticMarkup(React.createElement(WorkshopRatings,{workshop:mita,liveGoogleRating:{rating:4.6,count:123,mapsUrl:'https://maps.google.com/',attributions:[]}}));assert(liveMarkup.includes('4,6')&&liveMarkup.includes('123'),'current Google data is displayed');

// A later snapshot and an administrator's edits survive re-running the seed.
sqlite.prepare("UPDATE workshops SET name='Edited profile',status='draft' WHERE id='auto-mita'").run();
sqlite.prepare("UPDATE workshop_google_ratings SET rating=4.9,checked_at='2099-01-01T00:00:00Z' WHERE workshop_id='auto-mita'").run();
sqlite.prepare("DELETE FROM catalog_state WHERE key=?").run(await directory.catalogueSeedKey());
await directory.ensureInitialCatalog();
const edited=(await directory.listWorkshops(true)).find(w=>w.id==='auto-mita');
assert.equal(edited.name,'Edited profile');
assert.equal(edited.status,'draft');
assert.equal(edited.googleRating.rating,4.9,'older imported snapshot never overwrites newer data');
assert.equal(edited.rating,3,'Google import does not modify visit aggregate');
assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM workshops').get().n,163);
sqlite.close();
console.log(JSON.stringify({newWorkshops:50,publicWorkshops:71,existingDraftsPreserved:92,verifiedGoogleScores:5,independentRatingRevision:true,independentRatings:true,idempotentImport:true,storage:'isolated SQLite fixture',productionTouched:false}));
