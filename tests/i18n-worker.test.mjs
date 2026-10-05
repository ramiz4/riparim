import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {Miniflare} from 'miniflare';
import {build} from 'esbuild';
const config=JSON.parse(await readFile('dist/server/wrangler.json','utf8'));
const modules=(await readdir('dist/server',{recursive:true})).filter(file=>file.endsWith('.js')).sort((a,b)=>a==='index.js'?-1:b==='index.js'?1:a.localeCompare(b)).map(file=>({type:'ESModule',path:resolve('dist/server',file)}));
const runtime=new Miniflare({modules,modulesRoot:resolve('dist/server'),compatibilityDate:config.compatibility_date,compatibilityFlags:config.compatibility_flags,d1Databases:['DB'],r2Buckets:['BUCKET'],bindings:{SITE_ORIGIN:'https://riparim.test'},assets:{directory:resolve('dist/client'),binding:'ASSETS',routerConfig:{has_user_worker:true}},outboundService:()=>new Response('Live provider access forbidden',{status:502})});
try{
 const db=await runtime.getD1Database('DB');for(const file of (await readdir('drizzle')).filter(file=>file.endsWith('.sql')).sort())for(const statement of (await readFile('drizzle/'+file,'utf8')).split('--> statement-breakpoint').filter(sql=>sql.trim()))await db.prepare(statement).run();
 for(let round=0;round<2;round++)await Promise.all([['/','de','Werkstätten'],['/sq','sq','Servise'],['/en','en','Workshops']].map(async([path,locale,title])=>{
  const response=await runtime.dispatchFetch('https://riparim.test'+path,{headers:{'x-riparim-locale':locale==='de'?'sq':'de'}});assert.equal(response.status,200,path);const html=await response.text();assert.match(html,new RegExp('<html lang="'+locale+'"'));assert.match(html,new RegExp('<title>[^<]*'+title));assert.match(html,new RegExp('<select[^>]*>[\\s\\S]*<option[^>]*value="'+locale+'"[^>]*selected'));
  const rsc=await runtime.dispatchFetch('https://riparim.test'+path+'?ort=prizren&_rsc',{headers:{RSC:'1',Accept:'text/x-component'}});assert.equal(rsc.status,200);assert.match(rsc.headers.get('Content-Type'),/text\/x-component/);assert((await rsc.text()).includes(locale),'RSC uses the route locale');
 }));
 const draft=await db.prepare("SELECT id FROM workshops WHERE status='published' LIMIT 1").first();assert(draft,"isolated catalog has a workshop fixture");
 await db.prepare("UPDATE workshops SET status='draft' WHERE id=?").bind(draft.id).run();
 for(const locale of ["de","sq","en"]){const prefix=locale==="de"?"":`/${locale}`;const response=await runtime.dispatchFetch(`https://riparim.test${prefix}/werkstatt/${draft.id}`);assert.equal(response.status,404,"unpublished profile stays private in "+locale);}
 await db.prepare("UPDATE workshops SET status='published' WHERE id=?").bind(draft.id).run();
 const published=await db.prepare("SELECT id FROM workshops WHERE status='published' LIMIT 1").first();assert(published);
 for(const locale of ["de","sq","en"]){const prefix=locale==="de"?"":`/${locale}`;const response=await runtime.dispatchFetch(`https://riparim.test${prefix}/werkstatt/${published.id}?suche=${encodeURIComponent(prefix+"/werkstaetten?ort=prizren&sprache=sq")}`);assert.equal(response.status,200);assert((await response.text()).includes(`data-workshop-id="${published.id}"`));}
 const www=await runtime.dispatchFetch("http://www.riparim.com/en/werkstaetten?ort=prizren&sprache=sq",{redirect:"manual"});assert.equal(www.status,308);assert.equal(www.headers.get("Location"),"https://riparim.com/en/werkstaetten?ort=prizren&sprache=sq");
 for(const [path,target] of [['/de','/'],['/de/werkstaetten?ort=prizren','/werkstaetten?ort=prizren']]){const response=await runtime.dispatchFetch('https://riparim.test'+path,{redirect:'manual'});assert.equal(response.status,308);assert.equal(new URL(response.headers.get('Location'),'https://riparim.test').href,'https://riparim.test'+target);}
 for(const path of ['/fr','/sq/missing','/en/missing','/werkstatt/unknown-profile','/en/werkstatt/unknown-profile','/sq/werkstatt/x','/sq/missing.html','/en/missing.txt','/sq/missing.svg','/en/missing.png','/fr/missing.png','/missing.html','/missing.png']){const response=await runtime.dispatchFetch('https://riparim.test'+path);assert.equal(response.status,404,path);};
 for(const path of ['/api/workshops','/api/google-places']){const response=await runtime.dispatchFetch('https://riparim.test'+path);assert.equal(response.status,200);assert.match(response.headers.get('Content-Type'),/application\/json/);}
 for(const [locale,login,settings] of [['de','Anmelden','Einstellungen'],['sq','Hyr','Cilësimet'],['en','Log in','Settings']]){
  const prefix=locale==='de'?'':'/'+locale;
  for(const [path,label] of [['/anmelden',login],['/einstellungen',settings]]){
   const response=await runtime.dispatchFetch('https://riparim.test'+prefix+path);assert.equal(response.status,200);const html=await response.text();assert(html.includes(label),'Built private page has active customer copy');assert.match(html,/<meta[^>]*name="robots"[^>]*content="noindex[^">]*nofollow/);assert(!html.includes('hreflang='),'Private customer page has no public alternate');
  }
  const notice=await runtime.dispatchFetch('https://riparim.test'+prefix+'/anmelden?localeNotice=preference_not_saved');const noticeHtml=await notice.text();assert(noticeHtml.includes({de:'Deine Sprachpräferenz konnte nicht gespeichert werden.',sq:'Preferenca jote e gjuhës nuk mund të ruhej.',en:'Your language preference could not be saved.'}[locale]),'Preference failure notice is localized on an actual fresh document');
  for(const query of ['besuche=1','einreichung=11111111-1111-4111-8111-111111111111','nachweis=neu']){
   const response=await runtime.dispatchFetch('https://riparim.test'+prefix+'?'+query);assert.equal(response.status,200);const html=await response.text();assert.match(html,/<meta[^>]*name="robots"[^>]*content="noindex[^">]*nofollow/);assert(!html.includes('hreflang='),'Private landing modes have no alternate deep links');
  }
 }
 const callback=await runtime.dispatchFetch('https://riparim.test/auth/bestaetigen?token_hash=fixture',{redirect:'manual'});assert.equal(callback.status,303);assert.equal(callback.headers.get('Referrer-Policy'),'no-referrer');
 for(const locale of ['de','sq','en'])for(const path of ['/betrieb','/verwaltung','/verwaltung/bewertungen','/verwaltung/benutzer','/verwaltung/betriebe','/verwaltung/anmeldung']){
  const prefix=locale==='de'?'':'/'+locale,response=await runtime.dispatchFetch('https://riparim.test'+prefix+path);assert.equal(response.status,200,'Actual management guest page stays reachable');const html=await response.text();
  assert.match(html,new RegExp('<html lang="'+locale+'"'));assert.match(html,/<meta[^>]*name="robots"[^>]*content="noindex[^">]*nofollow/);assert(!html.includes('hreflang='),'Actual business/administration documents advertise no private alternates');
 }
 for(const file of (await readdir('public')).filter(file=>/\.(?:png|jpg|svg)$/.test(file))){const response=await runtime.dispatchFetch('https://riparim.test/'+file,{redirect:'manual'});assert.equal(response.status,200,'physical unprefixed asset '+file+' stays reachable');}
 // Run Intl in native workerd as well, using the same public formatter/translator.
 const fixture=await build({stdin:{contents:`import {getMessages,createTranslator} from './lib/i18n/messages';import {formatDate,formatNumber} from './lib/i18n/format';export default {fetch(){const t=createTranslator(getMessages('sq',['common']));return Response.json({counts:[0,1,2].map(count=>t('common.reviewCount',{count})),number:formatNumber('sq',1234.5),rounded:formatNumber('sq',9999.9999),date:formatDate('sq','2026-03-29',{dateOnly:true}),timestamp:formatDate('en','2026-10-05T23:30:00Z')});}};`,resolveDir:process.cwd(),loader:'ts'},bundle:true,write:false,format:'esm',platform:'neutral'});
 const intl=new Miniflare({modules:true,script:fixture.outputFiles[0].text,compatibilityDate:config.compatibility_date});try{const value=await(await intl.dispatchFetch('https://fixture.test')).json();assert.deepEqual(value.counts,['0 vlerësime','1 vlerësim','2 vlerësime']);assert.equal(value.date,'29.03.2026');assert.equal(value.timestamp,'06/10/2026');assert.equal(value.number,'1234,5');assert.equal(value.rounded,'10\u00a0000');}finally{await intl.dispose();}
 console.log('Built '+config.name+' Worker: native locale SSR/RSC, simultaneous requests, normalization, 404, APIs/callback/assets and native sq Intl passed');
}finally{await runtime.dispose();}
