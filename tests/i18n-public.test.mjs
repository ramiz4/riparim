import assert from 'node:assert/strict';
import {build} from 'esbuild';
async function load(file){const result=await build({entryPoints:[file],bundle:true,platform:'node',format:'esm',write:false});return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].contents).toString('base64')}`);}
const {getMessages,createTranslator}=await load('lib/i18n/messages.ts');
for(const [locale,title] of [['de','Dein Auto.'],['sq','Makina jote.'],['en','Your car.']]){
 assert.equal(createTranslator(getMessages(locale))('public.heroCar'),title,'public copy follows the active request locale');
}

const google=await load('lib/google-workshop-profile.ts');
const foreign=google.normalizeGoogleProfile({id:'ChIJFixture',currentOpeningHours:{openNow:false,weekdayDescriptions:['Sonntag: Geschlossen','Monday: 08:00–16:00']}},'ChIJFixture');
assert.equal(google.googleOpeningPresentation(foreign,'ready',new Date('2026-10-04T08:00:00Z')).today,null,'provider weekday text cannot claim a structured today match');
const seo=await load('lib/i18n/public-metadata.ts');
assert.equal(seo.isPrivateLandingMode({besuche:'1'}),true,'private landing visits are noindex');
for(const locale of ['de','sq','en']){
 const metadata=seo.publicMetadata(locale,'/werkstaetten?q=secret&ort=peja#modal','https://example.test',{title:'Fixture',description:'Fixture description'});
 assert.equal(metadata.alternates.canonical,`https://example.test${locale==='de'?'':`/${locale}`}/werkstaetten`);
 assert.deepEqual(metadata.alternates.languages,{de:'https://example.test/werkstaetten',sq:'https://example.test/sq/werkstaetten',en:'https://example.test/en/werkstaetten','x-default':'https://example.test/werkstaetten'});
}
const browser=await load('lib/google-maps-browser.ts');
const nativeFetch=globalThis.fetch,requests=[];
let release;const gate=new Promise(resolve=>{release=resolve;});
globalThis.fetch=async(url,options)=>{requests.push({url,options});await gate;return new Response(JSON.stringify({id:'ChIJFixture'}));};
try{
 const pending=[browser.currentGoogleProfile('ChIJFixture','fixture-key','de'),browser.currentGoogleProfile('ChIJFixture','fixture-key','de'),browser.currentGoogleProfile('ChIJFixture','fixture-key','sq'),browser.currentGoogleProfile('ChIJFixture','fixture-key','en')];
 await Promise.resolve();
 assert.equal(requests.length,3,'provider requests deduplicate by confirmed place AND provider locale');
 release();await Promise.all(pending);
 assert.deepEqual(requests.map(r=>new URL(r.url).searchParams.get('languageCode')).sort(),['de','en','sq']);
}finally{release();globalThis.fetch=nativeFetch;}

for(const [query,expected] of [[{},false],[{besuche:'0'},false],[{einreichung:''},false],[{nachweis:'alt'},false],[{besuche:['0','1']},true],[{einreichung:'private-submission'},true],[{nachweis:'neu'},true]])assert.equal(seo.isPrivateLandingMode(query),expected);
for(const privatePath of ['/anmelden','/registrieren','/einstellungen','/betrieb','/verwaltung','/verwaltung/benutzer']){
 const value=seo.publicMetadata('sq',privatePath,'https://example.test',{title:'Private',description:'Private'});assert.equal(value.robots.index,false);assert.equal(value.alternates,null,'private pages cannot emit public alternatives');
}
const sunday=new Date('2026-10-04T08:00:00Z');
for(const [locale,closedLabel] of [['de','Jetzt geschlossen'],['sq','Mbyllur tani'],['en','Closed now']]){
 const t=createTranslator(getMessages(locale));
 const raw={id:'ChIJFixture',currentOpeningHours:{openNow:false,weekdayDescriptions:['Monday: 09:00–17:00','Sonntag: Geschlossen'],nextOpenTime:'2026-10-05T06:00:00Z',periods:[{open:{day:0,hour:8,minute:0},close:{day:0,hour:16,minute:0}}]}};
 const normalized=google.normalizeGoogleProfile(raw,'ChIJFixture');let result=google.googleOpeningPresentation(normalized,'ready',sunday,locale);
 assert.equal(t(result.label),closedLabel,'openNow, not provider wording, controls local status');assert.equal(result.today,'08:00–16:00','only structured periods yield today interval');assert(result.rows.every(row=>!row.today));assert.deepEqual(result.rows.map(row=>row.day),raw.currentOpeningHours.weekdayDescriptions,'provider fallback descriptions are unchanged');
 const midnight=google.googleOpeningPresentation(normalized,'ready',new Date('2026-10-03T22:30:00Z'),locale);assert.equal(midnight.today,'08:00–16:00','UTC Saturday is Sunday in Kosovo');
 const exception=google.normalizeGoogleProfile({...raw,currentOpeningHours:{openNow:false,weekdayDescriptions:['Holiday closed']},regularOpeningHours:{periods:raw.currentOpeningHours.periods}},'ChIJFixture');assert.equal(google.googleOpeningPresentation(exception,'ready',sunday,locale).today,null,'missing exceptional periods cannot borrow regular today data');
 const overnight=google.normalizeGoogleProfile({...raw,currentOpeningHours:{openNow:true,periods:[{open:{day:6,hour:22,minute:0},close:{day:0,hour:2,minute:0}}]}},'ChIJFixture');assert.equal(google.googleOpeningPresentation(overnight,'ready',sunday,locale).today,'00:00–02:00','week wrap uses structured weekday values');
 const invalid=google.normalizeGoogleProfile({...raw,currentOpeningHours:{periods:[{open:{day:8,hour:8,minute:0},close:{day:0,hour:16,minute:0}}]}},'ChIJFixture');assert.equal(google.googleOpeningPresentation(invalid,'ready',sunday,locale).today,null);
 for(const [date,next] of [['2026-10-24T22:30:00Z','2026-10-26T07:00:00Z'],['2026-03-28T23:30:00Z','2026-03-30T06:00:00Z']]){
  result=google.googleOpeningPresentation({...normalized,hours:{...normalized.hours,nextOpenTime:next}},'ready',new Date(date),locale);assert.equal(result.detail.time,'08:00');assert.equal(result.detail.when,'public.tomorrow','next local calendar day crosses DST correctly');
 }
}
console.log('Public locale/SEO, provider fallback/structured hours, locale-keyed request, midnight and DST contracts passed');
const {publicDataError}=await load('lib/i18n/public-errors.ts');
for(const locale of ['de','sq','en']){
 const t=createTranslator(getMessages(locale));
 assert.equal(publicDataError(t,'unavailable','directory'),t('public.directoryUnavailable'),'stable unavailable codes retain the public source context');
 assert.equal(publicDataError(t,'forbidden','directory'),t('common.forbidden'));
 assert.equal(publicDataError(t,'provider-private-error','directory'),t('common.errorGeneric'),'unknown codes never expose raw errors');
}
