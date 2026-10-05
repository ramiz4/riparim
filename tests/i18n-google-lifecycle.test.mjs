import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdir,writeFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
const dom=new JSDOM('<html lang="de"><body><div id="root"></div></body></html>',{url:'https://riparim.example.test',pretendToBeVisual:true});
for(const key of ['window','document','navigator','HTMLElement'])Object.defineProperty(globalThis,key,{value:dom.window[key],configurable:true});globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const result=await build({stdin:{contents:`import React from 'react';import {useGoogleWorkshopProfile} from './components/use-google-workshop-profile';import {useVisibleGooglePlace} from './components/use-google-place';export {I18nProvider} from './lib/i18n/client';export {getMessages} from './lib/i18n/messages';export function Probe(){const a=useGoogleWorkshopProfile('fixture-workshop'),b=useVisibleGooglePlace('fixture-workshop');return <div ref={b.ref} data-profile={a.profile?.rating.rating??''} data-profile-status={a.status} data-rating={b.live?.rating??''} data-rating-status={b.status}/>;}`,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,format:'esm',platform:'node',packages:'external',external:['react','react/jsx-runtime']});
await mkdir('.test-runtime',{recursive:true});await writeFile('.test-runtime/i18n-google-lifecycle.mjs',result.outputFiles[0].text);
const {I18nProvider,getMessages,Probe}=await import(new URL('../.test-runtime/i18n-google-lifecycle.mjs',import.meta.url));
const React=await import('react'),{createRoot}=await import('react-dom/client'),root=createRoot(document.getElementById('root'));
let releaseProfile,releaseRating;const profileGate=new Promise(resolve=>{releaseProfile=resolve;}),ratingGate=new Promise(resolve=>{releaseRating=resolve;});
const requests=[],placeRequests=[];
window.google={maps:{importLibrary:async()=>({Place:class{constructor(options){this.locale=options.requestedLanguage;placeRequests.push(options);}async fetchFields(){if(this.locale==='de')await ratingGate;this.rating=this.locale==='de'?1:4;this.userRatingCount=2;this.attributions=[];}}})}};
const nativeFetch=globalThis.fetch;globalThis.fetch=async(url)=>{
 requests.push(String(url));if(url==='/api/google-places')return Response.json({enabled:true,browserKey:'fixture-key'});
 if(url==='/api/google-places/fixture-workshop')return Response.json({placeId:'ChIJFixture'});
 const locale=new URL(url).searchParams.get('languageCode');if(locale==='de')await profileGate;return Response.json({id:'ChIJFixture',rating:locale==='de'?1:4,userRatingCount:2});
};
const render=async(locale)=>{document.documentElement.lang=locale;await React.act(async()=>{root.render(React.createElement(I18nProvider,{locale,messages:getMessages(locale,['common'])},React.createElement(Probe)));await new Promise(resolve=>setTimeout(resolve,0));});};
const probe=()=>document.querySelector('[data-profile]');
try{
 await render('de');assert(requests.some(url=>url.includes('languageCode=de')));assert.equal(probe().dataset.profile,'');
 await render('sq');await React.act(async()=>new Promise(resolve=>setTimeout(resolve,0)));
 assert.equal(probe().dataset.profile,'4','new locale profile resolves independently of old pending response');assert.equal(probe().dataset.rating,'4','new locale rating resolves independently');
 await React.act(async()=>{releaseProfile();releaseRating();await new Promise(resolve=>setTimeout(resolve,0));});
 assert.equal(probe().dataset.profile,'4','late DE profile cannot overwrite SQ display');assert.equal(probe().dataset.rating,'4','late DE rating cannot overwrite SQ display');
 assert.deepEqual(placeRequests.map(value=>value.requestedLanguage),['de','sq']);assert.equal(requests.filter(url=>url==='/api/google-places/fixture-workshop').length,1,'canonical identity is independent of UI locale');
}finally{releaseProfile();releaseRating();await React.act(async()=>root.unmount());globalThis.fetch=nativeFetch;dom.window.close();}
console.log('Live Google profile/rating lifecycle: locale requests and late-answer guards passed without live provider calls');
