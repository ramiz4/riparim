import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {build} from 'esbuild';

await mkdir('.test-runtime/workshop-source',{recursive:true});
const bundle=await build({entryPoints:['lib/workshop-source.ts'],bundle:true,platform:'node',format:'esm',write:false});
await writeFile('.test-runtime/workshop-source/source.mjs',bundle.outputFiles[0].contents);
const {validateWorkshopCatalogue,catalogueStats,mergeWorkshopCatalogue}=await import(new URL('../.test-runtime/workshop-source/source.mjs',import.meta.url));
const catalogue=validateWorkshopCatalogue(JSON.parse(await readFile('data/workshops.json','utf8')));
const stats=catalogueStats(catalogue.workshops);
assert.equal(stats.published,catalogue.coverage.published);assert.equal(stats.drafts,catalogue.coverage.drafts);assert.equal(stats.numericSnapshotRatings,5);assert.equal(stats.pendingPublishedMatches,catalogue.googleImport.pendingPublishedMatches);assert.equal(stats.matchedPlaceIds,catalogue.googleImport.matchedPlaceIds);
assert.equal(stats.pendingPublishedMatches,0);
const research=JSON.parse(await readFile('data/catalogue-review-2026-10-04.json','utf8'));
const latestResearch=JSON.parse(await readFile('data/catalogue-review-2026-10-05.json','utf8'));
const importManifest=JSON.parse(await readFile('data/import-2026-10-03.json','utf8'));
const expectedCatalogueIds=new Set([...research.draftAssessments.map(proof=>proof.workshopId),...importManifest.importedWorkshopIds,...importManifest.originalPublishedWorkshopIds]);
assert.deepEqual(new Set(catalogue.workshops.map(w=>w.id)),expectedCatalogueIds,'draft review preserves every existing workshop ID and adds no profiles');
const expectedReviewIds=new Set([...research.draftAssessments.filter(proof=>proof.assessment!=='candidate').map(proof=>proof.workshopId),...research.coordinateChecks.filter(proof=>!proof.confirmed).map(proof=>proof.id)]);
assert.equal(latestResearch.reviewedDrafts,85);
assert.equal(latestResearch.draftAssessments.length,85);
assert.deepEqual(new Set(latestResearch.draftAssessments.map(proof=>proof.workshopId)),expectedReviewIds,'each of the 85 existing drafts is assessed exactly once');
assert.deepEqual(latestResearch.before,{published:78,drafts:85});
assert.equal(latestResearch.after.published,stats.published);assert.equal(latestResearch.after.drafts,stats.drafts);
const promotionCount=latestResearch.draftAssessments.filter(proof=>proof.assessment==='published').length;
assert.equal(stats.published,latestResearch.before.published+promotionCount,'all previously public profiles remain published');
assert.equal(stats.drafts,latestResearch.before.drafts-promotionCount);
assert.deepEqual(latestResearch.draftSummary,{published:promotionCount,needsIdentity:latestResearch.draftAssessments.filter(proof=>proof.assessment==='needs_identity').length,excluded:latestResearch.draftAssessments.filter(proof=>proof.assessment==='excluded').length});
for(const proof of latestResearch.draftAssessments){
 const workshop=catalogue.workshops.find(w=>w.id===proof.workshopId);
 assert(['published','needs_identity','excluded'].includes(proof.assessment));
 assert.equal(proof.resultingStatus,proof.assessment==='published'?'published':'draft');
 assert.equal(workshop.status,proof.resultingStatus,'only positively verified drafts are promoted');
 if(proof.assessment==='published'){
  assert(proof.sourceUrls.length>0,'a promotion retains its independent evidence');
  assert.equal(workshop.google.placeId,proof.googleIdentity.placeId);
  for(const check of ['uniqueInCatalogue','sameIndependentPhone','sameIndependentLocation','passengerCarScopeVerified'])assert.equal(proof.googleIdentity[check],true,check);
 }
}
assert.equal(research.reviewedDrafts,92);
assert.equal(research.draftAssessments.length,92);
assert.equal(research.draftAssessments.filter(proof=>proof.assessment==='candidate').length,9);
for(const proof of research.draftAssessments){
 const workshop=catalogue.workshops.find(w=>w.id===proof.workshopId);
 if(proof.assessment==='candidate'){
  assert.equal(workshop.status,'published','historically verified profiles remain public');
  assert.equal(workshop.google.placeId,proof.googleIdentity.placeId);
 }else if(workshop.status==='published')assert.equal(latestResearch.draftAssessments.find(latest=>latest.workshopId===workshop.id).assessment,'published','a historical negative requires a newer positive review');
}
assert.equal(research.coordinateChecks.filter(proof=>proof.confirmed).length,13);
for(const proof of research.coordinateChecks){
 const workshop=catalogue.workshops.find(w=>w.id===proof.id);
 assert(workshop.google.placeId,'location review preserves historical Google identity');
 if(proof.confirmed){assert(workshop.lat!==null&&workshop.lng!==null);assert.deepEqual(workshop.google.verification.sourceUrls,proof.sourceUrls);}
 else{
  const latest=latestResearch.draftAssessments.find(latest=>latest.workshopId===workshop.id);
  if(latest.assessment==='published'){
   const historicalId=new URL(proof.sourceUrls.find(url=>new URL(url).searchParams.has('query_place_id'))).searchParams.get('query_place_id');
   assert.equal(workshop.google.placeId,historicalId,'location corrections preserve the historical Google identity');
   assert(workshop.lat!==null&&workshop.lng!==null,'resolved location conflicts have precise independently sourced coordinates');
   assert(workshop.google.verification.sourceUrls.some(url=>!proof.sourceUrls.includes(url)&&workshop.sources.some(source=>source.url===url)),'location conflict resolution has a new independent profile source');
   assert(Date.parse(workshop.google.matchedAt)>Date.parse(proof.checkedAt),'the resolved identity has a newer confirmation');
  }else{assert.equal(workshop.status,'draft');assert.equal(workshop.lat,null);assert.equal(workshop.lng,null);}
 }
}
assert(catalogue.workshops.filter(w=>w.status==='published').every(w=>w.google.placeId&&w.google.matchedAt),'every public entry has a stable identity independently of ratings');
const publicPlaceIds=catalogue.workshops.filter(w=>w.status==='published').map(w=>w.google.placeId);assert.equal(new Set(publicPlaceIds).size,publicPlaceIds.length,'public profiles have distinct Google identities');
const unconfirmed=structuredClone(catalogue);unconfirmed.workshops.find(w=>w.status==='draft'&&!w.google.placeId).status='published';
assert.throws(()=>validateWorkshopCatalogue(unconfirmed),/bestätigte Google-Zuordnung/);
const trucks=structuredClone(catalogue);trucks.workshops.find(w=>w.id==='auto-ballkan-gjilan').status='published';
assert.throws(()=>validateWorkshopCatalogue(trucks),/Pkw-Werkstatteinträge/);
const mismatchedLink=structuredClone(catalogue);mismatchedLink.workshops.find(w=>w.status==='published').google.snapshot.mapsUrl='https://www.google.com/maps/?query_place_id=ChIJUnrelatedFixture';
assert.throws(()=>validateWorkshopCatalogue(mismatchedLink),/denselben Eintrag/);
const noReviews=catalogue.workshops.find(w=>w.id==='mercedes-service-ballkan-peja');
assert.equal(noReviews.status,'published');assert(noReviews.google.placeId);assert.equal(noReviews.google.snapshot.rating,null);assert.equal(noReviews.google.snapshot.count,null);
assert.equal(catalogue.coverage.complete,false);assert.equal(catalogue.coverage.estimateSource,'user');
assert.deepEqual(stats.sharedPhones,[['eurogoma-gjakova','eurogoma-mitrovica']]);
assert(catalogue.workshops.every(w=>!('rating' in w)&&!('count' in w)),'own reviews remain outside the profile source');
const mita=catalogue.workshops.find(w=>w.id==='auto-mita');
assert.equal(mita.google.snapshot.rating,4.8);assert.equal(mita.google.snapshot.count,null);
const invalid=structuredClone(catalogue);invalid.workshops.push(structuredClone(mita));invalid.coverage.published++;
assert.throws(()=>validateWorkshopCatalogue(invalid),/Doppelte Werkstattkennung/);
const invalidRating=structuredClone(catalogue);invalidRating.workshops.find(w=>w.id===mita.id).google.snapshot.rating=0;
assert.throws(()=>validateWorkshopCatalogue(invalidRating));
const unsupported=structuredClone(mita);unsupported.google.snapshot.sourceUrl=null;
assert.throws(()=>mergeWorkshopCatalogue(catalogue,[unsupported]),/belegte Quelle/);
const ownReview=structuredClone(mita);ownReview.rating=5;
assert.throws(()=>mergeWorkshopCatalogue(catalogue,[ownReview]),/Unrecognized key/);
const repeated=mergeWorkshopCatalogue(catalogue,catalogue.workshops);
assert.equal(repeated.report.added.length,0);assert.equal(repeated.report.updated.length,0);assert.equal(repeated.catalogue.workshops.length,catalogue.workshops.length);
const renamedId={...structuredClone(mita),id:'fixture-copy-of-mita'};
const deduplicated=mergeWorkshopCatalogue(catalogue,[renamedId]);
assert.deepEqual(deduplicated.report.deduplicated,[{incomingId:renamedId.id,keptId:mita.id}]);assert.equal(deduplicated.catalogue.workshops.length,catalogue.workshops.length);
const oldProfile=structuredClone(mita);oldProfile.name='Older fixture profile';oldProfile.updatedAt='2026-09-01T00:00:00Z';
assert.equal(mergeWorkshopCatalogue(catalogue,[oldProfile]).catalogue.workshops.find(w=>w.id===mita.id).name,mita.name);
const googleOnly=structuredClone(mita);googleOnly.google.placeId='ChIJfixtureOnlyTestPlaceId';googleOnly.google.matchedAt=new Date().toISOString();const changedMap=new URL(googleOnly.google.snapshot.mapsUrl);changedMap.searchParams.set('query_place_id',googleOnly.google.placeId);googleOnly.google.snapshot.mapsUrl=changedMap.href;
const googleMerge=mergeWorkshopCatalogue(catalogue,[googleOnly]);
assert.equal(googleMerge.catalogue.workshops.find(w=>w.id===mita.id).google.placeId,googleOnly.google.placeId,'new identity imports without replacing a profile');
const duplicatePlace=structuredClone(googleMerge.catalogue);duplicatePlace.workshops.find(w=>w.id==='sonic-garage').google={...googleOnly.google};duplicatePlace.googleImport.matchedPlaceIds++;
assert.throws(()=>validateWorkshopCatalogue(duplicatePlace),/Doppelte Google-Place-ID/);
const wrongStats=structuredClone(catalogue);wrongStats.coverage.published=1700;
assert.throws(()=>validateWorkshopCatalogue(wrongStats),/Abweichende Bestandszahl/);
const fabricatedComplete=structuredClone(catalogue);fabricatedComplete.coverage.complete=true;
assert.throws(()=>validateWorkshopCatalogue(fabricatedComplete));
// A larger independently sourced fixture uses the same import, with no production writes.
const base=catalogue.workshops.find(w=>w.id==='sonic-garage');
const large=Array.from({length:1700},(_,i)=>({...structuredClone(base),id:`fixture-workshop-${i}`,name:`Fixture workshop ${i}`,status:'draft',phone:`+383490${String(i).padStart(4,'0')}`,google:{placeId:null,matchedAt:null,snapshot:null}}));
const largeImport=mergeWorkshopCatalogue(catalogue,large);
assert.equal(largeImport.report.added.length,1700);assert.equal(largeImport.catalogue.workshops.length,catalogue.workshops.length+1700);
assert.equal(mergeWorkshopCatalogue(largeImport.catalogue,large).report.added.length,0,'repeat bulk import is idempotent');
console.log(JSON.stringify({publicSource:stats.published,draftsPreserved:stats.drafts,reviewedDrafts:latestResearch.reviewedDrafts,duplicateDetection:true,googleRatingsSeparate:true,bulkFixture:1700,actualGoogleRequests:0}));
