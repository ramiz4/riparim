import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdir} from 'node:fs/promises';
import {JSDOM,VirtualConsole} from 'jsdom';

const dom=new JSDOM('<div id="root"></div>',{url:'https://riparim.example.test/werkstaetten',pretendToBeVisual:true,virtualConsole:new VirtualConsole()});
for(const key of ['window','document','navigator','customElements','HTMLElement','HTMLButtonElement','HTMLInputElement','HTMLTextAreaElement','HTMLFormElement','HTMLSelectElement','DocumentFragment','Element','Node','NodeFilter','MutationObserver','CustomEvent','Event','MouseEvent','KeyboardEvent','getComputedStyle'])Object.defineProperty(globalThis,key,{value:dom.window[key],configurable:true});
globalThis.requestAnimationFrame=dom.window.requestAnimationFrame.bind(dom.window);
globalThis.cancelAnimationFrame=dom.window.cancelAnimationFrame.bind(dom.window);
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
globalThis.ResizeObserver=class{observe(){}unobserve(){}disconnect(){}};
const observations=new Map();globalThis.IntersectionObserver=class{constructor(callback){this.callback=callback;}observe(element){observations.set(this,element);}disconnect(){observations.delete(this);}};
window.scrollTo=()=>{};window.HTMLElement.prototype.scrollIntoView=()=>{};window.HTMLElement.prototype.hasPointerCapture=()=>false;window.HTMLElement.prototype.setPointerCapture=()=>{};window.HTMLElement.prototype.releasePointerCapture=()=>{};
window.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});
let visibleTab=true;Object.defineProperty(document,'visibilityState',{get:()=>visibleTab?'visible':'hidden'});
const placeRequests=[],widgets=[],connections=[],disconnections=[],catalogueRefreshRequests=[],identityRequests=[];
window.google={maps:{importLibrary:async()=>({Place:class{constructor(options){this.options=options;}async fetchFields(){placeRequests.push(this.options);throw Error('Enterprise details are prohibited');}}})}};
customElements.define('gmp-place-details-compact',class extends HTMLElement{connectedCallback(){connections.push(this);if(!widgets.includes(this))widgets.push(this);}disconnectedCallback(){disconnections.push(this);}});
globalThis.fetch=async url=>{if(url==='/api/session')return Response.json({account:null,isAdmin:false});if(String(url).startsWith('/api/workshops?locale=')){catalogueRefreshRequests.push(String(url));return Response.json({workshops,displayById:{}});}if(url==='/api/google-places')return Response.json({enabled:true,browserKey:'fixture-key'});assert(String(url).startsWith('/api/google-places/'),'no browser REST photos or provider identity search');identityRequests.push(String(url));return Response.json({placeId:'ChIJ'+String(url).split('/').at(-1)});};

const output='.test-runtime/catalogue-google-requests';await mkdir(output,{recursive:true});
await build({stdin:{contents:`export {default as Catalogue} from './app/[locale]/werkstaetten/catalogue';export {I18nProvider} from './lib/i18n/client';export {getMessages,createTranslator} from './lib/i18n/messages';export {defaultCatalogueFilters,parseCatalogueFilters} from './lib/catalogue-filters';export {WorkshopRatings} from './components/workshop-ratings';`,resolveDir:process.cwd(),loader:'tsx'},outfile:output+'/ui.mjs',bundle:true,platform:'node',format:'esm',packages:'external',loader:{'.css':'empty'},plugins:[{name:'navigation-fixture',setup(b){
 b.onResolve({filter:/^next\/(link|navigation)$/},args=>({path:args.path,namespace:'fixture'}));
 b.onLoad({filter:/.*/,namespace:'fixture'},args=>({loader:'js',resolveDir:process.cwd(),contents:args.path==='next/link'?`import React from 'react';export default function Link({href,children,...props}){return React.createElement('a',{...props,href},children);}`:`export function useRouter(){return {push(){},replace(){},refresh(){}};}export function usePathname(){return '/werkstaetten';}export function useSearchParams(){return new URLSearchParams();}`}));
}}]});
const {Catalogue,I18nProvider,getMessages,createTranslator,defaultCatalogueFilters,parseCatalogueFilters,WorkshopRatings}=await import(new URL('../'+output+'/ui.mjs',import.meta.url));
const {createElement:h,act}=await import('react'),{createRoot}=await import('react-dom/client');
const scenarioCounts=[];
const workshops=Array.from({length:160},(_,i)=>({id:`fixture-${String(i).padStart(3,'0')}`,name:`Fixture ${String(i).padStart(3,'0')}`,city:'Prishtina',address:'Fixture address',phone:'+38349123456',whatsapp:'',lat:42.6629,lng:21.1655,rating:4,count:1,specialty:'Fixture',description:'Fixture description',services:['Bremsen & Fahrwerk'],serviceDetails:[],brands:['Volvo'],languages:['Deutsch'],sources:[],checkedAt:'2026-10-04',status:'published',googleRating:{rating:1,count:999}}));
const props={initialWorkshops:workshops,initialError:'',account:null,isAdmin:false,initialFilters:defaultCatalogueFilters};
const wrap=(locale,node)=>h(I18nProvider,{locale,messages:getMessages(locale,['common','public'])},node);
const root=createRoot(document.getElementById('root'));
const settle=()=>new Promise(resolve=>setTimeout(resolve,0));
const render=async(locale,node)=>{document.documentElement.lang=locale;await act(async()=>{root.render(wrap(locale,node));await settle();});};
const intersect=async(index=0)=>{const card=document.querySelectorAll('.catalogue-card:not([hidden])')[index];for(let pass=0;pass<3;pass++)await act(async()=>{for(const [observer,element] of [...observations])if(element.closest('.catalogue-card')===card)observer.callback([{isIntersecting:true}]);await settle();});};
const intersectRating=async()=>{for(let pass=0;pass<3;pass++)await act(async()=>{for(const [observer,element] of [...observations])if(element.classList.contains('google-rating-panel'))observer.callback([{isIntersecting:true}]);await settle();});};
const search=async(value)=>{const input=document.querySelector('input[type="search"]');await act(async()=>{Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}));await settle();});};
const tab=async(value)=>{await act(async()=>{visibleTab=value;document.dispatchEvent(new Event('visibilitychange'));await settle();});};
const load=async()=>{await act(async()=>{widgets.at(-1).dispatchEvent(new Event('gmp-load'));await settle();});};
try{
 for(const locale of ['de','sq','en']){
  await render(locale,null);window.sessionStorage.clear();
  const start=widgets.length;
  const initialFilters=parseCatalogueFilters(new URLSearchParams('sort=google'),workshops);
  window.history.replaceState(null,'',`/${locale}/werkstaetten?sort=google`);
  await render(locale,h(Catalogue,{...props,initialFilters}));
  assert.equal(widgets.length,start,'160 matches do not trigger global widget requests');
  assert(!window.location.search.includes('sort=google'));assert.equal(document.querySelectorAll('.catalogue-card:not([hidden])').length,12);
  const sort=document.querySelector('.catalogue-panel-sort [role="combobox"]');await act(async()=>sort.click());
  const t=createTranslator(getMessages(locale));assert.deepEqual([...document.querySelectorAll('[role="option"]')].map(x=>x.textContent),[t('public.sortName'),t('public.sortRiparim'),t('public.sortChooseCity')]);
  await act(async()=>document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})));
  await tab(false);await intersect();assert.equal(widgets.length,start,'hidden tabs cannot request Standard widgets');
  await tab(true);await intersect();assert.equal(widgets.length,start+1);
  const first=document.querySelector('gmp-place-details-compact'),firstConnections=connections.filter(x=>x===first).length,firstDisconnections=disconnections.filter(x=>x===first).length;assert(first,'visible catalogue rating uses the official Standard UI Kit, without Enterprise details');
  assert.deepEqual([...first.querySelector('gmp-place-content-config').children].map(x=>x.localName),['gmp-place-rating'],'the rating content configuration omits all Advanced/session fields');
  assert.equal(first.querySelector('gmp-place-details-place-request').place.options.requestedLanguage,locale);
  await load();await intersect();assert.equal(widgets.length,start+1,'visibility changes preserve the native element');
  const ratingPanel=first.closest('.google-rating-panel');
  assert(!ratingPanel.querySelector('.profile-google-heading'),'catalogue ratings use the native Google attribution without a duplicate heading');
  assert(!ratingPanel.querySelector('.google-details-time'),'catalogue ratings omit the extra loaded-time line');
  assert(!ratingPanel.querySelector('a.text-action'),'ready catalogue ratings rely on the native Maps button');
  assert.equal(document.querySelector('gmp-place-details-compact'),first);assert(!first.hasAttribute('truncation-preferred'));assert.equal(first.getAttribute('orientation'),'horizontal');
  assert(document.querySelector('.riparim-rating .rating-value'),'own ratings remain independent');
  await search('Fixture 001');assert.equal(widgets.length,start+1,'filter changes cannot request hidden cards');
  await search('');await intersect();assert.equal(widgets.length,start+1,'filtering away and back keeps the same native widget without a new Standard query');assert.equal(document.querySelector('gmp-place-details-compact'),first,'the connected native provider element survives filtering');assert(first.isConnected);assert.equal(connections.filter(x=>x===first).length,firstConnections);assert.equal(disconnections.filter(x=>x===first).length,firstDisconnections,'filter changes do not disconnect or reconnect the native provider');
  const nextLocale=locale==='sq'?'en':'sq';await render(nextLocale,h(Catalogue,{...props,initialFilters}));
  assert.equal(document.querySelector('gmp-place-details-compact'),null,'locale changes remove old native provider content before visibility');
  await intersect();assert.equal(widgets.at(-1).querySelector('gmp-place-details-place-request').place.options.requestedLanguage,nextLocale);
 }
 for(const locale of ['de','sq','en']){
  await render(locale,null);window.sessionStorage.clear();const start=widgets.length,refreshes=catalogueRefreshRequests.length;
  const path=locale==='de'?'/werkstaetten':`/${locale}/werkstaetten`;
  window.history.replaceState(null,'',`${path}?sort=google&q=Fixture+00&ort=prishtina&leistung=bremsen-fahrwerk&marke=volvo&sprache=de`);
  await render(locale,h(Catalogue,{...props,publicSnapshot:true,initialWorkshops:[]}));
  assert.equal(catalogueRefreshRequests.length,refreshes+1);assert.equal(catalogueRefreshRequests.at(-1),`/api/workshops?locale=${locale}`);
  assert.equal(document.querySelectorAll('.catalogue-card:not([hidden])').length,11);
  const actual=new URLSearchParams(window.location.search);assert.equal(window.location.pathname,path);assert.equal(actual.get('sort'),null);
  for(const [key,value] of [['q','Fixture 00'],['ort','prishtina'],['leistung','bremsen-fahrwerk'],['marke','volvo'],['sprache','de']])assert.equal(actual.get(key),value);
  assert.equal(widgets.length,start,'static shell live hydration starts no invisible provider widget');await intersect();assert.equal(widgets.length,start+1);
 }
 for(const locale of ['de','sq','en']){
  await render(locale,null);window.sessionStorage.clear();const start=widgets.length;
  await render(locale,h(Catalogue,props));for(let i=0;i<12;i++)await intersect(i);assert.equal(widgets.length-start,12);
  const retainedBefore=[...document.querySelectorAll('gmp-place-details-compact')],connectionBefore=connections.length,disconnectionBefore=disconnections.length;await search('No fixture match');assert.equal(document.querySelectorAll('.catalogue-card:not([hidden])').length,0);assert(retainedBefore.every(widget=>widget.isConnected),'no-results keeps the native widgets connected in hidden whole cards');await search('');assert.equal(connections.length,connectionBefore);assert.equal(disconnections.length,disconnectionBefore);for(let i=0;i<12;i++)await intersect(i);assert.equal(widgets.length-start,12,'filter changes keep all twelve connected widgets without extra Standard queries');
  await act(async()=>{document.querySelector('.catalogue-pagination button').click();await settle();});assert.equal(document.querySelectorAll('.catalogue-card:not([hidden])').length,24);assert.equal(widgets.length-start,12);
  for(let i=12;i<24;i++)await intersect(i);assert.equal(widgets.length-start,24);
  scenarioCounts.push({locale,firstTwelve:12,filterAdditional:0,showMoreHiddenAdditional:0,nextTwelveAdditional:12});
 }
 // A queued visibility/SDK completion cannot mount a provider widget inside a newly hidden retained card.
 await render('de',null);window.sessionStorage.clear();const nativeWhenDefined=customElements.whenDefined.bind(customElements);let finishDefinition;customElements.whenDefined=()=>new Promise(resolve=>{finishDefinition=resolve;});
 try{await render('de',h(Catalogue,props));await intersect();const before=widgets.length;await search('No fixture match');await act(async()=>{finishDefinition();await settle();});assert.equal(widgets.length,before,'late SDK completion cannot request a widget from a hidden whole card');await act(async()=>{for(const [observer,element] of [...observations])if(element.closest('[hidden]'))observer.callback([{target:element,isIntersecting:false}]);await settle();});customElements.whenDefined=nativeWhenDefined;await search('');await intersect();assert.equal(widgets.length,before+1,'a genuinely visible card can initialize its deferred widget');}finally{customElements.whenDefined=nativeWhenDefined;}
 // A late live catalogue response removes retired/hidden profiles, including retained native widgets.
 await render('de',null);window.sessionStorage.clear();const initialFetch=globalThis.fetch;let releaseLive;const liveGate=new Promise(resolve=>{releaseLive=resolve;});
 globalThis.fetch=async(url,options)=>{if(String(url).startsWith('/api/workshops?locale=')){await liveGate;return Response.json({workshops:workshops.filter(w=>w.id!==workshops[0].id),displayById:{}});}return initialFetch(url,options);};
 try{await render('de',h(Catalogue,{...props,publicSnapshot:true}));await intersect();const retiredWidget=document.querySelector('gmp-place-details-compact');assert(retiredWidget);await search('No fixture match');assert(retiredWidget.isConnected);await act(async()=>{releaseLive();await settle();});assert(!retiredWidget.isConnected,'live retirement unmounts retained provider content');assert(!document.querySelector('.catalogue-card-target[href*="'+workshops[0].id+'"]'),'a retired profile is removed even while filtered away');await search('');assert(!document.querySelector('.catalogue-card-target[href*="'+workshops[0].id+'"]'));}finally{releaseLive();globalThis.fetch=initialFetch;}
 for(const mode of ['disabled','quota','timeout']){
  await render('de',null);const scoped=await import(new URL('../'+output+'/ui.mjs?fallback-'+mode,import.meta.url)),baseFetch=globalThis.fetch;let identityCalls=0;
  globalThis.fetch=async(url,options)=>{if(url==='/api/google-places')return Response.json(mode==='disabled'?{enabled:false}:{enabled:true,browserKey:'fixture-key'});if(String(url).startsWith('/api/google-places/')){identityCalls++;if(mode==='timeout')throw new DOMException('Fixture deadline','TimeoutError');return new Response('{}',{status:429});}return baseFetch(url,options);};
  try{for(const locale of ['de','sq','en']){
   window.sessionStorage.clear();const before=widgets.length,requests=identityCalls;
   await act(async()=>{root.render(h(scoped.I18nProvider,{locale,messages:scoped.getMessages(locale,['common','public'])},h(scoped.Catalogue,props)));await settle();});await intersect();
   const card=document.querySelector('.catalogue-card:not([hidden])'),panel=card.querySelector('.google-rating-panel'),t=scoped.createTranslator(scoped.getMessages(locale));
   assert(card.querySelector('.riparim-rating .rating-value'));assert(panel.textContent.includes(t('public.googleDetailsFailed')));assert(!panel.textContent.includes(t('public.googleNoReviews')));assert(panel.querySelector('a').href.includes('google.com/maps'));
   await tab(false);await tab(true);await intersect();assert.equal(identityCalls-requests,mode==='disabled'?0:1);assert.equal(widgets.length,before,'failure never mounts a widget or retries automatically');await render(locale,null);
  }}finally{globalThis.fetch=baseFetch;}
 }
 await render('de',h(WorkshopRatings,{workshop:workshops[0]}));await intersectRating();const failed=widgets.at(-1);await act(async()=>failed.dispatchEvent(new Event('gmp-error')));
 assert(document.querySelector('.google-rating-panel').textContent.includes(createTranslator(getMessages('de'))('public.googleDetailsFailed')));
 assert(document.querySelector('.google-rating-panel a').href.includes('google.com/maps'));assert(!document.querySelector('gmp-place-details-compact'),'failed provider content is removed');
 const failedCount=widgets.length;await tab(false);await tab(true);assert.equal(widgets.length,failedCount,'widget quota failure has no automatic retry');
 assert.equal(placeRequests.length,0,'no Enterprise fetchFields is called anywhere in the catalogue');
 console.log(JSON.stringify({catalogueSize:160,individualDetails:0,standardVisibleOnly:true,scenarioCounts,providerFallbackModes:['disabled','quota','timeout'],liveProviderCalls:false}));
}finally{await act(async()=>root.unmount());dom.window.close();}
