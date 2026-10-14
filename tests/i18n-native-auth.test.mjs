import {localizeHref} from '../scripts/lib/locale.mjs';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdir,writeFile} from 'node:fs/promises';
const out='.test-runtime/i18n-native-auth.mjs';
const bundle=await build({entryPoints:['build/sites-vite-plugin.ts'],bundle:true,write:false,format:'esm',platform:'node',packages:'external'});await mkdir('.test-runtime',{recursive:true});await writeFile(out,bundle.outputFiles[0].contents);
const {sites}=await import(new URL('../'+out,import.meta.url));let middleware;
const plugin=sites({mockAuth:true});plugin.configureServer({config:{server:{},logger:{info(){}}},middlewares:{use(fn){middleware=fn;}}});
function request(path,{host='127.0.0.1:5178',address='127.0.0.1',headers={},method='GET'}={}){
 const req={url:path,method,headers:{host,...headers},rawHeaders:Object.entries({host,...headers}).flat(),socket:{remoteAddress:address}};
 const values=new Map();let ended=false,next=false,body='';const res={statusCode:200,setHeader(k,v){values.set(k.toLowerCase(),v);},end(value){ended=true;body=value??'';}};
 middleware(req,res,()=>next=true);return {req,status:res.statusCode,headers:values,ended,next,body};
}
for(const locale of ['de','sq','en']){
 const target=localizeHref('/verwaltung?ort=prizren#konto',locale);
 const login=request('/signin-with-chatgpt?return_to='+encodeURIComponent(target));assert.equal(login.status,302);assert.equal(login.headers.get('location'),target);assert.match(login.headers.get('set-cookie'),/__sites_local_auth=1; Path=\/; HttpOnly; SameSite=Lax/);
 const friendly=request('/dev/anmelden?weiter='+encodeURIComponent(target));assert.equal(friendly.status,302);assert.equal(friendly.headers.get('location'),target);assert.match(friendly.headers.get('set-cookie'),/__sites_local_auth=1/);
 const cancel=request('/signout-with-chatgpt?return_to='+encodeURIComponent(localizeHref('/anmelden',locale)));assert.equal(cancel.status,302);assert.equal(cancel.headers.get('location'),localizeHref('/anmelden',locale));assert.match(cancel.headers.get('set-cookie'),/Max-Age=0/);
 const post=request('/signout-with-chatgpt?return_to='+encodeURIComponent(localizeHref('/anmelden',locale)),{method:'POST'});assert.equal(post.status,303);assert.equal(post.headers.get('location'),localizeHref('/anmelden',locale));
}
for(const target of ['/dev/anmelden','/en/dev/anmelden','/dev/%61nmelden','//outside.test','/\\outside.test','/en/callback','/sq/auth/bestaetigen?token_hash=secret','/en/signin-with-chatgpt','/en/%63allback','/%5coutside.test'])assert.equal(request('/signin-with-chatgpt?return_to='+encodeURIComponent(target)).headers.get('location'),'/','Native return boundary rejects external/encoded/prefixed loops');
const forged=request('/en',{headers:{'oai-authenticated-user-id':'forged','oai-authenticated-user-email':'forged@example.test'}});assert(forged.next);assert(!Object.keys(forged.req.headers).some(k=>k.startsWith('oai-authenticated-user-')));assert(!forged.req.rawHeaders.includes('forged'));
assert.equal(request('/signin-with-chatgpt',{host:'riparim.com'}).status,403);assert.equal(request('/signin-with-chatgpt',{address:'192.0.2.1'}).status,403);assert.equal(request('/signin-with-chatgpt',{headers:{origin:'https://other.test'}}).status,403);
const prefetch=request('/signin-with-chatgpt?return_to=/en',{headers:{'next-router-prefetch':'1'}});assert.equal(prefetch.status,204);assert(!prefetch.headers.has('set-cookie'));
assert.equal(request('/en/signin-with-chatgpt').next,true,'Prefixed native endpoints are not executed by the simulation');
assert.equal(request('/dev/anmelden').headers.get('location'),'/einstellungen');
for(const options of [{host:'riparim.com'},{address:'192.0.2.1'},{headers:{origin:'https://other.test'}}])assert.equal(request('/dev/anmelden',options).status,403);
assert.equal(request('/dev/anmelden',{method:'POST'}).status,405);assert.equal(request('/dev/anmelden',{headers:{'next-router-prefetch':'1'}}).status,204);assert.equal(request('/dev/anmelden?weiter=%2Fdev%2Fanmelden').headers.get('location'),'/');
const seed=request('/api/account',{headers:{cookie:'__sites_local_auth=1'}});
assert(request('/api/account',{headers:{cookie:'__sites_local_auth=1; other-app-preference=fixture'}}).ended,'Unrelated browser preferences do not hide the local seed account');
assert(seed.ended&&!seed.next);assert.equal(seed.headers.get('cache-control'),'private, no-store');assert.deepEqual(JSON.parse(seed.body),{account:{email:'seedy@sites.test',name:'Seedy',provider:'ChatGPT',protected:true},deletionReady:false,deletionStarted:false,preview:true});
for(const options of [{},{headers:{cookie:'__sites_local_auth=0'}},{headers:{cookie:'__sites_local_auth=1; sb-fixture-auth-token=fixture'}},{headers:{cookie:'__sites_local_auth=1; riparim-auth-fixture=fixture'}},{headers:{cookie:'__sites_local_auth=1; riparim-pb-fixture-session=fixture'}},{headers:{cookie:'__sites_local_auth=1; __sites_local_auth=1'}},{host:'riparim.com',headers:{cookie:'__sites_local_auth=1'}},{address:'192.0.2.1',headers:{cookie:'__sites_local_auth=1'}}])assert(request('/api/account',options).next,'Account fixtures require the signed-in loopback boundary');
for(const method of ['PATCH','POST','DELETE'])assert(request('/api/account',{method,headers:{cookie:'__sites_local_auth=1'}}).next,'The account fixture never simulates successful provider mutations');
process.stdout.write('Local native Auth: all locale returns, loop/external guards, host/socket/header stripping and prefetch suppression passed\n');
