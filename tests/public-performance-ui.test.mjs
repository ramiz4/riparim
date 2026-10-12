import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdir} from 'node:fs/promises';
import {JSDOM,VirtualConsole} from 'jsdom';

const dom=new JSDOM('<div id="root"></div>',{url:'https://riparim.example.test/werkstaetten',pretendToBeVisual:true,virtualConsole:new VirtualConsole()});
for(const key of ['window','document','navigator','HTMLElement','HTMLButtonElement','HTMLInputElement','HTMLTextAreaElement','HTMLFormElement','HTMLSelectElement','DocumentFragment','Element','Node','NodeFilter','MutationObserver','CustomEvent','Event','MouseEvent','KeyboardEvent','getComputedStyle'])Object.defineProperty(globalThis,key,{value:dom.window[key],configurable:true});
globalThis.requestAnimationFrame=dom.window.requestAnimationFrame.bind(dom.window);
globalThis.cancelAnimationFrame=dom.window.cancelAnimationFrame.bind(dom.window);
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
globalThis.ResizeObserver=class{observe(){}unobserve(){}disconnect(){}};
globalThis.IntersectionObserver=class{observe(){}disconnect(){}};
window.scrollTo=()=>{};
window.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});
globalThis.fetch=async url=>{assert.equal(url,'/api/google-places');return Response.json({enabled:false});};

const output='.test-runtime/public-performance';await mkdir(output,{recursive:true});
await build({stdin:{contents:`export {default as CatalogueLoading} from './app/[locale]/werkstaetten/loading';export {default as Finder} from './app/finder';export {default as Catalogue} from './app/[locale]/werkstaetten/catalogue';export {I18nProvider} from './lib/i18n/client';export {getMessages,createTranslator} from './lib/i18n/messages';export {defaultCatalogueFilters} from './lib/catalogue-filters';`,resolveDir:process.cwd(),loader:'tsx'},outfile:output+'/ui.mjs',bundle:true,platform:'node',format:'esm',packages:'external',loader:{'.css':'empty'},plugins:[{name:'navigation-fixture',setup(b){
 b.onResolve({filter:/^next\/(link|navigation)$/},args=>({path:args.path,namespace:'fixture'}));
 b.onLoad({filter:/.*/,namespace:'fixture'},args=>({loader:'js',resolveDir:process.cwd(),contents:args.path==='next/link'?`import React from 'react';export default function Link({href,children,...props}){return React.createElement('a',{...props,href},children);}`:`export function useRouter(){return {push(href){globalThis.fixtureNavigations.push(href);},replace(){},refresh(){}};}export function usePathname(){return '/werkstaetten';}export function useSearchParams(){return new URLSearchParams();}`}));
}}]});
const {CatalogueLoading,Finder,Catalogue,I18nProvider,getMessages,createTranslator,defaultCatalogueFilters}=await import(new URL('../'+output+'/ui.mjs',import.meta.url));
const {createElement:h,act}=await import('react'),{renderToStaticMarkup}=await import('react-dom/server'),{createRoot}=await import('react-dom/client');
const workshops=Array.from({length:25},(_,i)=>({id:`fixture-${String(i).padStart(2,'0')}`,name:`Fixture ${String(i).padStart(2,'0')}`,city:'Prishtina',address:'Fixture address',phone:'+38349123456',whatsapp:'',lat:null,lng:null,rating:null,count:0,specialty:'Fixture',description:'Fixture description',services:['Bremsen & Fahrwerk'],serviceDetails:[],brands:['Volvo'],languages:['Deutsch'],sources:[],checkedAt:'2026-10-04',status:'published',googleRating:null}));
const props={initialWorkshops:workshops,initialError:'',account:null,isAdmin:false,initialFilters:defaultCatalogueFilters};
const wrap=(locale,node)=>h(I18nProvider,{locale,messages:getMessages(locale,['common','public'])},node);
const root=createRoot(document.getElementById('root'));
globalThis.fixtureNavigations=[];
try{
 for(const locale of ['de','sq','en']){
  const t=createTranslator(getMessages(locale));
  const loadingLabels={de:'Werkstätten werden geladen …',sq:'Duke ngarkuar serviset …',en:'Loading workshops …'};
  const loadingDom=new JSDOM(renderToStaticMarkup(wrap(locale,h(CatalogueLoading))));
  try{
   const main=loadingDom.window.document.querySelector('main');
   assert.equal(main.querySelectorAll('h1,h2,[class*="placeholder"]').length,0,`${locale}: pending catalogue has no repeated title or skeleton cards`);
   assert.equal(main.textContent,loadingLabels[locale]);
   assert.equal(main.querySelectorAll('[role="status"]').length,1,'One status announces loading without a second English spinner label');
   const status=main.querySelector('[role="status"]');
   assert.equal(status.textContent,t('common.loadingWorkshops'));
   assert.equal(status.querySelector('svg').getAttribute('aria-hidden'),'true','The loading graphic is decorative beside localized text');
   assert.equal(main.querySelectorAll('button,a,input,[tabindex]').length,0,'A passive loading indicator adds no keyboard stop');
  }finally{loadingDom.window.close();}
  for(const Page of [Finder,Catalogue]){
   const ssr=new JSDOM(renderToStaticMarkup(wrap(locale,h(Page,props))));
   try{for(const picker of ssr.window.document.querySelectorAll('[role="combobox"]'))assert(picker.querySelector('[data-slot="select-value"]').textContent.trim(),`${locale}: selected values must be readable before JavaScript loads`);}finally{ssr.window.close();}
  }
  const pendingDom=new JSDOM(renderToStaticMarkup(wrap(locale,h(Catalogue,{...props,publicSnapshot:true,initialWorkshops:[]}))));
  try{
   const main=pendingDom.window.document.querySelector('main');
   const status=[...main.querySelectorAll('[role="status"]')].find(node=>node.textContent===loadingLabels[locale]);
   assert(status,'The catalogue live-data loading state uses localized status text');
   assert.equal(status.querySelector('svg').getAttribute('aria-hidden'),'true');
   assert.equal(status.querySelectorAll('[role="status"]').length,0,'The shared graphic creates no nested status announcement');
  }finally{pendingDom.window.close();}
  await act(async()=>root.render(wrap(locale,h(Finder,props))));
  const form=document.querySelector('.search-box'),before=fixtureNavigations.length;
  await act(async()=>{form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));});
  assert.equal(fixtureNavigations.length,before+1,'Rapid repeated submission starts only one navigation');
  assert.equal(fixtureNavigations.at(-1),locale==='de'?'/werkstaetten':locale==='sq'?'/sq/serviset':'/en/workshops');
  const immediateStatus=document.querySelector('main [role="status"]');
  assert.equal(immediateStatus?.textContent,loadingLabels[locale],'Search responds before the router returns any data');
  assert(!document.querySelector('.landing-hero'),'Pending navigation immediately shows the destination loading view');
  assert.equal(document.activeElement,document.querySelector('main'),'Keyboard focus follows the immediate loading view');
  await act(async()=>form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
  assert.equal(fixtureNavigations.length,before+1,'Repeated submission cannot start another navigation');
  await act(async()=>new Promise(resolve=>setTimeout(resolve,20)));
  assert.equal(document.querySelector('main [role="status"]').textContent,loadingLabels[locale],'Feedback stays visible while navigation is stalled');
  await act(async()=>root.render(null));
  await act(async()=>root.render(wrap(locale,h(Finder,props))));
  await act(async()=>document.querySelector('.search-tabs button').click());
  const submitDetail=()=>document.querySelector('.journey-form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
  await act(async()=>{const input=document.querySelector('.journey-form input[maxlength="80"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'Fixture car');input.dispatchEvent(new Event('input',{bubbles:true}));});
  await act(async()=>submitDetail());
  await act(async()=>{const input=document.querySelector('.journey-form textarea');Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype,'value').set.call(input,'Fixture repair request');input.dispatchEvent(new Event('input',{bubbles:true}));});
  await act(async()=>submitDetail());
  const detailedBefore=fixtureNavigations.length;
  await act(async()=>submitDetail());
  await act(async()=>new Promise(resolve=>setTimeout(resolve,30)));
  assert.equal(fixtureNavigations.length,detailedBefore+1);
  assert.equal(document.querySelector('main [role="status"]')?.textContent,loadingLabels[locale],'Vehicle search also responds before server data arrives');
  assert(!document.querySelector('[role="dialog"]'),'Vehicle dialog closes while navigation is pending');
  assert.equal(document.activeElement,document.querySelector('main'),'Vehicle dialog closing preserves loading-view focus');
  await act(async()=>root.render(null));
  await act(async()=>root.render(wrap(locale,h(Catalogue,props))));
  assert.equal(document.querySelectorAll('.catalogue-card').length,12);
  const more=()=>[...document.querySelectorAll('button')].find(button=>button.textContent===t('public.showMore'));
  more().focus();await act(async()=>more().click());await new Promise(resolve=>requestAnimationFrame(resolve));
  assert.equal(document.querySelectorAll('.catalogue-card').length,24);
  assert.equal(document.activeElement,document.querySelectorAll('.catalogue-card-target')[12],'Keyboard users continue at the first newly added workshop');
  more().focus();await act(async()=>more().click());await new Promise(resolve=>requestAnimationFrame(resolve));
  assert.equal(document.querySelectorAll('.catalogue-card').length,25);
  assert.equal(document.activeElement,document.querySelectorAll('.catalogue-card-target')[24],'Focus survives the removal of the final show-more button');
  await act(async()=>root.render(null));
  for(const Page of [Finder,Catalogue]){
   await act(async()=>root.render(wrap(locale,h(Page,props))));
   const opener=document.querySelector(Page===Finder?'.search-tabs button':'.catalogue-detail-search');
   opener.focus();await act(async()=>opener.click());
   assert(document.querySelector('[role="dialog"]'),'The vehicle search opens');
   await act(async()=>document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true})));
   await act(async()=>new Promise(resolve=>setTimeout(resolve,30)));
   assert(!document.querySelector('[role="dialog"]'));
   assert.equal(document.activeElement,opener,'Closing vehicle search returns keyboard focus to its opener');
   await act(async()=>root.render(null));
  }
 }
 console.log('Public performance UI: accessible catalogue loading, SSR selections, instant quick/vehicle navigation, duplicate submission protection, keyboard pagination and vehicle-dialog focus passed in DE/SQ/EN; no live requests.');
}finally{await act(async()=>root.unmount());dom.window.close();}
