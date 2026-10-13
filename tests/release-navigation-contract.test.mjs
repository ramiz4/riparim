import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdir,writeFile} from 'node:fs/promises';
import {navigationPlanner} from '../node_modules/vinext/dist/server/navigation-planner.js';

const out=new URL('../.test-runtime/release-navigation/',import.meta.url);
await mkdir(out,{recursive:true});
const compatibilityId='fixture-build-compatibility';
const bundle=await build({entryPoints:['lib/release-rsc.ts'],bundle:true,format:'esm',platform:'node',write:false,define:{'process.env.__VINEXT_RSC_COMPATIBILITY_ID':JSON.stringify(compatibilityId)}});
await writeFile(new URL('headers.mjs',out),bundle.outputFiles[0].contents);
const {setReleaseRscHeaders}=await import(new URL('headers.mjs',out));
function decision(headers,clientCompatibilityId=compatibilityId){
 return navigationPlanner.classifyRscFetchResult({source:'live',currentHref:'https://riparim.example.test/en/settings',origin:'https://riparim.example.test',effectiveHistoryUpdateMode:'push',redirectDepth:0,requestPreviousNextUrl:null,clientCompatibilityId,responseOk:true,isRscContentType:headers.get('Content-Type')?.startsWith('text/x-component'),hasBody:true,compatibilityIdHeader:headers.get('X-Vinext-RSC-Compatibility-Id'),responseUrl:'https://riparim.example.test/en/settings?_rsc',streamedRedirectTarget:null});
}
for(const path of ['/en/settings?weiter=%2Fen%2Fworkshops&_rsc=fixture','/sq/serviset?ort=prizren&_rsc=fixture','/werkstatt/fixture?_rsc=fixture']){
 const request=new Request('https://riparim.example.test'+path),headers=new Headers();
 setReleaseRscHeaders(headers,request);
 assert.equal(decision(headers).kind,'proceedToCommit','A release RSC response must pass the actual router compatibility check without document reload');
 assert.equal(headers.get('X-Vinext-RSC-Compatibility-Id'),compatibilityId);
 const url=new URL(request.url);url.searchParams.delete('_rsc');
 assert.equal(decodeURIComponent(headers.get('X-Vinext-Rendered-Path-And-Search')),url.pathname+url.search);
 assert.equal(decision(headers,'older-build').kind,'hardNavigate','A genuinely different build still reloads safely');
 headers.delete('X-Vinext-RSC-Compatibility-Id');
 assert.equal(decision(headers).kind,'hardNavigate','This regression catches the formerly missing response header');
}
console.log('Release RSC: actual router accepts matching builds, preserves request context and rejects incompatible/missing builds');
