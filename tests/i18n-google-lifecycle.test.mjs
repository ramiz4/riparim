import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdir,writeFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
const dom=new JSDOM('<html lang="de"><body><div id="root"></div></body></html>',{url:'https://riparim.example.test',pretendToBeVisual:true});
for(const key of ['window','document','navigator','HTMLElement'])Object.defineProperty(globalThis,key,{value:dom.window[key],configurable:true});globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const result=await build({stdin:{contents:`import React from 'react';import {useGoogleWorkshopProfile} from './components/use-google-workshop-profile';import {useGoogleVisibility} from './components/use-google-visibility';export {I18nProvider} from './lib/i18n/client';export {getMessages} from './lib/i18n/messages';export function Probe(){const a=useGoogleWorkshopProfile('fixture-workshop'),b=useGoogleWorkshopProfile('fixture-workshop'),visibility=useGoogleVisibility();React.useEffect(()=>{if(visibility.canLoad){const releaseA=a.requestIdentity(visibility.isVisible),releaseB=b.requestIdentity(visibility.isVisible);return()=>{releaseA();releaseB();};}},[a.requestIdentity,b.requestIdentity,visibility.canLoad,visibility.isVisible]);return <div ref={visibility.ref} data-profile={a.identity?.placeId??''} data-profile-status={a.status} data-rating={b.identity?.placeId??''} data-rating-status={b.status}/>;}`,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,format:'esm',platform:'node',packages:'external',external:['react','react/jsx-runtime']});
await mkdir('.test-runtime',{recursive:true});await writeFile('.test-runtime/i18n-google-lifecycle.mjs',result.outputFiles[0].text);
const {I18nProvider,getMessages,Probe}=await import(new URL('../.test-runtime/i18n-google-lifecycle.mjs',import.meta.url));
const React=await import('react'),{createRoot}=await import('react-dom/client'),root=createRoot(document.getElementById('root'));
const requests=[];
const nativeFetch=globalThis.fetch;globalThis.fetch=async(url)=>{
 requests.push(String(url));if(url==='/api/google-places')return Response.json({enabled:true,browserKey:'fixture-key'});
 if(url==='/api/google-places/fixture-workshop')return Response.json({placeId:'ChIJFixture'});
 throw Error('Profile must not start a duplicate individual provider call');
};
const render=async(locale)=>{document.documentElement.lang=locale;await React.act(async()=>{root.render(React.createElement(I18nProvider,{locale,messages:getMessages(locale,['common'])},React.createElement(Probe)));await new Promise(resolve=>setTimeout(resolve,0));});};
const probe=()=>document.querySelector('[data-profile]');
try{
 await render('de');assert.equal(probe().dataset.profile,'ChIJFixture');
 await render('sq');await React.act(async()=>new Promise(resolve=>setTimeout(resolve,0)));
 assert.equal(probe().dataset.profile,'ChIJFixture','new locale retains the same canonical identity without a provider profile request');assert.equal(probe().dataset.rating,'ChIJFixture','both consumers share only canonical identity');
 assert.equal(requests.filter(url=>url==='/api/google-places/fixture-workshop').length,1,'canonical identity is shared and independent of locale');
 assert.equal(probe().dataset.profileStatus,'ready');assert.equal(probe().dataset.ratingStatus,'ready');

}finally{await React.act(async()=>root.unmount());globalThis.fetch=nativeFetch;dom.window.close();}
console.log('Shared Google identity lifecycle: locale-safe identity passed without live provider calls');
