import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdir,writeFile} from 'node:fs/promises';
import {JSDOM,VirtualConsole} from 'jsdom';
const dom=new JSDOM('<div id="root"></div>',{url:'https://riparim.example.test/',pretendToBeVisual:true,virtualConsole:new VirtualConsole()});
for(const key of ['window','document','navigator','HTMLElement','HTMLButtonElement','HTMLInputElement','HTMLTextAreaElement','HTMLFormElement','HTMLSelectElement','customElements','DocumentFragment','Element','Node','NodeFilter','MutationObserver','CustomEvent','Event','MouseEvent','KeyboardEvent','getComputedStyle'])Object.defineProperty(globalThis,key,{value:dom.window[key],configurable:true});
globalThis.requestAnimationFrame=dom.window.requestAnimationFrame.bind(dom.window);globalThis.cancelAnimationFrame=dom.window.cancelAnimationFrame.bind(dom.window);globalThis.IS_REACT_ACT_ENVIRONMENT=true;
window.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});
const bundle=await build({stdin:{contents:`export {default as HomePage} from './app/[locale]/page';export {default as CataloguePage} from './app/[locale]/werkstaetten/page';export {default as ProfilePage} from './app/[locale]/werkstatt/[id]/page';export {default as SettingsPage} from './app/[locale]/einstellungen/page';export {WorkshopCard} from './components/workshop-card';export {default as PageError} from './app/[locale]/error';export {default as Finder} from './app/finder';export {default as Catalogue} from './app/[locale]/werkstaetten/catalogue';export {default as Profile} from './app/[locale]/werkstatt/[id]/profile';export {DirectoryFooter} from './components/directory-footer';export {WorkshopPhotos,WorkshopOpeningHours} from './components/workshop-google-details';export {GooglePlaceReviews} from './components/google-place-reviews';export {DetailSearch} from './app/journeys';export {PrivacyContent} from './app/[locale]/datenschutz/page';export {privacyMessages} from './lib/i18n/privacy-messages';export {I18nProvider} from './lib/i18n/client';export {getMessages,createTranslator} from './lib/i18n/messages';export {defaultCatalogueFilters,catalogueHref,matchCatalogue} from './lib/catalogue-filters';export {normalizeGoogleProfile} from './lib/google-workshop-profile';export {searchService} from './lib/search-service';export {rememberSearchSession,readSearchSession} from './lib/search-session';`,resolveDir:process.cwd(),loader:'tsx'},outfile:'.test-runtime/i18n-public-ui.mjs',bundle:true,write:false,platform:'node',format:'esm',jsx:'automatic',packages:'external',external:['react','react-dom','react/jsx-runtime'],plugins:[{name:'public-fixtures',setup(b){
 b.onResolve({filter:/^next\/(navigation|link)$/},a=>({path:a.path,namespace:'next-fixture'}));b.onLoad({filter:/.*/,namespace:'next-fixture'},a=>({loader:'js',contents:a.path==='next/link'?`import React from 'react';export default function Link({href,children,...props}){return React.createElement('a',{...props,href},children);}`:`export function redirect(){throw Error('Unexpected fixture redirect');}export function notFound(){throw Error('Unexpected fixture notFound');}export function useRouter(){return {push(){},refresh(){},prefetch(){}};}export function usePathname(){return '/';}export function useSearchParams(){return new URLSearchParams();}`}));
 b.onResolve({filter:/^@\/app\/auth$/},()=>({path:'auth',namespace:'server-fixture'}));b.onResolve({filter:/^@\/lib\/auth\/config$/},()=>({path:'config',namespace:'server-fixture'}));b.onLoad({filter:/.*/,namespace:'server-fixture'},a=>({loader:'js',contents:a.path==='auth'?`export async function getAppUser(){return null;}export async function getAdminUser(){return null;}`:`export function siteOrigin(){return 'https://riparim.example.test';}`}));
 b.onResolve({filter:/^@\/db\/(directory|storage)$/},a=>({path:a.path,namespace:'public-data-fixture'}));b.onLoad({filter:/.*/,namespace:'public-data-fixture'},a=>({loader:'js',contents:a.path.endsWith('/directory')?`export async function listWorkshops(){return globalThis.fixturePublicDirectory;}`:`export function storage(){return {db:{prepare(){return {bind(){return this;},async all(){return {results:[]};}}}}};}`}));
 b.onLoad({filter:/\.css$/},()=>({loader:'js',contents:`export default {logo:'brand-logo'};`}));
}}]});
await mkdir('.test-runtime',{recursive:true});await writeFile('.test-runtime/i18n-public-ui.mjs',bundle.outputFiles[0].text);
const api=await import(new URL('../.test-runtime/i18n-public-ui.mjs',import.meta.url));
const React=await import('react'),{renderToStaticMarkup}=await import('react-dom/server'),{createRoot}=await import('react-dom/client');
const h=React.createElement,wrap=(locale,node)=>h(api.I18nProvider,{locale,messages:api.getMessages(locale,['common','public'])},node);
const workshop={id:'fixture-workshop',name:'Fixture Workshop',city:'Prishtina',address:'Fixture Address',phone:'+38349123456',phoneNote:'Original contact note',whatsapp:'+38349123456',lat:42.66,lng:21.16,rating:4.5,count:2,specialty:'Original specialty',description:'Original description',services:['Bremsen & Fahrwerk'],serviceDetails:['Original service detail'],brands:['Volvo'],languages:['Deutsch'],sources:[{url:'https://example.test/source',title:'Original source title'}],checkedAt:'2026-10-04',status:'published',googleRating:null};
const profile=api.normalizeGoogleProfile({id:'ChIJFixture',businessStatus:'OPERATIONAL',currentOpeningHours:{openNow:true,weekdayDescriptions:['Monday: provider original','Sonntag: provider fallback'],periods:[{open:{day:0,hour:8,minute:0},close:{day:0,hour:16,minute:0}}]},photos:[{name:'places/ChIJFixture/photos/first'},{name:'places/ChIJFixture/photos/second'}]},'ChIJFixture');
const identity={placeId:'ChIJFixture',browserKey:'fixture-public-key'},props={initialWorkshops:[workshop],initialError:'',signedIn:false,account:null,isAdmin:false};
const nativeFetch=globalThis.fetch;globalThis.fetch=async()=>Response.json({enabled:false,workshops:[workshop]});
const placeOptions=[];window.google={maps:{importLibrary:async()=>({Place:class{constructor(options){this.options=options;placeOptions.push(options);}async fetchFields(){}}})}};
customElements.define('gmp-place-details',class extends HTMLElement{connectedCallback(){queueMicrotask(()=>this.dispatchEvent(new Event('gmp-load')));}});
const root=createRoot(document.getElementById('root')),click=async el=>{assert(el,'control exists');await React.act(async()=>el.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,button:0})));};
try{
 for(const locale of ['de','sq','en']){
  document.documentElement.lang=locale;
  const t=api.createTranslator(api.getMessages(locale));
  globalThis.fixturePublicDirectory=[workshop];
  const homePage=await api.HomePage({params:Promise.resolve({locale}),searchParams:Promise.resolve({})});window.history.replaceState({},'',`${locale==='de'?'':`/${locale}`}?nachweis=neu`);
  await React.act(async()=>root.render(h(api.I18nProvider,{locale,messages:api.getMessages(locale,['common'])},homePage)));
  assert(document.querySelector('h1').textContent.includes(t('public.heroCar'))&&!document.querySelector('[role="dialog"]'),'actual landing keeps public content without a general review dialog');
  await React.act(async()=>document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true})));window.history.replaceState({},'',locale==='de'?'/':`/${locale}`);
  const returnTarget=`${locale==='de'?'':`/${locale}`}/werkstaetten?q=Auto+Mita`,documentProfile=await api.ProfilePage({params:Promise.resolve({locale,id:workshop.id}),searchParams:Promise.resolve({suche:returnTarget})}),documentHtml=renderToStaticMarkup(h(api.I18nProvider,{locale,messages:api.getMessages(locale,['common'])},documentProfile)),documentDom=new JSDOM(documentHtml);
  try{assert.equal(documentDom.window.document.querySelector('.profile-back').getAttribute('href'),returnTarget,'actual profile document response must include validated name-search return before client hydration');}finally{documentDom.window.close();}
  window.history.replaceState({},'',`${locale==='de'?'':`/${locale}`}/werkstatt/${workshop.id}?${new URLSearchParams({suche:returnTarget})}`);await React.act(async()=>root.render(h(api.I18nProvider,{locale,messages:api.getMessages(locale,['common'])},documentProfile)));assert.equal(document.querySelector('.profile-back').getAttribute('href'),returnTarget,'actual fully mounted document caller preserves name query after locale document navigation');
  for(const source of ['https://outside.test/werkstaetten?q=secret','//outside.test/werkstaetten','/anmelden?weiter=private','/werkstaetten/../anmelden','/fr/werkstaetten?q=secret',`${locale==='de'?'':`/${locale}`}/werkstaetten?q=Auto+Mita&model=private&problem=private&access_token=secret`]){
   const safePage=await api.ProfilePage({params:Promise.resolve({locale,id:workshop.id}),searchParams:Promise.resolve({suche:source})}),safeDom=new JSDOM(renderToStaticMarkup(h(api.I18nProvider,{locale,messages:api.getMessages(locale,['common'])},safePage)));
   try{const back=safeDom.window.document.querySelector('.profile-back').getAttribute('href');assert.equal(back,source.includes('model=private')?returnTarget:`${locale==='de'?'':`/${locale}`}/werkstaetten`,'actual server caller rejects unsafe targets and sanitizes private query keys');assert(!back.includes('secret')&&!back.includes('private'));}finally{safeDom.window.close();}
  }
  window.history.replaceState({},'',locale==='de'?'/':`/${locale}`);

  const integratedProfile=await api.ProfilePage({params:Promise.resolve({locale,id:workshop.id})});await React.act(async()=>root.render(h(api.I18nProvider,{locale,messages:api.getMessages(locale,['common'])},integratedProfile)));await click(document.querySelector('.inline-review-toggle'));
  assert(document.querySelector('.inline-review-body').textContent.includes(t('public.reviewHelp'))&&document.querySelector('.inline-review-body').textContent.includes(t('customer.reviewLogin')),'actual profile caller retains public introduction and customer form namespace together');
  assert(document.querySelector('.inline-review-body').textContent.includes(workshop.name),'The workshop stays identifiable beside the profile review fields');
  assert.equal(new URL(document.querySelector('.inline-review-body .login-prompt a').href).searchParams.get('weiter'),`${locale==='de'?'':`/${locale}`}/werkstatt/${workshop.id}#bewerten`,'Profile login returns to its localized inline form');
  const settingsPage=await api.SettingsPage({params:Promise.resolve({locale})}),settingsDom=new JSDOM(renderToStaticMarkup(h(api.I18nProvider,{locale,messages:api.getMessages(locale,['common'])},settingsPage)));
  try{const footer=settingsDom.window.document.querySelector('footer');assert(footer.textContent.includes(t('public.tagline'))&&footer.textContent.includes(t('public.sourcesProof'))&&footer.textContent.includes(t('public.privacy')),'actual settings caller supplies localized public footer messages');assert(!footer.textContent.includes(t('common.unavailable')),'settings footer cannot render missing-namespace fallbacks');assert.equal(footer.querySelector('a[href$="/datenschutz"]').getAttribute('href'),locale==='de'?'/datenschutz':`/${locale}/datenschutz`);}finally{settingsDom.window.close();}
  const pageError=renderToStaticMarkup(wrap(locale,h(api.PageError,{error:new Error('provider-personal-error'),reset(){}})));assert(pageError.includes(t('common.unavailable'))&&!pageError.includes('provider-personal-error'),'SSR error boundary displays stable localized fallback');
  window.history.replaceState({},'',`${locale==='de'?'':`/${locale}`}/werkstaetten?bewerten=1`);
  const reviewFinder=await api.CataloguePage({params:Promise.resolve({locale}),searchParams:Promise.resolve({bewerten:'1'})});
  await React.act(async()=>root.render(h(api.I18nProvider,{locale,messages:api.getMessages(locale,['common'])},reviewFinder)));
  assert(document.querySelector('.catalogue-page > .note').textContent.includes(t('public.reviewEntryHelp'))&&new URLSearchParams(window.location.search).get('bewerten')==='1','The actual finder caller explains the new profile entry and retains context through hydration');
  const nameInput=document.querySelector('.catalogue-name-search input');await React.act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(nameInput,'Fixture');nameInput.dispatchEvent(new Event('input',{bubbles:true}));});
  assert(new URLSearchParams(window.location.search).get('bewerten')==='1'&&new URLSearchParams(window.location.search).get('q')==='Fixture','Changing public search filters preserves the review-selection notice for reload');
  const reloadQuery=Object.fromEntries(new URLSearchParams(window.location.search)),reloadedFinder=await api.CataloguePage({params:Promise.resolve({locale}),searchParams:Promise.resolve(reloadQuery)});
  await React.act(async()=>root.render(null));await React.act(async()=>root.render(h(api.I18nProvider,{locale,messages:api.getMessages(locale,['common'])},reloadedFinder)));
  assert(document.querySelector('.catalogue-page > .note').textContent.includes(t('public.reviewEntryHelp'))&&document.querySelector('.catalogue-name-search input').value==='Fixture','A fresh document entry restores review context and current public search');
  window.history.replaceState({},'',locale==='de'?'/':`/${locale}`);
  await React.act(async()=>root.render(wrap(locale,h(api.Finder,props))));
  window.history.replaceState({},'',`${locale==='de'?'':`/${locale}`}?nachweis=neu`);await React.act(async()=>window.dispatchEvent(new Event('popstate')));assert.equal(document.querySelector('[role="dialog"]'),null,'A legacy query cannot open a general review dialog after hydration');window.history.replaceState({},'',locale==='de'?'/':`/${locale}`);
  const cityChoice=document.querySelectorAll('.search-box [role="combobox"]')[1],cityNative=document.querySelectorAll('.search-box select')[1];assert.equal(cityChoice.textContent,{de:'Ganz Kosovo',sq:'E gjithë Kosova',en:'All of Kosovo'}[locale],'quick-search default location sentinel is displayed in active locale');assert.equal(cityNative.value,'Ganz Kosovo','location label cannot change canonical selected value');
  const canonicalBrands=['Alle Marken','Volvo'],cardDom=new JSDOM(renderToStaticMarkup(wrap(locale,h(api.WorkshopCard,{workshop:{...workshop,brands:canonicalBrands},selectedBrand:'Volvo'}))));
  try{assert.deepEqual([...cardDom.window.document.querySelectorAll('.catalogue-card-brands span')].map(node=>node.textContent),['Volvo',{de:'Alle Marken',sq:'Të gjitha markat',en:'All brands'}[locale]],'actual workshop card localizes sentinels while keeping genuine brands');assert.deepEqual(canonicalBrands,['Alle Marken','Volvo'],'rendering labels never mutates canonical brands');}finally{cardDom.window.close();}
  const landing=renderToStaticMarkup(wrap(locale,h(api.Finder,props)));
  assert(landing.includes(t('public.heroCar'))&&landing.includes(t('public.heroWorkshop'))&&landing.includes(t('public.mechanicAlt')));
  for(const count of [0,1,2]){
   const records=Array.from({length:count},(_,i)=>({...workshop,id:`fixture-workshop-${i}`,name:`Fixture ${i}`}));
   const catalogue=renderToStaticMarkup(wrap(locale,h(api.Catalogue,{...props,initialWorkshops:records,initialFilters:api.defaultCatalogueFilters})));
   assert(catalogue.includes(t('public.workshopCount',{count})),`${locale}: 0/1/2 result copy`);
   assert.equal((catalogue.match(/class="catalogue-card"/g)??[]).length,count);
  }
  for(const query of ['Ganz Kosovo','Alle Marken','Alle Sprachen','Alle Leistungen','Kein weiterer Ort','Nur im Ort']){
   const collisionFilters={...api.defaultCatalogueFilters,query},chipDom=new JSDOM(renderToStaticMarkup(wrap(locale,h(api.Catalogue,{...props,initialFilters:collisionFilters}))));
   try{const chip=chipDom.window.document.querySelector('.catalogue-filter-chip');assert.equal(chip.textContent,`${t('public.workshopName')}: ${query}`,`${locale}: free search text cannot collide with canonical sentinel labels`);assert.equal(chip.getAttribute('aria-label'),t('public.removeFilter',{label:t('public.workshopName'),value:query}),'search chip ARIA preserves original user input');assert.equal(new URL(api.catalogueHref(collisionFilters,locale),'https://fixture.test').searchParams.get('q'),query,'search URL keeps original canonical user query');}finally{chipDom.window.close();}
  }
  const privateContext={brand:'Alle Marken',model:'Fixture Private Car',year:'2019',problem:'Original private problem text',service:'Alle Leistungen',city:'Prishtina',additionalCity:'',radius:0,from:'',to:''},privateFilters={...api.defaultCatalogueFilters,city:'Prishtina'};
  api.rememberSearchSession({...privateFilters,searched:true,context:privateContext,privateMatchingActive:true,catalogueHref:api.catalogueHref(privateFilters,locale),visibleCount:12,scrollY:0});
  await React.act(async()=>root.render(wrap(locale,h(api.Catalogue,{...props,initialFilters:privateFilters}))));
  const privateHeading=document.querySelector('.catalogue-private-context strong');assert(privateHeading.textContent.includes({de:'Alle Marken',sq:'Të gjitha markat',en:'All brands'}[locale]),'private search summary localizes canonical brand sentinel');assert(privateHeading.textContent.includes(privateContext.model));assert.equal(api.readSearchSession().context.brand,'Alle Marken','private canonical brand remains unchanged');
  const failed=renderToStaticMarkup(wrap(locale,h(api.Catalogue,{...props,initialWorkshops:[],initialError:'unavailable',initialFilters:api.defaultCatalogueFilters})));
  assert(failed.includes(t('public.directoryUnavailable'))&&!failed.includes('provider-error-with-private-content'));
  const unknown=renderToStaticMarkup(wrap(locale,h(api.Catalogue,{...props,initialWorkshops:[],initialError:'provider-error-with-private-content',initialFilters:api.defaultCatalogueFilters})));assert(unknown.includes(t('common.errorGeneric'))&&!unknown.includes('provider-error-with-private-content'),'unknown SSR codes use shared safe generic copy');
  const page=renderToStaticMarkup(wrap(locale,h(api.Profile,{workshop,directory:[workshop],reviews:[],reviewError:'unavailable',signedIn:false,account:null,isAdmin:false})));
  assert(page.includes(t('public.call'))&&page.includes(t('public.route'))&&page.includes(t('public.reviewUnavailable'))&&!page.includes('private-error'));
  assert(page.includes('Original specialty')&&page.includes('Original description')&&page.includes('Original source title'),'editorial and factual originals remain separate');
  if(locale!=='de'){
   const fallback={specialty:workshop.specialty,description:workshop.description,serviceDetails:workshop.serviceDetails,phoneNote:workshop.phoneNote,sourceTitles:workshop.sources.map(source=>source.title),fallback:'stale'};
   const fallbackDom=new JSDOM(renderToStaticMarkup(wrap(locale,h(api.Profile,{workshop,directory:[workshop],display:fallback,reviews:[],reviewError:'',signedIn:false,account:null,isAdmin:false}))));
   try{assert(fallbackDom.window.document.querySelector('.workshop-translation-notice'),'changed live text must visibly explain its original-language fallback');assert.notEqual(fallbackDom.window.document.querySelector('.profile-description').getAttribute('lang'),'de','unknown live original cannot be assumed German');const knownDom=new JSDOM(renderToStaticMarkup(wrap(locale,h(api.Profile,{workshop,directory:[workshop],display:{...fallback,originalLanguage:'de'},reviews:[],reviewError:'',signedIn:false,account:null,isAdmin:false}))));try{assert.equal(knownDom.window.document.querySelector('.profile-description').getAttribute('lang'),'de');assert.equal(knownDom.window.document.querySelector('.profile-specialty').getAttribute('lang'),'de');}finally{knownDom.window.close();}const cardFallback=new JSDOM(renderToStaticMarkup(wrap(locale,h(api.WorkshopCard,{workshop,display:fallback}))));try{assert(cardFallback.window.document.querySelector('.workshop-translation-notice'));}finally{cardFallback.window.close();}}finally{fallbackDom.window.close();}
  }
  assert(page.includes(locale==='de'?'Deutsch':locale==='sq'?'Gjermanisht':'German'),'confirmed consultation language is labelled without becoming UI locale');
  const originalDetails=['Elektronische Diagnose laut öffentlichem Verzeichnis. Konkreten Umfang direkt klären.','Elektronische Diagnose','Konkreten Umfang direkt klären.','Bremsenservice','Weitere Hilfe'];
  const alignedWorkshop={...workshop,services:['Diagnose & Elektronik','Bremsen & Fahrwerk'],serviceDetails:originalDetails},alignedDisplay={specialty:'Diagnostikë ëç',description:'Përshkrim <img src=x onerror=alert(1)> ëç',serviceDetails:['Diagnostikë e parë <script>BAD</script>','NEVER DUPLICATE','NEVER EMPTY','Frena të sigurta sipas burimit','Ndihmë tjetër'],phoneNote:'Kontakti ende nuk është konfirmuar.',sourceTitles:['Burim <b>origjinal</b> ëç']};
  const translatedDom=new JSDOM(renderToStaticMarkup(wrap(locale,h(api.Profile,{workshop:alignedWorkshop,directory:[alignedWorkshop],display:alignedDisplay,reviews:[{display_name:'Original reviewer',vehicle:'Original vehicle',service:'Bremsen & Fahrwerk',date:'2026-10-01',rating:5,review:'Original private-to-approved review'}],reviewError:'',signedIn:false,account:null,isAdmin:false}))));
  try{const doc=translatedDom.window.document;assert.equal(doc.querySelector('.profile-description').textContent,alignedDisplay.description);assert.equal(doc.querySelector('.profile-description img'),null);assert.deepEqual([...doc.querySelectorAll('.profile-service-group li')].map(el=>el.textContent),locale==='de'?['Elektronische Diagnose','Bremsenservice','Weitere Hilfe']:[alignedDisplay.serviceDetails[0],alignedDisplay.serviceDetails[3],alignedDisplay.serviceDetails[4]]);assert.equal(doc.querySelector('.profile-service-group script'),null);assert.equal(doc.querySelector('.profile-source-list strong').textContent,alignedDisplay.sourceTitles[0]);assert.equal(doc.querySelector('.profile-source-list strong b'),null);assert.equal(doc.querySelector('.profile-source-list a').getAttribute('href'),workshop.sources[0].url);assert(doc.querySelector('.profile-sources-content').textContent.includes(alignedDisplay.phoneNote));assert(doc.querySelector('.profile-riparim-reviews .review-meta').textContent.includes('Bremsen & Fahrwerk'));assert(doc.querySelector('.profile-riparim-reviews .review-meta').textContent.includes('Original vehicle'));assert(doc.querySelector('.profile-riparim-reviews').textContent.includes('Original private-to-approved review'));assert.equal(doc.querySelector('a[href^="tel:"]').getAttribute('href'),'tel:'+workshop.phone);assert.equal(doc.querySelector('.workshop-translation-notice'),null);}finally{translatedDom.window.close();}
  assert.deepEqual(alignedWorkshop.serviceDetails,originalDetails,'rendering cannot change business/review/filter detail values');
  const rawCard={...workshop,services:[],serviceDetails:['Original small detail']},cardDisplay={...alignedDisplay,serviceDetails:['Detaj i përkthyer ëç']};
  const sessionBeforeRefresh=api.readSearchSession();
  const refreshedRequests=[];globalThis.fetch=async(url)=>{refreshedRequests.push(String(url));return Response.json(String(url).startsWith('/api/workshops')?{workshops:[rawCard],displayById:{[rawCard.id]:cardDisplay}}:{enabled:false});};
  await React.act(async()=>root.render(wrap(locale,h(api.Catalogue,{...props,key:`refresh-${locale}`,initialWorkshops:[],initialDisplayById:{},initialError:'unavailable',initialFilters:api.defaultCatalogueFilters}))));
  await click(document.querySelector('.catalogue-load-error button'));
  assert(refreshedRequests.includes(`/api/workshops?locale=${locale}`),'public refresh explicitly requests the current UI locale');
  assert.equal(document.querySelector('.catalogue-card-services span').textContent,cardDisplay.serviceDetails[0],'refresh updates display content with canonical directory');
  assert.equal(rawCard.serviceDetails[0],'Original small detail');
  if(sessionBeforeRefresh)api.rememberSearchSession(sessionBeforeRefresh);
  globalThis.fetch=async()=>Response.json({enabled:false,workshops:[workshop]});
  await React.act(async()=>root.render(wrap(locale,h(api.Profile,{workshop,directory:[workshop],reviews:[],reviewError:'',signedIn:false,account:null,isAdmin:false}))));
  await click(document.querySelector('.profile-share'));
  assert(document.querySelector('.workshop-page-aside > p[role="status"]').textContent.includes(t('public.copyManual')),'clipboard failure gets localized fallback');
  let copied;Object.defineProperty(navigator,'clipboard',{value:{async writeText(value){copied=value;}},configurable:true});
  await click(document.querySelector('.profile-share'));assert.equal(copied,`https://riparim.example.test${locale==='de'?'':`/${locale}`}/werkstatt/${workshop.id}`,'share contains clean locale profile URL only');
  assert(document.querySelector('.workshop-page-aside > p[role="status"]').textContent.includes(t('public.profileCopied')));
  delete navigator.clipboard;
  await click(document.querySelector('.workshop-overview-actions button'));
  const contact=document.querySelector('[role="dialog"]');assert(contact.querySelector('textarea').value.includes(t('public.whatsAppHello',{name:workshop.name}))&&contact.querySelector('textarea').value.includes(t('public.messageAsk')));
  assert(contact.querySelector('a[href^="https://wa.me"]').getAttribute('href').includes('text='));
  const message=contact.querySelector('textarea').value;assert(message.includes({de:'Alle Marken',sq:'Të gjitha markat',en:'All brands'}[locale]),'WhatsApp localizes only the brand sentinel');assert(message.includes(privateContext.model)&&message.includes(privateContext.problem),'actual private vehicle/problem text stays original');assert.equal(api.readSearchSession().context.brand,'Alle Marken');
  await React.act(async()=>document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true})));

  const privacy=renderToStaticMarkup(wrap(locale,h(api.PrivacyContent,{text:api.privacyMessages[locale]})));
  assert.equal((privacy.match(/<section/g)??[]).length,9);
  assert(privacy.includes('<code>openid</code>')&&privacy.includes('<strong>')&&privacy.includes('mailto:')&&!privacy.match(/\{(?:contact|publishedFields|openid|google)\}/));
  assert(privacy.includes(api.privacyMessages[locale].date)&&privacy.includes('Resend')&&privacy.includes('Supabase'));
  assert.equal(api.searchService(locale,'Alle Leistungen','Bremsen prüfen bitte'),locale==='de'?'Bremsen & Fahrwerk':'Alle Leistungen','only DE applies the existing heuristic');
  assert.equal(api.searchService(locale,'Motor & Getriebe','Bremsen prüfen bitte'),'Motor & Getriebe','manual canonical selection always wins');
  const filters={...api.defaultCatalogueFilters,service:'Bremsen & Fahrwerk',language:'Deutsch'};
  assert.deepEqual(api.matchCatalogue([workshop,{...workshop,id:'draft-workshop',status:'draft'}],filters,null,false,{},locale).map(w=>w.id),['fixture-workshop']);
  const href=api.catalogueHref(filters,locale);assert(href.includes('leistung=bremsen-fahrwerk')&&href.includes('sprache=de')&&!href.includes('frena'));
  let search;
  const context={brand:'Volvo',model:'Fixture model',year:'',problem:'Bremsen prüfen bitte',service:'Alle Leistungen',city:'Prishtina',additionalCity:'',radius:0,from:'',to:''};
  await React.act(async()=>root.render(wrap(locale,h(api.DetailSearch,{open:true,onClose(){},onSearch(value){search=value;},initialContext:context}))));
  for(let step=0;step<3;step++)await React.act(async()=>document.querySelector('.journey-form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
  assert.equal(search.service,locale==='de'?'Bremsen & Fahrwerk':'Alle Leistungen',`${locale}: actual wizard cannot silently use German keyword classification`);
  assert.equal(search.problem,context.problem,'private problem text is neither translated nor mutated');
  await React.act(async()=>root.render(wrap(locale,h(api.WorkshopPhotos,{name:workshop.name,profile,identity,status:'ready'}))));
  const opener=document.querySelector('button[aria-haspopup="dialog"]');await click(opener);
  let gallery=document.querySelector('[role="dialog"]');assert(gallery&&gallery.contains(document.activeElement),'gallery owns keyboard focus');
  assert(gallery.textContent.includes('1 / 2'));
  await React.act(async()=>gallery.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true,cancelable:true})));
  assert(gallery.textContent.includes('2 / 2'),'arrow key selects next actual photo');
  assert(gallery.querySelector('img').getAttribute('alt')===t('public.largePhotoAlt',{count:2,name:workshop.name}));
  await React.act(async()=>gallery.querySelector('.profile-gallery-stage img').dispatchEvent(new Event('error')));assert.equal(gallery.querySelector('.profile-photo-error').textContent,`${t('public.photoFailed')} ${t('public.chooseAnotherPhoto')}`,'complete multiple-photo error paragraph separates its sentences');
  await React.act(async()=>document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true})));
  await React.act(async()=>new Promise(resolve=>setTimeout(resolve,0)));
  assert(!document.querySelector('[role="dialog"]')&&document.activeElement===opener,'Escape returns focus to originating photo');
  for(const photoCount of [1,2]){
   await React.act(async()=>root.render(wrap(locale,h(api.WorkshopPhotos,{name:workshop.name,profile:{...profile,photos:profile.photos.slice(0,photoCount)},identity,status:'ready'}))));await click(document.querySelector('button[aria-haspopup="dialog"]'));
   const errorDialog=document.querySelector('[role="dialog"]');await React.act(async()=>errorDialog.querySelector('.profile-gallery-stage img').dispatchEvent(new Event('error')));
   assert.equal(errorDialog.querySelector('.profile-photo-error').textContent,`${t('public.photoFailed')} ${t(photoCount===1?'public.reopenPhoto':'public.chooseAnotherPhoto')}`,`${locale}: complete error paragraph has an explicit sentence separator for ${photoCount} photos`);
   await React.act(async()=>document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true})));await React.act(async()=>new Promise(resolve=>setTimeout(resolve,0)));
  }
  await React.act(async()=>root.render(wrap(locale,h(api.DirectoryFooter))));
  await click(document.querySelector('footer button'));
  const dialog=document.querySelector('[role="dialog"]');assert(dialog.textContent.includes(t('public.businessInfoHelp'))&&dialog.textContent.includes(t('public.yourDataHelp')));
  await React.act(async()=>document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true})));
 }
}finally{await React.act(async()=>root.unmount());globalThis.fetch=nativeFetch;dom.window.close();}
console.log('DE/SQ/EN public UI: results, stable canonical filters/permissions, original facts, error fallbacks, full privacy and real gallery/footer keyboard focus passed');
