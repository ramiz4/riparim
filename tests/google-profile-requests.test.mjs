import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdir} from 'node:fs/promises';
import {JSDOM,VirtualConsole} from 'jsdom';
const dom=new JSDOM('<html lang="de"><div id="root"></div></html>',{url:'https://riparim.example.test/werkstatt/fixture',pretendToBeVisual:true,virtualConsole:new VirtualConsole()});
for(const key of ['window','document','navigator','HTMLElement','HTMLButtonElement','HTMLInputElement','HTMLTextAreaElement','HTMLFormElement','HTMLSelectElement','customElements','DocumentFragment','Element','Node','NodeFilter','MutationObserver','CustomEvent','Event','MouseEvent','KeyboardEvent','getComputedStyle'])Object.defineProperty(globalThis,key,{value:dom.window[key],configurable:true});
globalThis.requestAnimationFrame=dom.window.requestAnimationFrame.bind(dom.window);globalThis.cancelAnimationFrame=dom.window.cancelAnimationFrame.bind(dom.window);globalThis.IS_REACT_ACT_ENVIRONMENT=true;
window.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});window.scrollTo=()=>{};window.HTMLElement.prototype.scrollIntoView=()=>{};window.HTMLElement.prototype.hasPointerCapture=()=>false;window.HTMLElement.prototype.setPointerCapture=()=>{};window.HTMLElement.prototype.releasePointerCapture=()=>{};globalThis.ResizeObserver=class{observe(){}unobserve(){}disconnect(){}};
const observations=new Map();globalThis.IntersectionObserver=class{constructor(callback){this.callback=callback;}observe(element){observations.set(this,element);}disconnect(){observations.delete(this);}};
let visibleTab=true;Object.defineProperty(document,'visibilityState',{get:()=>visibleTab?'visible':'hidden'});
const counters={configs:[],individualDetails:[],individualRatings:[],widgets:[],widgetConnections:[],widgetDisconnections:[],photoResources:[]},identities=[];
const seenPhotos=new WeakSet();const photoObserver=new MutationObserver(records=>{for(const record of records)for(const node of record.addedNodes)if(node instanceof Element)for(const image of [...(node.matches('img')?[node]:[]),...node.querySelectorAll('img')])if(image.src.includes('places.googleapis.com')&&!seenPhotos.has(image)){seenPhotos.add(image);counters.photoResources.push(image.src);}});photoObserver.observe(document.body,{childList:true,subtree:true});
const nativeTimeout=globalThis.setTimeout,nativeClearTimeout=globalThis.clearTimeout,expiries=new Map(),timeouts=new Map();let timerId=100000;
globalThis.setTimeout=(fn,delay,...args)=>{if(delay===1800000||delay===12000){const id=++timerId;(delay===1800000?expiries:timeouts).set(id,()=>fn(...args));return id;}return nativeTimeout(fn,delay,...args);};globalThis.clearTimeout=id=>{expiries.delete(id);timeouts.delete(id);return nativeClearTimeout(id);};
window.google={maps:{importLibrary:async()=>({Place:class{constructor(options){this.options=options;}async fetchFields(options){counters.individualRatings.push({place:this.options,fields:options.fields});}}})}};
for(const tag of ['gmp-advanced-place-details','gmp-advanced-place-details-compact'])customElements.define(tag,class extends HTMLElement{connectedCallback(){counters.widgetConnections.push(this);if(!counters.widgets.includes(this))counters.widgets.push(this);}disconnectedCallback(){counters.widgetDisconnections.push(this);}});
globalThis.fetch=async url=>{
 if(url==='/api/google-places'){counters.configs.push(url);return Response.json({enabled:true,browserKey:'fixture-key'});}
 if(String(url).startsWith('/api/google-places/')){identities.push(String(url));if(String(url).endsWith('disabled'))return Response.json({placeId:null});return Response.json({placeId:'ChIJ'+String(url).split('/').at(-1)});}
 if(String(url).startsWith('https://places.googleapis.com/')){counters.individualDetails.push({url:String(url)});throw Error('Browser REST photos are prohibited');}
 throw Error('Unexpected fixture request '+url);
};
const output='.test-runtime/google-profile-requests';await mkdir(output,{recursive:true});
await build({stdin:{contents:`export {default as Profile} from './app/[locale]/werkstatt/[id]/profile';export {GooglePlaceReviews} from './components/google-place-reviews';export {I18nProvider} from './lib/i18n/client';export {getMessages,createTranslator} from './lib/i18n/messages';export {formatDate} from './lib/i18n/format';`,resolveDir:process.cwd(),loader:'tsx'},outfile:output+'/ui.mjs',bundle:true,format:'esm',platform:'node',packages:'external',loader:{'.css':'empty'},plugins:[{name:'navigation-fixture',setup(b){b.onResolve({filter:/^next\/(link|navigation)$/},args=>({path:args.path,namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},args=>({loader:'js',contents:args.path==='next/link'?`import React from 'react';export default function Link({href,children,...props}){return React.createElement('a',{...props,href},children);}`:`export function useRouter(){return {push(){},refresh(){},prefetch(){}};}export function usePathname(){return '/werkstatt/fixture';}export function useSearchParams(){return new URLSearchParams();}`}));}}]});
const api=await import(new URL('../'+output+'/ui.mjs',import.meta.url)),React=await import('react'),{createRoot}=await import('react-dom/client');const root=createRoot(document.getElementById('root')),h=React.createElement;
const workshop={id:'fixture',name:'Fixture',city:'Prishtina',address:'Fixture street',phone:'+38349123456',whatsapp:'',lat:42.66,lng:21.16,rating:4,count:1,specialty:'',description:'',services:[],serviceDetails:[],brands:[],languages:[],sources:[],checkedAt:'2026-10-10',status:'published',googleRating:{mapsUrl:'https://www.google.com/maps/search/?api=1&query_place_id=ChIJfixture',rating:1,count:999}};
const props={workshop,directory:[workshop],reviews:[],reviewError:'',signedIn:false,account:null,isAdmin:false};
const settle=()=>new Promise(resolve=>setTimeout(resolve,0));const render=async(locale,node)=>{document.documentElement.lang=locale;await React.act(async()=>{root.render(h(api.I18nProvider,{locale,messages:api.getMessages(locale,['common','public'])},node));await settle();});};
const show=async(className,visible=true)=>{for(let pass=0;pass<3;pass++)await React.act(async()=>{for(const [observer,element] of [...observations])if(element.classList.contains(className)&&!(className==='google-reviews-panel'&&element.classList.contains('google-overview-panel')))observer.callback([{target:element,isIntersecting:visible}]);await settle();});};
const tab=async(value)=>{await React.act(async()=>{visibleTab=value;document.dispatchEvent(new Event('visibilitychange'));await settle();});};
const click=async(element)=>{assert(element,'control exists');await React.act(async()=>{element.dispatchEvent(new MouseEvent('click',{bubbles:true}));await settle();});};
const widgetLifecycle=element=>({connected:counters.widgetConnections.filter(value=>value===element).length,disconnected:counters.widgetDisconnections.filter(value=>value===element).length});
const loadWidget=async()=>{await React.act(async()=>{counters.widgets.at(-1).dispatchEvent(new Event('gmp-load'));await settle();});};
const mount=async(locale,id,strict=false)=>{await render(locale,null);const value={...workshop,id,googleRating:{...workshop.googleRating,mapsUrl:`https://www.google.com/maps/search/?api=1&query_place_id=ChIJ${id}`}},node=h(api.Profile,{...props,workshop:value,directory:[value]});await render(locale,strict?h(React.StrictMode,null,node):node);};
try{
 // Actual publicSnapshot review hydration must preserve the already visible Google provider.
 const ownReview={display_name:'Fixture reviewer',vehicle:'Fixture vehicle',service:'Fixture service',date:'2026-10-10',rating:5,review:'Fixture review'};
 const hydratedWorkshop={...workshop,id:'review-hydration',googleRating:{...workshop.googleRating,mapsUrl:'https://www.google.com/maps/search/?api=1&query_place_id=ChIJreview-hydration'}},baseFetch=globalThis.fetch;
 let releaseReviews;const pendingReviews=new Promise(resolve=>{releaseReviews=resolve;}),hydrationWidgetStart=counters.widgets.length;
 globalThis.fetch=async(url,options)=>{if(url==='/api/session')return Response.json({account:null,isAdmin:false});if(url==='/api/workshops?locale=de')return Response.json({workshops:[hydratedWorkshop]});if(url==='/api/reviews?workshop=review-hydration'){await pendingReviews;return Response.json({reviews:[ownReview]});}return baseFetch(url,options);};
 try{
  await render('de',h(api.Profile,{...props,workshop:hydratedWorkshop,directory:[hydratedWorkshop],publicSnapshot:true}));
  await show('google-reviews-panel');await loadWidget();await show('profile-google-photos');
  const original=document.querySelector('gmp-advanced-place-details'),before={widgets:counters.widgets.length,details:counters.individualDetails.length,photos:counters.photoResources.length},lifecycleBefore=widgetLifecycle(original);
  assert(original?.isConnected);assert(!document.querySelector('.public-review-list'),'own reviews are still pending while Google is visible');
  await React.act(async()=>{releaseReviews();await settle();});await show('google-reviews-panel');await show('profile-google-photos');
  assert(document.querySelector('.public-review-list').textContent.includes(ownReview.review),'the actual asynchronous own-review response hydrated');
  const current=document.querySelector('gmp-advanced-place-details');
  if(current!==original||JSON.stringify(widgetLifecycle(original))!==JSON.stringify(lifecycleBefore))console.log(JSON.stringify({trigger:'publicSnapshot-review-hydration',lifecycleBefore,lifecycleAfter:widgetLifecycle(original),sameElement:current===original,firstConnected:original.isConnected,widgetMontagesBefore:before.widgets-hydrationWidgetStart,widgetMontagesAfter:counters.widgets.length-hydrationWidgetStart,detailsBefore:before.details,detailsAfter:counters.individualDetails.length,photosBefore:before.photos,photosAfter:counters.photoResources.length}));
  assert.equal(current,original,'late publicSnapshot review hydration must preserve the same Google element');assert(original.isConnected);
  assert.deepEqual(widgetLifecycle(original),lifecycleBefore,'late own-review hydration must never disconnect or reconnect the native Google widget');
  assert.deepEqual({widgets:counters.widgets.length,details:counters.individualDetails.length,photos:counters.photoResources.length},before,'own-review hydration cannot initiate widget, details or photo resources');
  assert(document.querySelector('.profile-review-stream').firstElementChild.classList.contains('profile-riparim-reviews'),'hydrated own reviews retain the intended first-provider order');
 }finally{releaseReviews();globalThis.fetch=baseFetch;}
 for(const locale of ['de','sq','en']){
  const details=counters.individualDetails.length,widgets=counters.widgets.length,identityCount=identities.length,configCount=counters.configs.length;
  await mount(locale,locale);
  assert.equal(counters.configs.length,configCount,'the Google area outside viewport must not start client configuration');
  assert.equal(identities.length,identityCount,'the Google area outside viewport must not start potentially billable identity resolution');
  assert.equal(counters.individualDetails.length,details,'an ordinary profile mount must not request the duplicate Enterprise profile');
  assert.equal(counters.individualRatings.length,0,'profile header must not start an individual rating request');
  assert.equal(counters.widgets.length,widgets,'invisible Google details remain unloaded');
  await show('google-reviews-panel');assert.equal(counters.widgets.length,widgets+1);assert.equal(identities.length,identityCount+1,'first visible Google area starts one shared identity');
  const element=counters.widgets.at(-1),request=element.querySelector('gmp-place-details-place-request');
  assert.equal(request.place.options.id,'ChIJ'+locale);assert.equal(request.place.options.requestedLanguage,locale);
  assert.deepEqual([...element.children].map(x=>x.localName),['gmp-place-details-place-request','gmp-place-reviews','gmp-place-attribution'],'lower provider contains only reviews and attribution');
  await loadWidget();assert(!document.querySelector('.profile-google-heading'));assert(!document.querySelector('.google-details-time'));
  const summary={details:counters.individualDetails.length,widgets:counters.widgets.length};
  document.documentElement.classList.toggle('dark');await click(document.querySelector('.inline-review-toggle'));await render(locale,h(api.Profile,{...props,workshop:{...workshop,id:locale,googleRating:{...workshop.googleRating,mapsUrl:`https://www.google.com/maps/search/?api=1&query_place_id=ChIJ${locale}`}},directory:[workshop]}));
  assert.equal(counters.widgets.length,summary.widgets,'ordinary state/prop/theme changes preserve the mounted widget');assert.equal(counters.individualDetails.length,summary.details);
  await show('profile-google-photos');assert.equal(counters.individualDetails.length,details,'the photo link starts no REST metadata query');assert.equal(identities.length,identityCount+1);
  assert.equal(document.querySelectorAll('.profile-photo-strip img').length,0);
  assert(document.querySelector('.profile-google-photos a').href.includes('query_place_id=ChIJ'+locale));
  const reviewStateWorkshop={...workshop,id:locale,googleRating:{...workshop.googleRating,mapsUrl:`https://www.google.com/maps/search/?api=1&query_place_id=ChIJ${locale}`}},reviewBefore={widgets:counters.widgets.length,details:counters.individualDetails.length,photos:counters.photoResources.length},reviewLifecycle=widgetLifecycle(element);
  for(const reviews of [[ownReview],[]]){
   await render(locale,h(api.Profile,{...props,workshop:reviewStateWorkshop,directory:[reviewStateWorkshop],reviews}));await show('google-reviews-panel');await show('profile-google-photos');
   assert.equal(document.querySelector('gmp-advanced-place-details'),element,'[] -> [Review] -> [] must preserve the same Google element');assert(element.isConnected);assert.deepEqual(widgetLifecycle(element),reviewLifecycle,'[] -> [Review] -> [] cannot disconnect or reconnect the native Google widget');
   assert.deepEqual({widgets:counters.widgets.length,details:counters.individualDetails.length,photos:counters.photoResources.length},reviewBefore,'changing own-review presence must preserve all provider request/resource counters');
   assert(document.querySelector('.profile-review-stream').firstElementChild.classList.contains('profile-riparim-reviews'),'the provider reading order remains Riparim then Google');
  }

  assert.equal(document.querySelectorAll('img[src*="maxWidthPx=1600"]').length,0,'large photo is not mounted before user action');
  await tab(false);const before={widgets:counters.widgets.length,details:counters.individualDetails.length};
  await React.act(async()=>{for(const expire of [...expiries.values()])expire();await settle();});
  assert(document.querySelector('.profile-google-reviews .google-official-widget').classList.contains('google-widget-unavailable'),'30-minute expiry hides the stale native opening status');
  const refresh=document.querySelector('.google-details-refresh');assert(refresh.disabled);await click(refresh);
  assert.equal(counters.widgets.length,before.widgets);assert.equal(counters.individualDetails.length,before.details,'expiry never reloads photos or a complete profile');
  await tab(true);assert.equal(counters.widgets.length,before.widgets,'returning to tab does not refresh automatically');
  await click(document.querySelector('.google-details-refresh'));assert.equal(counters.widgets.length,before.widgets+1,'explicit visible refresh creates exactly one Advanced widget');
  assert.equal(counters.individualDetails.length,before.details,'explicit status refresh never requests photos');
  await React.act(async()=>counters.widgets.at(-1).dispatchEvent(new Event('gmp-error')));
  const t=api.createTranslator(api.getMessages(locale));assert(document.querySelector('.profile-google-reviews .google-reviews-panel').textContent.includes(t('public.googleDetailsFailed')));assert(!document.querySelector('.profile-google-reviews .google-reviews-panel').textContent.includes(t('public.googleReviewsEmpty')));
  assert(document.querySelector('.profile-google-reviews .google-reviews-panel a').href.includes('query_place_id=ChIJ'+locale),'Maps fallback preserves confirmed identity on quota/provider failures');
 }
 // The upper summary and lower comments share one identity but independent visible-only widgets.
 for(const locale of ['de','sq','en']){
  const start=counters.widgets.length,identityStart=identities.length;await mount(locale,'sections-'+locale);
  await tab(false);await show('google-overview-panel');assert.equal(counters.widgets.length,start);
  await tab(true);await show('google-overview-panel');assert.equal(counters.widgets.length,start+1);
  const overview=document.querySelector('gmp-advanced-place-details-compact');assert(overview.closest('.profile-overview-details'));
  assert.deepEqual([...overview.children].map(x=>x.localName),['gmp-place-details-place-request','gmp-place-rating','gmp-place-opening-hours','gmp-place-attribution']);
  assert.equal(document.querySelector('gmp-advanced-place-details'),null,'invisible comments do not load with the upper summary');
  await loadWidget();await show('google-reviews-panel');assert.equal(counters.widgets.length,start+2);assert.equal(identities.length,identityStart+1,'both visible panels share the same identity route');
  const comments=document.querySelector('gmp-advanced-place-details');assert(comments.closest('#google-bewertungen'));
  assert.deepEqual([...comments.children].map(x=>x.localName),['gmp-place-details-place-request','gmp-place-reviews','gmp-place-attribution']);
  for(const element of [overview,comments]){assert(!element.querySelector('gmp-place-name,gmp-place-link,gmp-place-all-content,gmp-place-standard-content'));assert.equal(element.querySelector('gmp-place-details-place-request').place.options.requestedLanguage,locale);}
  assert.equal(overview.querySelector('gmp-place-details-place-request').place.options.id,comments.querySelector('gmp-place-details-place-request').place.options.id);
  assert(!document.querySelector('.profile-google-heading'));await loadWidget();await show('google-overview-panel');await show('google-reviews-panel');assert.equal(counters.widgets.length,start+2,'repeated visibility preserves both native widgets');
 }
 const identityBefore=identities.length;await tab(false);await mount('de','hidden');
 assert.equal(identities.length,identityBefore,'a hidden tab cannot start a potentially billable identity resolution');
 await show('google-reviews-panel');await show('profile-google-photos');const hiddenWidgets=counters.widgets.length,hiddenDetails=counters.individualDetails.length;
 assert.equal(counters.widgets.length,hiddenWidgets);assert.equal(counters.individualDetails.length,hiddenDetails);
 await tab(true);assert.equal(identities.length,identityBefore+1);await show('google-reviews-panel');await show('profile-google-photos');assert.equal(counters.widgets.length,hiddenWidgets+1);assert.equal(counters.individualDetails.length,hiddenDetails);
 // An async SDK definition cannot mount a widget after the tab becomes hidden.
 const nativeWhenDefined=customElements.whenDefined.bind(customElements);let releaseWidget;customElements.whenDefined=()=>new Promise(resolve=>{releaseWidget=resolve;});
 await mount('de','sdk-race');await show('google-reviews-panel');await tab(false);const sdkBefore=counters.widgets.length;
 await React.act(async()=>{releaseWidget();await settle();});assert.equal(counters.widgets.length,sdkBefore);
 customElements.whenDefined=nativeWhenDefined;await tab(true);assert.equal(counters.widgets.length,sdkBefore+1,'deferred widget initializes when visibility returns');
 await mount('de','strict',true);await show('google-reviews-panel');assert(document.querySelector('gmp-advanced-place-details'),'StrictMode replay preserves the Advanced widget');
 await mount('de','disabled');await show('google-reviews-panel');assert(document.querySelector('.profile-google-reviews .google-reviews-panel').textContent.includes('Google-Angaben konnten nicht geladen werden'));assert(document.querySelector('.profile-google-reviews .google-reviews-panel a').href.includes('google.com/maps'));
 await mount('de','changeIdentity');await show('google-reviews-panel');await loadWidget();const priorWidget=document.querySelector('gmp-advanced-place-details');
 await render('de',h(api.Profile,{...props,workshop:{...workshop,id:'changeIdentity',googleRating:{...workshop.googleRating,mapsUrl:'https://www.google.com/maps/search/?api=1&query_place_id=ChIJotherIdentity'}}}));
 assert(!priorWidget.isConnected,'changed confirmed identity removes the old provider content');
 assert(document.querySelector('.workshop-overview-actions a[href*="maps/dir"]').href.includes('destination_place_id=ChIJotherIdentity'));
 assert(document.querySelector('.profile-google-photos a').href.includes('query_place_id=ChIJotherIdentity'));
 // Changed business data without a historical Google snapshot must invalidate the old confirmed identity.
 await render('de',null);const originalBusiness={...workshop,id:'business-update',googleRating:null};await render('de',h(api.Profile,{...props,workshop:originalBusiness,directory:[originalBusiness]}));await show('google-reviews-panel');const businessWidget=document.querySelector('gmp-advanced-place-details'),businessFetch=globalThis.fetch;
 globalThis.fetch=async(url,options)=>String(url).endsWith('/business-update')?Response.json({placeId:'ChIJbusiness-updated'}):businessFetch(url,options);
 try{const updatedBusiness={...originalBusiness,address:'Confirmed new workshop street'};await render('de',h(api.Profile,{...props,workshop:updatedBusiness,directory:[updatedBusiness]}));await show('google-reviews-panel');assert(!businessWidget.isConnected,'new business identity discards old provider content even without a historical Maps snapshot');assert.equal(document.querySelector('gmp-place-details-place-request').place.options.id,'ChIJbusiness-updated');assert(document.querySelector('.profile-google-photos a').href.includes('query_place_id=ChIJbusiness-updated'));}finally{globalThis.fetch=businessFetch;}
 await mount('de','timeout');await show('google-reviews-panel');const timeoutWidgets=counters.widgets.length;await React.act(async()=>{for(const fail of [...timeouts.values()])fail();await settle();});await tab(false);await tab(true);assert.equal(counters.widgets.length,timeoutWidgets,'load timeout has no automatic retry loop');assert(document.querySelector('.profile-google-reviews .google-reviews-panel').textContent.includes('Google-Angaben konnten nicht geladen werden'));
 // Configuration may resolve after a previously visible tab was hidden.
 await render('de',null);const identityApi=await import(new URL('../'+output+'/ui.mjs?identity-hidden-race',import.meta.url)),fixtureFetch=globalThis.fetch;let releaseConfig;const configGate=new Promise(resolve=>{releaseConfig=resolve;}),identityCount=identities.length;
 globalThis.fetch=async(url,options)=>{if(url==='/api/google-places'){await configGate;return Response.json({enabled:true,browserKey:'fixture-key'});}return fixtureFetch(url,options);};
 await React.act(async()=>{root.render(h(identityApi.I18nProvider,{locale:'de',messages:identityApi.getMessages('de',['common','public'])},h(identityApi.Profile,{...props,workshop:{...workshop,id:'identity-hidden-race',googleRating:null}})));await settle();});await show('google-reviews-panel');await tab(false);
 await React.act(async()=>{releaseConfig();await settle();});assert.equal(identities.length,identityCount,'a late configuration response cannot start identity resolution in a hidden tab');
 await tab(true);assert.equal(identities.length,identityCount+1,'deferred identity resolution starts once when the tab returns');globalThis.fetch=fixtureFetch;
 // The lazy identity is deferred when its panel disappears or the profile changes during configuration.
 for(const scenario of ['offscreen','key-change']){
  await render('de',null);
  const scopedApi=await import(new URL('../'+output+'/ui.mjs?identity-'+scenario,import.meta.url)),baseFetch=globalThis.fetch;
  let resolveConfig;const pendingConfig=new Promise(resolve=>{resolveConfig=resolve;}),beforeIdentity=identities.length;let configurations=0;
  globalThis.fetch=async(url,options)=>{if(url==='/api/google-places'){configurations++;await pendingConfig;return Response.json({enabled:true,browserKey:'fixture-key'});}return baseFetch(url,options);};
  const scopedRender=async(locale,id)=>{const value={...workshop,id,googleRating:{...workshop.googleRating,mapsUrl:`https://www.google.com/maps/search/?api=1&query_place_id=ChIJ${id}`}};await React.act(async()=>{root.render(h(scopedApi.I18nProvider,{locale,messages:scopedApi.getMessages(locale,['common','public'])},h(React.StrictMode,null,h(scopedApi.Profile,{...props,workshop:value,directory:[value]}))));await settle();});};
  try{
   await scopedRender('de','visibility-'+scenario);assert.equal(configurations,0,'StrictMode offscreen mount starts no configuration');assert.equal(identities.length,beforeIdentity);
   await show('google-reviews-panel');assert.equal(configurations,1,'first visible panel starts configuration once');await show('google-reviews-panel',false);
   if(scenario==='key-change')await scopedRender('sq','visibility-current');
   await React.act(async()=>{resolveConfig();await settle();});
   assert.equal(identities.length,beforeIdentity,'no identity starts after the panel disappears or the profile key changes');
   await show('google-reviews-panel');assert.equal(identities.length,beforeIdentity+1,'visibility return resolves the current identity exactly once');
   await show('google-reviews-panel');assert.equal(identities.length,beforeIdentity+1,'repeated visibility reuses the canonical identity');assert.equal(configurations,1,'configuration is not repeated');
   if(scenario==='key-change')assert(identities.at(-1).endsWith('/visibility-current'),'late old-key configuration cannot resolve the previous identity');
  }finally{resolveConfig();globalThis.fetch=baseFetch;}
 }
 // Exercise the actual config switch and identity quota/deadline failures in every locale.
 for(const mode of ['disabled','identity-quota','identity-timeout']){
  await render('de',null);
  const scoped=await import(new URL('../'+output+'/ui.mjs?cost-fallback-'+mode,import.meta.url)),baseFetch=globalThis.fetch;
  let identityCalls=0,photoCalls=0;const widgetStart=counters.widgets.length,ratingStart=counters.individualRatings.length;
  globalThis.fetch=async(url,options)=>{
   if(url==='/api/google-places')return Response.json(mode==='disabled'?{enabled:false}:{enabled:true,browserKey:'fixture-key'});
   if(String(url).startsWith('/api/google-places/')){
    identityCalls++;
    if(mode==='identity-timeout')throw new DOMException('Fixture identity deadline','TimeoutError');
    if(mode==='identity-quota')return new Response('{}',{status:429});
   }
   return baseFetch(url,options);
  };
  try{
   for(const locale of ['de','sq','en']){
    const value={...workshop,id:'cost-'+mode+'-'+locale,googleRating:{...workshop.googleRating,mapsUrl:`https://www.google.com/maps/search/?api=1&query_place_id=ChIJcost-${mode}-${locale}`}},identityStart=identityCalls,photoStart=photoCalls,widgets=counters.widgets.length;
    await React.act(async()=>{root.render(h(scoped.I18nProvider,{locale,messages:scoped.getMessages(locale,['common','public'])},h(scoped.Profile,{...props,workshop:value,directory:[value],reviews:[ownReview]})));await settle();});
    await show('google-reviews-panel');await show('profile-google-photos');
    const t=scoped.createTranslator(scoped.getMessages(locale)),panel=document.querySelector('.profile-google-reviews .google-reviews-panel'),photos=document.querySelector('.profile-google-photos');
    assert(document.querySelector('.profile-riparim-reviews').textContent.includes(ownReview.review),'provider failures preserve own reviews');
    assert(document.querySelector('.profile-overview-details .riparim-rating .rating-value'),'provider failures preserve the own average');
    assert(document.querySelector('.workshop-overview-actions a[href*="maps/dir"]').href.includes('destination_place_id=ChIJcost-'+mode+'-'+locale),'route fallback keeps the independently confirmed Place ID');
    assert(panel.querySelector('a').href.includes('query_place_id=ChIJcost-'+mode+'-'+locale));
    assert(!panel.textContent.includes(t('public.googleReviewsEmpty')),'unavailable provider does not imply zero reviews');
    assert(photos.querySelector('a').href.includes('google.com/maps'));assert.equal(photoCalls,photoStart);
    {assert(panel.textContent.includes(t('public.googleDetailsFailed')));assert.equal(counters.widgets.length,widgets);assert.equal(photoCalls,photoStart);}
    const stable={identityCalls,photoCalls,widgets:counters.widgets.length};
    await tab(false);await tab(true);await show('google-reviews-panel');await show('profile-google-photos');
    assert.deepEqual({identityCalls,photoCalls,widgets:counters.widgets.length},stable,'provider failures must never auto-retry on tab/visibility changes');
    assert.equal(identityCalls-identityStart,mode==='disabled'?0:1,'one shared identity for both panels, zero while disabled');
    await React.act(async()=>{root.render(null);await settle();});
   }
   if(!mode.startsWith('photo'))assert.equal(counters.widgets.length,widgetStart);
   assert.equal(counters.individualRatings.length,ratingStart,'fallback scenarios never fetch a duplicate profile-header rating');
  }finally{globalThis.fetch=baseFetch;}
 }
 // A failed SDK keeps its rejected promise; the UI offers an honest page reload instead of a futile widget refresh.
 await render('de',null);const sdkApi=await import(new URL('../'+output+'/ui.mjs?sdk-failure',import.meta.url));let sdkAttempts=0;window.google={maps:{importLibrary:async()=>{sdkAttempts++;throw Error('Fictional SDK authorization failure');}}};
 await React.act(async()=>root.render(h(sdkApi.I18nProvider,{locale:'de',messages:sdkApi.getMessages('de',['common','public'])},h(sdkApi.GooglePlaceReviews,{workshop,identity:{placeId:'ChIJfixture',browserKey:'fixture-key'},status:'ready'}))));await show('google-reviews-panel');
 assert.equal(document.querySelector('.google-details-refresh').textContent,'Seite neu laden','SDK failures provide a real fresh-browser recovery action');assert.equal(sdkAttempts,1);await tab(false);await tab(true);assert.equal(sdkAttempts,1,'SDK failures do not automatically retry');
 console.log(JSON.stringify({locales:['de','sq','en'],duplicateEnterpriseDetails:0,individualRatings:0,firstVisibleAdvancedWidgets:1,photoMetadataRequests:0,previewPhotos:0,largePhotosBeforeAction:0,staleMinutes:30,hiddenIdentityRequests:0,offscreenConfigurationRequests:0,sharedCanonicalIdentity:true,reviewPresenceStableElement:true,asyncPublicReviewHydration:true,nativeWidgetReconnectsOnOwnReviews:0,providerFallbackModes:['disabled','identity-quota','identity-timeout'],photoRefreshes:0,lateLocalePlaceGuards:true,strictMode:true,liveProviderCalls:false}));
}finally{photoObserver.disconnect();await React.act(async()=>root.unmount());globalThis.setTimeout=nativeTimeout;globalThis.clearTimeout=nativeClearTimeout;dom.window.close();}
