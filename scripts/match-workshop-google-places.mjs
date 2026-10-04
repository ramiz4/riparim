import {readFile,writeFile,rename,rm,mkdir} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {parseArgs} from 'node:util';
import {build} from 'esbuild';

const root=fileURLToPath(new URL('../',import.meta.url));
const {values}=parseArgs({options:{links:{type:'boolean',default:false},phone:{type:'boolean',default:false},fetch:{type:'boolean',default:false},write:{type:'boolean',default:false},limit:{type:'string',default:'100'}}});
const limit=Number(values.limit);
if(!Number.isInteger(limit)||limit<1||limit>100)throw Error('limit muss zwischen 1 und 100 liegen');
if(values.write&&!values.fetch)throw Error('--write benötigt --fetch');
const runtime=resolve(root,'.sites-runtime/catalogue-google');await mkdir(runtime,{recursive:true});
await build({absWorkingDir:root,entryPoints:['lib/workshop-source.ts','lib/google-place-identity.ts','lib/google-maps-link.ts'],outdir:runtime,bundle:true,platform:'node',format:'esm',outExtension:{'.js':'.mjs'}});
const {validateWorkshopCatalogue,catalogueStats}=await import(pathToFileURL(resolve(runtime,'workshop-source.mjs')));
const {verifiedGooglePlace,verifiedGooglePlaceFromMapsLink,googleMapsLinkSearchRequest,googlePlaceSearchRequest,normalizeWorkshopPhone}=await import(pathToFileURL(resolve(runtime,'google-place-identity.mjs')));
const {googleMapsPlaceUrl}=await import(pathToFileURL(resolve(runtime,'google-maps-link.mjs')));
const path=resolve(root,'data/workshops.json');
const catalogue=validateWorkshopCatalogue(JSON.parse(await readFile(path,'utf8'))),now=Date.now();
const pending=catalogue.workshops.filter(w=>w.status==='published'&&(!w.google.placeId||now-Date.parse(w.google.matchedAt)>365*86400000));
if(!values.fetch){
 console.log(JSON.stringify({mode:'plan',published:catalogue.coverage.published,pendingProfiles:pending.length,distinctPhoneQueries:new Set(pending.map(w=>w.phone)).size,distinctSearchRequests:new Set(pending.map(w=>JSON.stringify(googlePlaceSearchRequest(w,20)))).size,limit,apiRequests:0,persistedGoogleFields:['placeId','matchedAt']},null,2));
}else{
 const key=(process.env.GOOGLE_PLACES_SERVER_API_KEY??'').trim();
 if(!key)throw Error('GOOGLE_PLACES_SERVER_API_KEY ist nicht eingerichtet; keine Google-Abfrage ausgeführt');
 const responses=new Map(),matched=[],unmatched=[],errors=[];let requests=0;
 for(const workshop of pending){
  const query=JSON.stringify(values.links?googleMapsLinkSearchRequest(workshop):googlePlaceSearchRequest(workshop,5,!values.phone));
  if(!responses.has(query)){
   if(requests>=limit)break;requests++;
   try{
    const response=await fetch('https://places.googleapis.com/v1/places:searchText',{method:'POST',headers:{'Content-Type':'application/json','X-Goog-Api-Key':key,...(process.env.GOOGLE_PLACES_HTTP_REFERRER?{Referer:process.env.GOOGLE_PLACES_HTTP_REFERRER}:{}),'X-Goog-FieldMask':'places.id,places.googleMapsUri,places.primaryType,places.displayName,places.formattedAddress,places.addressComponents,places.location,places.internationalPhoneNumber'},body:query,signal:AbortSignal.timeout(12000)});
    if(!response.ok){responses.set(query,null);errors.push({workshopId:workshop.id,status:response.status});if(response.status===401||response.status===403||response.status===429)break;continue;}
    const body=await response.json(),candidates=Array.isArray(body.places)?body.places:[];
    for(const candidate of candidates){
     if(requests>=limit)break;
     if(!candidate.id||candidate.addressComponents?.some(c=>c.types?.includes('country'))||normalizeWorkshopPhone(candidate.internationalPhoneNumber??'')!==normalizeWorkshopPhone(workshop.phone)||['electric_vehicle_charging_station','car_wash','parking'].includes(candidate.primaryType))continue;
     requests++;
     const details=await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(candidate.id)}`,{headers:{'X-Goog-Api-Key':key,...(process.env.GOOGLE_PLACES_HTTP_REFERRER?{Referer:process.env.GOOGLE_PLACES_HTTP_REFERRER}:{}),'X-Goog-FieldMask':'addressComponents'},signal:AbortSignal.timeout(12000)});
     if(!details.ok){errors.push({workshopId:workshop.id,status:details.status});continue;}
     candidate.addressComponents=(await details.json()).addressComponents;
    }
    responses.set(query,candidates);
   }catch{responses.set(query,null);errors.push({workshopId:workshop.id,status:'unavailable'});continue;}
  }
  const candidates=responses.get(query);if(!candidates)continue;
  const id=values.links?verifiedGooglePlaceFromMapsLink(workshop,candidates):verifiedGooglePlace(workshop,candidates);
  if(!id){unmatched.push(workshop.id);continue;}
  const other=catalogue.workshops.find(w=>w.id!==workshop.id&&w.google.placeId===id);
  if(other){errors.push({workshopId:workshop.id,status:'place-id-conflict'});continue;}
  workshop.google.placeId=id;workshop.google.matchedAt=new Date().toISOString();if(workshop.google.snapshot){workshop.google.snapshot.mapsUrl=googleMapsPlaceUrl(id,`${workshop.name} ${workshop.address}`);workshop.google.snapshot.checkedAt=workshop.google.matchedAt;}matched.push(workshop.id);
 }
 const stats=catalogueStats(catalogue.workshops);
 catalogue.googleImport={status:stats.pendingPublishedMatches===0?'completed':stats.matchedPlaceIds>0?'partial':'not_started',reason:errors.length?'lookup_errors':stats.pendingPublishedMatches?'unmatched_profiles':null,matchedPlaceIds:stats.matchedPlaceIds,numericSnapshotRatings:stats.numericSnapshotRatings,pendingPublishedMatches:stats.pendingPublishedMatches};
 catalogue.updatedAt=new Date().toISOString();validateWorkshopCatalogue(catalogue);
 if(values.write&&matched.length){const temporary=path+'.tmp';try{await writeFile(temporary,JSON.stringify(catalogue,null,2)+'\n',{flag:'wx'});await rename(temporary,path);}finally{await rm(temporary,{force:true});}}
 console.log(JSON.stringify({mode:values.write?'write':'fetch-only',requests,matched,unmatched,errors,pendingPublishedMatches:stats.pendingPublishedMatches,persistedGoogleFields:['placeId','matchedAt']},null,2));
 if(errors.length)process.exitCode=1;
}
