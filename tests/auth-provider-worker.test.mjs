import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {Miniflare} from 'miniflare';

const origin='https://fixture-project.supabase.co';
const {outputFiles}=await build({stdin:{contents:`import {providerFetch} from './lib/auth/origin';export default {async fetch(request){const mode=new URL(request.url).pathname;try{const response=await providerFetch('${origin}')(mode==='/untrusted'?'https://outside.example/auth/v1/user':'${origin}/auth/v1'+mode,{headers:{authorization:'Bearer fixture-token',apikey:'fixture-public-key'}});return Response.json(await response.json());}catch(error){return Response.json({error:error.message},{status:503});}}};`,resolveDir:process.cwd(),loader:'ts'},bundle:true,write:false,format:'esm',platform:'node',external:['cloudflare:workers']});
let calls=0;
const runtime=new Miniflare({modules:true,script:outputFiles[0].text,compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],outboundService:request=>{
 const url=new URL(request.url);assert.equal(url.origin,origin,'Credentials never reach an untrusted redirect destination');
 assert.equal(request.headers.get('authorization'),'Bearer fixture-token');assert.equal(request.headers.get('apikey'),'fixture-public-key');calls++;
 return url.pathname.endsWith('/redirect')?new Response(null,{status:307,headers:{location:'https://outside.example/auth/v1/user'}}):Response.json({fixture:true});
}});
try{
 const healthy=await runtime.dispatchFetch('https://riparim.example.test/user');
 assert.equal(healthy.status,200,'Native Workers fetch must reach the configured auth provider');assert.deepEqual(await healthy.json(),{fixture:true});assert.equal(calls,1);
 const redirect=await runtime.dispatchFetch('https://riparim.example.test/redirect');
 assert.equal(redirect.status,503);assert.deepEqual(await redirect.json(),{error:'AUTH_PROVIDER_REDIRECT'});assert.equal(calls,2,'Redirect rejected after one request, without following it');
 const untrusted=await runtime.dispatchFetch('https://riparim.example.test/untrusted');
 assert.equal(untrusted.status,503);assert.deepEqual(await untrusted.json(),{error:'UNTRUSTED_AUTH_REQUEST'});assert.equal(calls,2);
 console.log('Native Auth transport: supported redirect mode, healthy provider access and no credential forwarding passed');
}finally{await runtime.dispose();}
