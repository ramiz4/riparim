import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdir,writeFile} from 'node:fs/promises';
const out='.test-runtime/i18n-native-auth.mjs';
const bundle=await build({entryPoints:['build/sites-vite-plugin.ts'],bundle:true,write:false,format:'esm',platform:'node',packages:'external'});await mkdir('.test-runtime',{recursive:true});await writeFile(out,bundle.outputFiles[0].contents);
const {sites}=await import(new URL('../'+out,import.meta.url));let middleware;
const plugin=sites({mockAuth:true});plugin.configureServer({config:{server:{},logger:{info(){}}},middlewares:{use(fn){middleware=fn;}}});
function request(path,{host='127.0.0.1:5178',address='127.0.0.1',headers={},method='GET'}={}){
 const req={url:path,method,headers:{host,...headers},rawHeaders:Object.entries({host,...headers}).flat(),socket:{remoteAddress:address}};
 const values=new Map();let ended=false,next=false;const res={statusCode:200,setHeader(k,v){values.set(k.toLowerCase(),v);},end(){ended=true;}};
 middleware(req,res,()=>next=true);return {req,status:res.statusCode,headers:values,ended,next};
}
for(const locale of ['de','sq','en']){
 const prefix=locale==='de'?'':'/'+locale,target=prefix+'/verwaltung?ort=prizren#konto';
 const login=request('/signin-with-chatgpt?return_to='+encodeURIComponent(target));assert.equal(login.status,302);assert.equal(login.headers.get('location'),target);assert.match(login.headers.get('set-cookie'),/__sites_local_auth=1; Path=\/; HttpOnly; SameSite=Lax/);
 const cancel=request('/signout-with-chatgpt?return_to='+encodeURIComponent(prefix+'/anmelden'));assert.equal(cancel.status,302);assert.equal(cancel.headers.get('location'),prefix+'/anmelden');assert.match(cancel.headers.get('set-cookie'),/Max-Age=0/);
 const post=request('/signout-with-chatgpt?return_to='+encodeURIComponent(prefix+'/anmelden'),{method:'POST'});assert.equal(post.status,303);assert.equal(post.headers.get('location'),prefix+'/anmelden');
}
for(const target of ['//outside.test','/\\outside.test','/en/callback','/sq/auth/bestaetigen?token_hash=secret','/en/signin-with-chatgpt','/en/%63allback','/%5coutside.test'])assert.equal(request('/signin-with-chatgpt?return_to='+encodeURIComponent(target)).headers.get('location'),'/','Native return boundary rejects external/encoded/prefixed loops');
const forged=request('/en',{headers:{'oai-authenticated-user-id':'forged','oai-authenticated-user-email':'forged@example.test'}});assert(forged.next);assert(!Object.keys(forged.req.headers).some(k=>k.startsWith('oai-authenticated-user-')));assert(!forged.req.rawHeaders.includes('forged'));
assert.equal(request('/signin-with-chatgpt',{host:'riparim.com'}).status,403);assert.equal(request('/signin-with-chatgpt',{address:'192.0.2.1'}).status,403);assert.equal(request('/signin-with-chatgpt',{headers:{origin:'https://other.test'}}).status,403);
const prefetch=request('/signin-with-chatgpt?return_to=/en',{headers:{'next-router-prefetch':'1'}});assert.equal(prefetch.status,204);assert(!prefetch.headers.has('set-cookie'));
assert.equal(request('/en/signin-with-chatgpt').next,true,'Prefixed native endpoints are not executed by the simulation');
process.stdout.write('Local native Auth: all locale returns, loop/external guards, host/socket/header stripping and prefetch suppression passed\n');
