import assert from 'node:assert/strict';
import {mkdir,readFile,readdir} from 'node:fs/promises';
import {build} from 'esbuild';
import {DatabaseSync} from 'node:sqlite';
const output='.test-runtime/review-services';await mkdir(output,{recursive:true});
await build({stdin:{contents:"export {submittedReviewServices,decodeReviewServices,reviewServiceValues} from './lib/review';export {reviewServicesLabel} from './lib/i18n/values';export {reviewDialogHref,reviewDialogRequested} from './lib/review-dialog-route';",resolveDir:process.cwd(),loader:'ts'},outfile:output+'/contract.mjs',bundle:true,format:'esm',platform:'node'});
const {submittedReviewServices,decodeReviewServices,reviewServicesLabel,reviewDialogHref,reviewDialogRequested}=await import(new URL('../'+output+'/contract.mjs',import.meta.url));
const db=new DatabaseSync(':memory:');
try{
 for(const file of (await readdir('drizzle')).filter(file=>file.endsWith('.sql')&&file<'0025').sort())db.exec(await readFile('drizzle/'+file,'utf8'));
 db.prepare('INSERT INTO visits(id,owner,workshop,date,vehicle,service,evidence_type,created_at) VALUES(?,?,?,?,?,?,?,?)').run('fixture-id','fixture-owner','fixture-workshop','2026-10-01','Fixture car','Inspektion & Wartung','Anderer Nachweis','2026-10-01');
 db.exec(await readFile('drizzle/0025_dark_pretty_boy.sql','utf8'));
 const prior=db.prepare('SELECT service,services FROM visits WHERE id=?').get('fixture-id');assert.equal(prior.service,'Inspektion & Wartung');assert.deepEqual(decodeReviewServices(prior.service,prior.services),['Inspektion & Wartung'],'Migration preserves the legacy selection');
 assert.deepEqual(decodeReviewServices('Original legacy work',null),['Original legacy work'],'Older null service arrays preserve original descriptions');
 const f=new FormData();f.set('service','Inspektion & Wartung');assert.deepEqual(submittedReviewServices(f),['Inspektion & Wartung']);f.set('services',JSON.stringify(['Bremsen & Fahrwerk','Bremsen & Fahrwerk','Motor & Getriebe']));assert.deepEqual(submittedReviewServices(f),['Bremsen & Fahrwerk','Motor & Getriebe'],'The explicit list is authoritative and deduplicated');
 const review={service:'Bremsen & Fahrwerk',services:['Bremsen & Fahrwerk','Motor & Getriebe']};assert.equal(reviewServicesLabel('en',review),'Brakes & suspension · Engine & transmission');assert(reviewServicesLabel('sq',review).includes(' · '));
 for(const invalid of ['{}','[]','[null]','[7]'])assert.throws(()=>decodeReviewServices('Fixture',invalid));
 for(const prefix of ['','/sq','/en']){const base=prefix+'/werkstatt/fixture?suche=%2Fwerkstaetten%3Fort%3Dpeja';const open=reviewDialogHref(base,true);assert(reviewDialogRequested(open));assert.equal(reviewDialogHref(open,false),base,'Closing preserves locale and the search return');assert(reviewDialogRequested(base+'#bewerten'),'Legacy login links remain valid');}
 console.log('Review services: legacy migration, validated arrays, deduplication, localization and dialog URL preservation passed');
}finally{db.close();}
