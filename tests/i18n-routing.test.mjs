import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdir,writeFile} from 'node:fs/promises';
const out=new URL('../.test-runtime/i18n-routing/',import.meta.url);
await mkdir(out,{recursive:true});
const result=await build({entryPoints:['proxy.ts'],bundle:true,format:'esm',platform:'node',write:false,plugins:[{name:'request-boundary',setup(builder){
 builder.onResolve({filter:/^(next\/server|@\/lib\/auth\/config|@supabase\/ssr)$/},args=>({path:args.path,namespace:'fixture'}));
 builder.onLoad({filter:/.*/,namespace:'fixture'},args=>({loader:'js',contents:args.path==='next/server'?`function response(headers={}){const value=new Response(null,{headers});value.cookies={set:(name,cookie)=>value.headers.append('Set-Cookie',name+'='+cookie)};return value;}export const NextResponse={next:()=>response(),rewrite:url=>response({'x-middleware-rewrite':String(url)}),redirect:(url,status)=>new Response(null,{status,headers:{Location:String(url)}})};`:args.path==='@/lib/auth/config'?`export async function getAuthConfig(){if(globalThis.fixtureDatabaseUnavailable)throw Error("Auth database unavailable");return globalThis.fixtureAuth??null;}`:`export function createServerClient(project,key,options){return {auth:{async getUser(){options.cookies.setAll([{name:'fixture-session',value:'renewed',options:{}}]);}}};}`}));
 }}]});
await writeFile(new URL('proxy.mjs',out),result.outputFiles[0].text);
const {proxy}=await import(new URL('proxy.mjs',out));
const request=path=>({url:'https://riparim.com'+path,headers:new Headers({'x-riparim-locale':'en'}),cookies:{getAll:()=>[],set(){}}});
for(const enabled of [false,true]){
 globalThis.fixtureAuth=enabled?{enabled:true,projectUrl:'https://fixture.example',publicKey:'fixture'}:null;
 for(const path of ['/', '/werkstaetten?ort=prizren&sprache=sq', '/werkstatt/test-profile']){
  const response=await proxy(request(path));
  assert.equal(response.headers.get('x-middleware-rewrite'),'https://riparim.com/de'+(path==='/'?'':path),'German pages receive an internal native locale rewrite');
  assert.equal(response.headers.get('Cache-Control'),'private, no-store');
  assert.equal(response.headers.get('X-Content-Type-Options'),'nosniff');
  if(enabled)assert.match(response.headers.get('Set-Cookie'),/fixture-session=renewed/,'Cookie refresh retains the rewrite');
 }
}
for(const path of ['/sq','/en/werkstaetten','/api/account','/auth/bestaetigen?token_hash=fixture','/signin-with-chatgpt','/callback','/__sites_connector_preview/invoke','/_next/test','/favicon.svg','/robots.txt','/sitemap.xml'])assert.equal((await proxy(request(path))).headers.get('x-middleware-rewrite'),null,path+' is not rewritten');
for(const path of ['/de','/de/werkstaetten?ort=prizren']){const response=await proxy(request(path));assert.equal(response.status,308);assert.equal(response.headers.get('Location'),'https://riparim.com'+(path==='/de'?'/':path.slice(3)));}
for(const path of ['/sq/missing.html','/en/missing.txt','/sq/missing.svg','/en/missing.png','/fr/missing.png','/missing.html','/missing.png']){const response=await proxy(request(path));assert.equal(response.status,404,path+' cannot bypass locale-page404 via a dotted suffix');assert.equal(response.headers.get('X-Content-Type-Options'),'nosniff');}
globalThis.fixtureDatabaseUnavailable=true;
try{const response=await proxy(request('/riparim-icon-display.png'));assert.equal(response.status,200,'actual static file does not depend on auth database availability');assert.equal(response.headers.get('x-middleware-rewrite'),null);}finally{globalThis.fixtureDatabaseUnavailable=false;}
console.log('Locale proxy: native DE rewrite, public normalization, technical exclusions, security headers and refreshed cookies passed');
