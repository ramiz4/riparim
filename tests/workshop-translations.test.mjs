import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {build} from 'esbuild';
await mkdir('.test-runtime/workshop-translations',{recursive:true});
const bundle=await build({stdin:{contents:"export * from './lib/workshop-translations';export {createWorkshopDisplayAdapter} from './lib/workshop-display.server';",resolveDir:process.cwd(),loader:'ts'},bundle:true,platform:'node',format:'esm',write:false});
await writeFile('.test-runtime/workshop-translations/source.mjs',bundle.outputFiles[0].contents);
const {validateWorkshopTranslations,workshopTranslationSourceHash,createWorkshopDisplayAdapter}=await import(new URL('../.test-runtime/workshop-translations/source.mjs',import.meta.url));
const workshop={id:'fixture-workshop',status:'published',specialty:'Diagnose',description:'Werkstatt für Diagnose.',serviceDetails:['Elektronische Diagnose','Bremsenservice'],phoneNote:'Erreichbarkeit nicht bestätigt.',sources:[{url:'https://example.test/one',title:'Eigenangaben'},{url:'https://example.test/two',title:'Öffentliches Verzeichnis'}]};
const sq={specialty:'Diagnostikë',description:'Punishte për diagnostikë.',serviceDetails:['Diagnostikë elektronike','Servis frenash'],phoneNote:'Mundësia e kontaktit nuk është konfirmuar.',sourceTitles:['Të dhënat e vetë biznesit','Direktori publike']};
const en={specialty:'Diagnostics',description:'Workshop for diagnostics.',serviceDetails:['Electronic diagnostics','Brake service'],phoneNote:'Contact availability is unconfirmed.',sourceTitles:['Business information','Public directory']};
const sourceHash=await workshopTranslationSourceHash(workshop),input={schemaVersion:1,workshops:[{id:workshop.id,sourceHash,sq,en}]};
assert.equal(sourceHash,'e496fa67a2fe199822fb4451182bc99838f6fb964a1fd28126cf711e54a5180c','ordered UTF-8 source payload has a stable SHA-256 revision');
assert.equal(await workshopTranslationSourceHash({...workshop,updatedAt:'2099-01-01',phone:'+38349000000',whatsapp:'+38349000000'}),sourceHash,'untranslated contacts and timestamps do not invalidate the source');
assert.notEqual(await workshopTranslationSourceHash({...workshop,sources:[...workshop.sources].reverse()}),sourceHash,'source order is part of the revision');
assert.notEqual(await workshopTranslationSourceHash({...workshop,sources:workshop.sources.map(s=>({...s,url:s.url+'/changed'}))}),sourceHash,'source URLs also bind the source titles');
assert.deepEqual(await validateWorkshopTranslations(input,[workshop]),input);
await assert.rejects(()=>validateWorkshopTranslations({...input,workshops:[]},[workshop]),/Missing translation/,'every published static ID requires SQ and EN');
for(const mutate of [
 value=>value.workshops.push(value.workshops[0]),
 value=>value.workshops[0].id='unknown-id',
 value=>value.workshops[0].sourceHash='f'.repeat(64),
 value=>value.workshops[0].sourceHash='invalid',
 value=>value.workshops[0].sq.serviceDetails.pop(),
 value=>value.workshops[0].en.sourceTitles.push('Extra source'),
 value=>value.workshops[0].sq.description='  ',
 value=>value.workshops[0].en.phoneNote='',
 value=>value.workshops[0].en.sourceTitles[0]='',
 value=>value.workshops[0].sq.serviceDetails[0]='',
 value=>value.workshops[0].sq.phone='+38349000000',
 value=>value.workshops[0].de=value.workshops[0].en,
 value=>delete value.workshops[0].en,
 value=>value.extra='field'
]){const invalid=structuredClone(input);mutate(invalid);await assert.rejects(()=>validateWorkshopTranslations(invalid,[workshop]));}
assert.deepEqual(await validateWorkshopTranslations({schemaVersion:1,workshops:[]},[{...workshop,status:'draft'}]),{schemaVersion:1,workshops:[]},'drafts require no translation coverage');
const original=structuredClone(workshop),adapter=createWorkshopDisplayAdapter([workshop],input);
const display=await createWorkshopDisplayAdapter([workshop],input)([workshop],'sq');
assert.deepEqual(display,{[workshop.id]:sq},'current published source receives separate SQ display values');
assert.deepEqual(await adapter([workshop],'en'),{[workshop.id]:en});
assert.deepEqual(workshop,original,'display adapter leaves canonical domain values untouched');
const de=await adapter([workshop],'de');assert.equal(de[workshop.id].description,workshop.description);assert.equal(de[workshop.id].originalLanguage,'de');assert.equal(de[workshop.id].fallback,undefined);
const missing=await createWorkshopDisplayAdapter([workshop],{schemaVersion:1,workshops:[]})([workshop],'sq');assert.equal(missing[workshop.id].fallback,'missing');assert.equal(missing[workshop.id].description,workshop.description);assert.equal(missing[workshop.id].originalLanguage,'de','only known matching curated originals get German lang');
const changed={...workshop,description:'Fresh operator information',phoneNote:'Fresh contact warning'};
const stale=await adapter([changed],'en');assert.equal(stale[workshop.id].fallback,'stale');assert.equal(stale[workshop.id].description,changed.description);assert.equal(stale[workshop.id].phoneNote,changed.phoneNote);assert.equal(stale[workshop.id].originalLanguage,undefined,'edited live originals cannot inherit static German language');
assert.equal((await adapter([{...workshop,id:'new-live-workshop'}],'sq'))['new-live-workshop'].originalLanguage,undefined);
const wrongHash=structuredClone(input);wrongHash.workshops[0].sourceHash='f'.repeat(64);assert.equal((await createWorkshopDisplayAdapter([workshop],wrongHash)([workshop],'en'))[workshop.id].fallback,'stale');
assert.deepEqual(await adapter([{...workshop,status:'draft'}],'sq'),{},'hidden profiles never enter public display');
const staticCatalogue=JSON.parse(await readFile('data/workshops.json','utf8')),staticOverlay=JSON.parse(await readFile('data/workshop-translations.json','utf8'));
await validateWorkshopTranslations(staticOverlay,staticCatalogue.workshops);
assert.equal(staticOverlay.workshops.length,staticCatalogue.workshops.filter(w=>w.status==='published').length);
console.log('Workshop translation validation, current repository coverage and revision-safe adapter passed');
