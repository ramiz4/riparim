import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdir,writeFile} from 'node:fs/promises';
const out=new URL('../.test-runtime/i18n-routing/',import.meta.url);
await mkdir(out,{recursive:true});
const result=await build({entryPoints:['proxy.ts'],bundle:true,format:'esm',platform:'node',write:false,plugins:[{name:'request-boundary',setup(builder){
 builder.onResolve({filter:/^@\/db\/directory$/},args=>({path:args.path,namespace:'catalogue-fixture'}));
 builder.onLoad({filter:/.*/,namespace:'catalogue-fixture'},()=>({loader:'js',contents:`export async function publishedWorkshop(id){globalThis.fixtureProfileReads=(globalThis.fixtureProfileReads??0)+1;if(globalThis.fixtureCatalogueUnavailable)throw Error('Catalogue unavailable');return id==='unknown-profile'||id==='draft-profile'?null:{id};}`}));
 builder.onResolve({filter:/^(next\/server|@\/lib\/auth\/config|@\/lib\/auth\/provider)$/},args=>({path:args.path,namespace:'fixture'}));
 builder.onLoad({filter:/.*/,namespace:'fixture'},args=>({loader:'js',contents:args.path==='next/server'?`function response(headers={},status){const value=new Response(null,{headers,status});value.cookies={set:(name,cookie)=>value.headers.append('Set-Cookie',name+'='+cookie)};return value;}export const NextResponse={next:init=>response({},init?.status),rewrite:(url,init)=>response({'x-middleware-rewrite':String(url)},init?.status),redirect:(url,status)=>new Response(null,{status,headers:{Location:String(url)}})};`:args.path==='@/lib/auth/config'?`export async function getAuthConfig(){if(globalThis.fixtureDatabaseUnavailable)throw Error("Auth database unavailable");return globalThis.fixtureAuth??null;}`:`export function createAuthClient(config,cookies){return {auth:{async getUser(){cookies.setAll([{name:'fixture-session',value:'renewed',options:{}}]);}}};}`}));
 }}]});
await writeFile(new URL('proxy.mjs',out),result.outputFiles[0].text);
const {proxy}=await import(new URL('proxy.mjs',out));
const request=path=>({url:'https://riparim.com'+path,headers:new Headers({'x-riparim-locale':'en'}),cookies:{getAll:()=>[],set(){}}});
for(const enabled of [false,true]){
 globalThis.fixtureAuth=enabled?{enabled:true,projectUrl:'https://fixture.example',publicKey:'fixture'}:null;
 for(const path of ['/', '/werkstaetten?ort=prizren&sprache=sq', '/werkstatt/test-profile']){
  const response=await proxy(request(path));
  assert.equal(response.status,200,'Published profiles and other pages remain successful');
  assert.equal(response.headers.get('x-middleware-rewrite'),'https://riparim.com/de'+(path==='/'?'':path),'German pages receive an internal native locale rewrite');
  assert.equal(response.headers.get('Cache-Control'),'private, no-store');
  assert.equal(response.headers.get('X-Content-Type-Options'),'nosniff');
  if(enabled)assert.match(response.headers.get('Set-Cookie'),/fixture-session=renewed/,'Cookie refresh retains the rewrite');
 }
 for(const [prefix,route] of [['','werkstatt'],['/sq','servis'],['/en','workshop']])for(const id of ['unknown-profile','draft-profile','x']){
  const reads=globalThis.fixtureProfileReads??0;
  const response=await proxy(request(`${prefix}/${route}/${id}?_rsc=fixture`));
  assert.equal(response.status,404,'Missing, unpublished and invalid profiles retain HTTP 404');
  assert.equal(response.headers.get('x-middleware-rewrite'),`https://riparim.com/${prefix.slice(1)||'de'}/werkstatt/${id}?_rsc=fixture`,'404 still renders the localized route boundary');
  assert.equal(response.headers.get('Cache-Control'),'private, no-store');
  if(id==='x')assert.equal(globalThis.fixtureProfileReads??0,reads,'Invalid IDs skip catalogue reads');
  if(enabled)assert.match(response.headers.get('Set-Cookie'),/fixture-session=renewed/,'Cookie refresh retains the 404 status and rewrite');
 }
}
for(const [path,identity] of [['/en/workshops','/en/werkstaetten'],['/sq/serviset','/sq/werkstaetten'],['/en/workshop/test-id','/en/werkstatt/test-id'],['/sq/servis/test-id','/sq/werkstatt/test-id'],['/en/login','/en/anmelden'],['/sq/biznesi/kerko-pronesine','/sq/betrieb/beanspruchen'],['/en/admin/users','/en/verwaltung/benutzer']]){
 const response=await proxy(request(path+'?ort=prizren'));
 assert.equal(response.headers.get('x-middleware-rewrite'),'https://riparim.com'+identity+'?ort=prizren','Translated browser paths resolve the existing page tree');
 assert.match(response.headers.get('Set-Cookie'),/fixture-session=renewed/,'Session renewal preserves localized rewrites');
}
for(const [path,target] of [['/en/werkstaetten','/en/workshops'],['/sq/werkstatt/test-id','/sq/servis/test-id'],['/en/betrieb/beanspruchen','/en/business/claim'],['/sq/verwaltung/benutzer','/sq/administrimi/perdoruesit']]){
 const response=await proxy(request(path+'?werkstatt=test-id'));
 assert.equal(response.status,308);assert.equal(response.headers.get('Location'),'https://riparim.com'+target+'?werkstatt=test-id');
}
for(const path of ['/sq','/en','/api/account','/auth/bestaetigen?token_hash=fixture','/signin-with-chatgpt','/callback','/__sites_connector_preview/invoke','/_next/test','/favicon.svg','/robots.txt','/sitemap.xml'])assert.equal((await proxy(request(path))).headers.get('x-middleware-rewrite'),null,path+' is not rewritten');
for(const path of ['/de','/de/werkstaetten?ort=prizren']){const response=await proxy(request(path));assert.equal(response.status,308);assert.equal(response.headers.get('Location'),'https://riparim.com'+(path==='/de'?'/':path.slice(3)));}
for(const path of ['/sq/missing.html','/en/missing.txt','/sq/missing.svg','/en/missing.png','/fr/missing.png','/missing.html','/missing.png']){const response=await proxy(request(path));assert.equal(response.status,404,path+' cannot bypass locale-page404 via a dotted suffix');assert.equal(response.headers.get('X-Content-Type-Options'),'nosniff');}
globalThis.fixtureDatabaseUnavailable=true;
try{const response=await proxy(request('/riparim-icon-display.png'));assert.equal(response.status,200,'actual static file does not depend on auth database availability');assert.equal(response.headers.get('x-middleware-rewrite'),null);}finally{globalThis.fixtureDatabaseUnavailable=false;}
globalThis.fixtureCatalogueUnavailable=true;
try{
 await assert.rejects(proxy(request('/werkstatt/test-profile')),/Catalogue unavailable/,'Catalogue errors are not disguised as missing profiles');
 for(const path of ['/api/workshops','/werkstaetten','/riparim-icon-display.png'])assert.equal((await proxy(request(path))).status,200,'Other routes do not query profile availability');
}finally{globalThis.fixtureCatalogueUnavailable=false;}
console.log('Locale proxy: native DE rewrite, public normalization, technical exclusions, security headers and refreshed cookies passed');
