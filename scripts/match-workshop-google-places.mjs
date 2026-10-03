import {readFile,writeFile,rename,rm,mkdir} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {parseArgs} from 'node:util';
import {build} from 'esbuild';

const root=fileURLToPath(new URL('../',import.meta.url));
const {values}=parseArgs({options:{fetch:{type:'boolean',default:false},write:{type:'boolean',default:false},limit:{type:'string',default:'100'}}});
const limit=Number(values.limit);
if(!Number.isInteger(limit)||limit<1||limit>100)throw Error('limit muss zwischen 1 und 100 liegen');
if(values.write&&!values.fetch)throw Error('--write benötigt --fetch');
const runtime=resolve(root,'.sites-runtime/catalogue-google');await mkdir(runtime,{recursive:true});
await build({absWorkingDir:root,entryPoints:['lib/workshop-source.ts','lib/google-place-identity.ts'],outdir:runtime,bundle:true,platform:'node',format:'esm',outExtension:{'.js':'.mjs'}});
const {validateWorkshopCatalogue,catalogueStats}=await import(pathToFileURL(resolve(runtime,'workshop-source.mjs')));
const {verifiedGooglePlace}=await import(pathToFileURL(resolve(runtime,'google-place-identity.mjs')));
const path=resolve(root,'data/workshops.json');
const catalogue=validateWorkshopCatalogue(JSON.parse(await readFile(path,'utf8'))),now=Date.now();
const pending=catalogue.workshops.filter(w=>w.status==='published'&&(!w.google.placeId||now-Date.parse(w.google.matchedAt)>365*86400000));
if(!values.fetch){
 console.log(JSON.stringify({mode:'plan',published:catalogue.coverage.published,pendingProfiles:pending.length,distinctPhoneQueries:new Set(pending.map(w=>w.phone)).size,limit,apiRequests:0,persistedGoogleFields:['placeId','matchedAt']},null,2));
}else{
 const key=(process.env.GOOGLE_PLACES_SERVER_API_KEY??'').trim();
 if(!key)throw Error('GOOGLE_PLACES_SERVER_API_KEY ist nicht eingerichtet; keine Google-Abfrage ausgeführt');
 const responses=new Map(),matched=[],unmatched=[],errors=[];let requests=0;
 for(const workshop of pending){
  if(!responses.has(workshop.phone)){
   if(requests>=limit)break;requests++;
   try{
    const response=await fetch('https://places.googleapis.com/v1/places:searchText',{method:'POST',headers:{'Content-Type':'application/json','X-Goog-Api-Key':key,'X-Goog-FieldMask':'places.id,places.displayName,places.formattedAddress,places.addressComponents,places.location,places.internationalPhoneNumber'},body:JSON.stringify({textQuery:workshop.phone,languageCode:'de',regionCode:'XK',pageSize:20}),signal:AbortSignal.timeout(12000)});
    if(!response.ok){responses.set(workshop.phone,null);errors.push({workshopId:workshop.id,status:response.status});if(response.status===401||response.status===403||response.status===429)break;continue;}
    const body=await response.json();responses.set(workshop.phone,Array.isArray(body.places)?body.places:[]);
   }catch{responses.set(workshop.phone,null);errors.push({workshopId:workshop.id,status:'unavailable'});continue;}
  }
  const candidates=responses.get(workshop.phone);if(!candidates)continue;
  const id=verifiedGooglePlace(workshop,candidates);
  if(!id){unmatched.push(workshop.id);continue;}
  const other=catalogue.workshops.find(w=>w.id!==workshop.id&&w.google.placeId===id);
  if(other){errors.push({workshopId:workshop.id,status:'place-id-conflict'});continue;}
  workshop.google.placeId=id;workshop.google.matchedAt=new Date().toISOString();matched.push(workshop.id);
 }
 const stats=catalogueStats(catalogue.workshops);
 catalogue.googleImport={status:stats.pendingPublishedMatches===0?'completed':stats.matchedPlaceIds>0?'partial':'not_started',reason:errors.length?'lookup_errors':stats.pendingPublishedMatches?'unmatched_profiles':null,matchedPlaceIds:stats.matchedPlaceIds,numericSnapshotRatings:stats.numericSnapshotRatings,pendingPublishedMatches:stats.pendingPublishedMatches};
 catalogue.updatedAt=new Date().toISOString();validateWorkshopCatalogue(catalogue);
 if(values.write&&matched.length){const temporary=path+'.tmp';try{await writeFile(temporary,JSON.stringify(catalogue,null,2)+'\n',{flag:'wx'});await rename(temporary,path);}finally{await rm(temporary,{force:true});}}
 console.log(JSON.stringify({mode:values.write?'write':'fetch-only',requests,matched,unmatched,errors,pendingPublishedMatches:stats.pendingPublishedMatches,persistedGoogleFields:['placeId','matchedAt']},null,2));
 if(errors.length)process.exitCode=1;
}
