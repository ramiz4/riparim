import {localizeHref} from '../scripts/lib/locale.mjs';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {Miniflare} from 'miniflare';
const config=JSON.parse(await readFile('dist/server/wrangler.json','utf8'));
if(config.name==='riparim'){
 const manifest=JSON.parse(await readFile('dist/public-release.json','utf8'));
 const canonical=JSON.parse(await readFile('data/workshops.json','utf8'));
 const published=canonical.workshops.filter(w=>w.status==='published');
 assert.equal(manifest.pages,3*(published.length+3));assert.equal(manifest.privateData,false);assert.equal(manifest.privacyVariants,3);
 const modules=(await readdir('dist/server',{recursive:true})).filter(file=>file.endsWith('.js')).sort((a,b)=>a==='index.js'?-1:b==='index.js'?1:a.localeCompare(b)).map(file=>({type:'ESModule',path:resolve('dist/server',file)}));
 let providerCalls=0;
 const runtime=new Miniflare({modules,modulesRoot:resolve('dist/server'),compatibilityDate:config.compatibility_date,compatibilityFlags:config.compatibility_flags,d1Databases:['DB'],r2Buckets:['BUCKET'],bindings:{SITE_ORIGIN:'https://riparim.com'},assets:{directory:resolve('dist/client'),binding:'ASSETS',routerConfig:{has_user_worker:true,static_routing:{user_worker:config.assets.run_worker_first}},assetConfig:{html_handling:config.assets.html_handling}},outboundService:()=>{providerCalls++;return new Response('No external access',{status:502});}});
 try{
  const db=await runtime.getD1Database('DB');
  for(const file of (await readdir('drizzle')).filter(file=>file.endsWith('.sql')).sort())for(const sql of (await readFile('drizzle/'+file,'utf8')).split('--> statement-breakpoint').filter(sql=>sql.trim()))await db.prepare(sql).run();
  const seed=await runtime.dispatchFetch('https://riparim.com/api/workshops');assert.equal(seed.status,200);await seed.text();
  const first=published[0];
  for(const locale of ['de','sq','en'])for(const path of ['/','/datenschutz','/werkstaetten',`/werkstatt/${first.id}`]){
   const response=await runtime.dispatchFetch('https://riparim.com'+localizeHref(path,locale)+'?q=private-secret',{headers:{'oai-authenticated-user-email':'private-user@example.test',cookie:'untrusted=fixture'}});
   assert.equal(response.status,200);assert.equal(response.headers.get('X-Riparim-Public-Snapshot'),'1');assert.equal(response.headers.has('set-cookie'),false);assert.equal(response.headers.get('Cache-Control'),'no-store');
   const html=await response.text();assert(html.includes(`<html lang="${locale}"`));assert(!html.includes('private-secret'));assert(!html.includes('private-user@example.test'));
  }
  await db.prepare("INSERT INTO auth_settings (id,project_url,public_key,enabled,email_delivery_confirmed,updated_at,provider) VALUES ('main','https://auth.fixture.test','',0,0,'fixture','pocketbase')").run();
  for(const locale of ['de','sq','en']){
   const privacy=await runtime.dispatchFetch('https://riparim.com'+localizeHref('/datenschutz',locale)),html=await privacy.text();assert.equal(privacy.status,200);assert.equal(privacy.headers.get('X-Riparim-Public-Snapshot'),'1');assert.equal(privacy.headers.has('set-cookie'),false);assert(html.includes('https://pocketbase.io/docs/authentication/'));assert(!html.includes('https://supabase.com/privacy'),'Even the prebuilt public document names the selected independent provider');
  }
  const head=await runtime.dispatchFetch('https://riparim.com/en/privacy',{method:'HEAD'});assert.equal(head.status,200);assert.equal(await head.text(),'');
  await db.prepare("UPDATE auth_settings SET provider='supabase' WHERE id='main'").run();const rolledBack=await runtime.dispatchFetch('https://riparim.com/en/privacy');assert((await rolledBack.text()).includes('https://supabase.com/privacy'),'Rollback updates the snapshot choice immediately');await db.prepare("DELETE FROM auth_settings WHERE id='main'").run();
  const admin=await runtime.dispatchFetch('https://riparim.com/api/workshops?admin=1');assert.equal(admin.status,401);await admin.text();
  const invalidLocale=await runtime.dispatchFetch('https://riparim.com/api/workshops?locale=fr');assert.equal(invalidLocale.status,400);await invalidLocale.text();
  const anonymous=await runtime.dispatchFetch('https://riparim.com/',{headers:{cookie:'untrusted=fixture'}});const landing=await anonymous.text();assert(!landing.includes(first.description),'The landing document does not serialize the workshop catalogue');
  const hidden=await runtime.dispatchFetch('https://riparim.com/__public/de/werkstaetten.html');assert.equal(hidden.status,404);await hidden.text();
  for(const [path,target] of [['/en/werkstaetten','/en/workshops'],['/sq/werkstatt/'+first.id,'/sq/servis/'+first.id]]){const response=await runtime.dispatchFetch('https://riparim.com'+path+'?ort=prizren',{redirect:'manual'});assert.equal(response.status,308);assert.equal(response.headers.get('Location'),'https://riparim.com'+target+'?ort=prizren');}
  const rsc=await runtime.dispatchFetch('https://riparim.com/en/workshops?_rsc',{headers:{RSC:'1',Accept:'text/x-component'}});assert.match(rsc.headers.get('Content-Type'),/text\/x-component/);assert.equal(rsc.headers.get('X-Riparim-Public-Snapshot'),null);await rsc.text();
  await db.prepare("UPDATE workshops SET description=?,updated_at=? WHERE id=?").bind('Newer approved admin text','2099-01-01T00:00:00.000Z',first.id).run();
  const edited=await runtime.dispatchFetch('https://riparim.com/werkstatt/'+first.id);assert.equal(edited.status,200);assert.equal(edited.headers.get('X-Riparim-Public-Snapshot'),'1');const editedHtml=await edited.text();assert(editedHtml.includes(`data-public-profile-id="${first.id}"`));assert(!editedHtml.includes(first.description),'Changed profile serves a data-free shell');
  await db.prepare("UPDATE workshops SET status='draft' WHERE id=?").bind(first.id).run();
  const unpublished=await runtime.dispatchFetch('https://riparim.com/werkstatt/'+first.id);assert.equal(unpublished.status,404);assert.equal(unpublished.headers.get('X-Riparim-Public-Snapshot'),null);await unpublished.text();
  const directory=await runtime.dispatchFetch('https://riparim.com/werkstaetten');assert.equal(directory.headers.get('X-Riparim-Public-Snapshot'),'1');const html=await directory.text();assert(!html.includes(`data-workshop-id="${first.id}"`));
  const session=await runtime.dispatchFetch('https://riparim.com/api/session',{headers:{'oai-authenticated-user-email':'private-user@example.test'}});assert.equal(session.status,200);assert.deepEqual(await session.json(),{account:null,isAdmin:false});assert.match(session.headers.get('Cache-Control'),/no-store/);
  await db.prepare("INSERT INTO auth_settings (id,project_url,public_key,enabled,email_delivery_confirmed,updated_at) VALUES ('main',?,?,1,1,'2026-10-11')").bind('https://fixture-project.supabase.co','sb_publishable_fixture_public_key_1234567890').run();
  const stale={access_token:'fixture.access.token',refresh_token:'fixture-refresh',expires_at:1,token_type:'bearer',user:{id:'fixture-user'}};
  const cookie='sb-fixture-project-auth-token=base64-'+Buffer.from(JSON.stringify(stale)).toString('base64url');
  for(const path of ['/api/session','/werkstaetten?_rsc','/datenschutz?_rsc']){
   const before=providerCalls,start=performance.now();
   const response=await runtime.dispatchFetch('https://riparim.com'+path,{headers:{cookie,...(path.includes('_rsc')?{RSC:'1',Accept:'text/x-component'}:{})}});
   assert.equal(response.status,200);assert(!response.headers.get('set-cookie'),'Provider outage must not erase session cookies');
   if(path==='/api/session')assert.deepEqual(await response.json(),{account:null,isAdmin:false});else await response.text();
   assert.equal(providerCalls-before,1,'Proxy and RSC/API share the outage state');
   assert(performance.now()-start<2000,'Built Worker handles expired cookies without SDK backoff');
   console.log(JSON.stringify({path,elapsedMs:Math.round(performance.now()-start),providerCalls:providerCalls-before}));
  }
  console.log('Public release: all locales, private isolation, RSC, newer admin edits and immediate unpublishing passed');
 }finally{await runtime.dispose();}
}
