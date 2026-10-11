import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {JSDOM} from 'jsdom';
import {localizeHref} from '../scripts/lib/locale.mjs';
import {withWorkerRuntime} from './helpers/worker-runtime.mjs';

const config=JSON.parse(await readFile('dist/server/wrangler.json','utf8'));
const modules=(await readdir('dist/server',{recursive:true})).filter(file=>file.endsWith('.js')).sort((a,b)=>a==='index.js'?-1:b==='index.js'?1:a.localeCompare(b)).map(file=>({type:'ESModule',path:resolve('dist/server',file)}));
await withWorkerRuntime({modules,modulesRoot:resolve('dist/server'),compatibilityDate:config.compatibility_date,compatibilityFlags:config.compatibility_flags,d1Databases:['DB'],r2Buckets:['BUCKET'],bindings:{SITE_ORIGIN:'https://riparim.test'},assets:{directory:resolve('dist/client'),binding:'ASSETS',routerConfig:{has_user_worker:true}},outboundService:()=>new Response('Live provider access forbidden',{status:502})},async(runtime,dispatchFetch)=>{
 const db=await runtime.getD1Database('DB');
 for(const file of (await readdir('drizzle')).filter(file=>file.endsWith('.sql')).sort())for(const sql of (await readFile('drizzle/'+file,'utf8')).split('--> statement-breakpoint').filter(sql=>sql.trim()))await db.prepare(sql).run();
 const modes=[
  ['document',{}],
  ['browser',{headers:{'User-Agent':'Mozilla/5.0',Accept:'text/html'}}],
  ['head',{method:'HEAD'}],
  ['rsc',{headers:{RSC:'1',Accept:'text/x-component'}}],
  ['accept-rsc',{headers:{Accept:'text/x-component'}}],
  ['head-rsc',{method:'HEAD',headers:{RSC:'1',Accept:'text/x-component'}}],
 ];
 for(const locale of ['de','sq','en'])for(const id of ['unknown-profile','x'])for(const [mode,init] of modes){
  const path=localizeHref('/werkstatt/'+id,locale),response=await dispatchFetch('https://riparim.test'+path+(mode.includes('rsc')?'?_rsc=fixture':''),init);
  const body=await response.text();
  assert.equal(response.status,404,path+' '+mode);
  assert.match(response.headers.get('Cache-Control'),/no-store/);
  if(init.method==='HEAD')assert.equal(body,'');
  else if(init.headers?.RSC==='1')assert.match(response.headers.get('Content-Type'),/text\/x-component/,'Navigation keeps the RSC response format: '+path+' '+mode);
  else{
   const dom=new JSDOM(body);
   try{
    const doc=dom.window.document;
    assert.equal(doc.documentElement.lang,locale);
    assert.equal(doc.querySelector('main h1').textContent,{de:'Dieses Profil ist nicht verfügbar.',sq:'Ky profil nuk është i disponueshëm.',en:'This profile is unavailable.'}[locale]);
    assert.equal(doc.querySelector('main a').getAttribute('href'),localizeHref('/',locale),'The error page retains its localized finder link');
    assert.match(doc.querySelector('meta[name="robots"]').content,/noindex/);
   }finally{dom.window.close();}
  }
 }
 const published=await db.prepare("SELECT id FROM workshops WHERE status='published' LIMIT 1").first();assert(published);
 for(const locale of ['de','sq','en'])for(const [,init] of modes){
  const response=await dispatchFetch('https://riparim.test'+localizeHref('/werkstatt/'+published.id,locale),init);
  assert.equal(response.status,200,'Published profiles remain reachable');await response.text();
 }
 await db.prepare("UPDATE workshops SET status='draft' WHERE id=?").bind(published.id).run();
 for(const locale of ['de','sq','en'])for(const [mode,init] of modes){
  const response=await dispatchFetch('https://riparim.test'+localizeHref('/werkstatt/'+published.id,locale),init);
  assert.equal(response.status,404,'Unpublished profile '+locale+' '+mode);await response.text();
 }
 console.log('Built '+config.name+' Worker: localized missing/invalid/unpublished profile 404s, HTML/RSC/HEAD and published profile 200s passed');
});
