import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdir,writeFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
const out=new URL('../.test-runtime/i18n-google.mjs',import.meta.url);await mkdir(new URL('.',out),{recursive:true});
const result=await build({entryPoints:['lib/google-maps-browser.ts'],bundle:true,format:'esm',platform:'node',write:false});await writeFile(out,result.outputFiles[0].text);
const originalFetch=globalThis.fetch;
try{for(const locale of ['de','sq','en']){
 const dom=new JSDOM(`<html lang="${locale}"><head></head><body></body></html>`,{url:`https://riparim.test/${locale}`});globalThis.window=dom.window;globalThis.document=dom.window.document;
 const browser=await import(out.href+'?locale='+locale),loaded=browser.loadGooglePlaces('fixture-browser-key');
 const script=document.querySelector('script'),url=new URL(script.src);assert.equal(url.searchParams.get('language'),locale,'Google SDK language follows the validated HTML document');assert.equal(url.searchParams.get('region'),'XK');assert.equal(url.searchParams.size,7);
 let requestedLanguage;window.google={maps:{importLibrary:async()=>({Place:class{constructor(options){requestedLanguage=options.requestedLanguage;}async fetchFields(){}}})}};window.__riparimGoogleMapsLoaded();await loaded;await browser.currentGoogleRating('fixture-place','fixture-browser-key');assert.equal(requestedLanguage,locale);
 const requests=[];globalThis.fetch=async(input)=>{requests.push(new URL(String(input)));return Response.json({id:'fixture-place',rating:4,userRatingCount:2});};await browser.currentGoogleProfile('fixture-place','fixture-browser-key');assert.equal(requests.length,1);assert.equal(requests[0].searchParams.get('languageCode'),locale);assert.equal([...requests[0].searchParams.keys()].join(','),'languageCode','No private search or evidence data reaches Google');
 dom.window.close();
}}finally{globalThis.fetch=originalFetch;delete globalThis.window;delete globalThis.document;}
console.log('Google SDK, rating language and profile requests follow DE/SQ/EN HTML locale without private query data');
