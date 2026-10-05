import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {build} from 'esbuild';
import {JSDOM,VirtualConsole} from 'jsdom';

const dom=new JSDOM('<div id="root"></div>',{url:'https://riparim.example.test/verwaltung/bewertungen',pretendToBeVisual:true,virtualConsole:new VirtualConsole()});
for(const key of ['window','document','navigator','HTMLElement','HTMLButtonElement','HTMLFormElement','HTMLInputElement','HTMLSelectElement','HTMLTextAreaElement','DocumentFragment','Element','Node','NodeFilter','MutationObserver','CustomEvent','Event','MouseEvent','KeyboardEvent','getComputedStyle'])Object.defineProperty(globalThis,key,{value:dom.window[key],configurable:true});
globalThis.requestAnimationFrame=dom.window.requestAnimationFrame.bind(dom.window);
globalThis.cancelAnimationFrame=dom.window.cancelAnimationFrame.bind(dom.window);
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
// jsdom provides no layout; the actual picker still handles focus and keyboard events.
globalThis.ResizeObserver=class{observe(){}unobserve(){}disconnect(){}};
HTMLElement.prototype.scrollIntoView=function(){};
const out='.test-runtime/admin-reviews-ui';await mkdir(out,{recursive:true});
const bundle=await build({stdin:{contents:"export {default} from './app/[locale]/verwaltung/bewertungen/reviews';export {I18nProvider} from './lib/i18n/client';export {getMessages} from './lib/i18n/messages';",resolveDir:process.cwd(),loader:'tsx'},outfile:out+'/ui.mjs',bundle:true,write:false,format:'esm',platform:'node',packages:'external',plugins:[{name:'navigation-boundary',setup(b){
 b.onResolve({filter:/^next\/link$/},()=>({path:'link',namespace:'fixture'}));
 b.onLoad({filter:/.*/,namespace:'fixture'},()=>({loader:'js',resolveDir:process.cwd(),contents:"import React from 'react';export default function Link({href,children,...props}){return React.createElement('a',{...props,href},children)}"}));
}}]});
await writeFile(out+'/ui.mjs',bundle.outputFiles[0].contents);
const {createElement,act}=await import('react'),{createRoot}=await import('react-dom/client'),{default:AdminReviews,I18nProvider,getMessages}=await import(new URL('../'+out+'/ui.mjs',import.meta.url));
const visit={id:'00000000-0000-4000-8000-000000000001',workshop:'fixture-workshop',workshop_name:'Fiktive Werkstatt',date:'2026-10-04',vehicle:'Fixture Car',service:'Inspektion',evidence_type:'Dokument',evidence_note:'Private fictional evidence',status:'pending',moderator_note:'',display_name:'Fixture Driver',rating:4,review:'A sufficiently detailed fictional review of a workshop visit.',created_at:'2026-10-04',file_name:'fixture.pdf',revision:1};
let records=[visit],pendingCount=7,mode='success',mutationMode='success',nextCursor=null,resolveLoad;const requests=[];
globalThis.fetch=async(url,options)=>{
 const method=options?.method??'GET',body=options?.body?JSON.parse(options.body):null;requests.push({url,method,body});
 if(method==='PATCH'){
  assert.equal(url,'/api/visits');assert.equal(body.action,'moderate');
  if(mutationMode==='error')return Response.json({error:'Fixture decision conflict',errorCode:'review_conflict'},{status:409});
  records=records.map(record=>record.id===body.id?{...record,status:body.status,revision:record.revision+1}:record);
  if(mutationMode==='reload-error')mode='error';
  return Response.json({updated:true});
 }
 if(url.startsWith('/api/visits?moderation=1')){
  if(mode==='loading')return new Promise(resolve=>{resolveLoad=()=>resolve(Response.json({visits:records,nextCursor,pendingCount}));});
  if(mode==='error')return Response.json({error:'Fixture moderation unavailable',errorCode:'review_unavailable'},{status:503});
  if(mode==='forbidden')return Response.json({error:'Fixture access revoked',errorCode:'forbidden'},{status:403});
  if(url.includes('cursor='))return Response.json({visits:[{...visit,id:'00000000-0000-4000-8000-000000000002',workshop_name:'Ältere Werkstatt'}],nextCursor:null,pendingCount});
  return Response.json({visits:records,nextCursor,pendingCount});
 }
 if(url==='/api/notifications')return Response.json({notifications:[],nextCursor:null,configured:true});
 throw Error('Unexpected fixture request: '+url);
};
let root=createRoot(document.getElementById('root'));
const render=async()=>act(async()=>root.render(fixtureMessages(createElement(AdminReviews,{account:{email:'admin@example.test',displayName:'Fixture admin',provider:'Google'}}))));
const remount=async()=>{await act(async()=>root.unmount());root=createRoot(document.getElementById('root'));await render();};
const button=label=>[...document.querySelectorAll('button')].find(node=>node.textContent===label);
const click=async node=>{assert(node,'Expected accessible UI action exists');await act(async()=>{node.focus();node.click();});};
const type=async(node,value)=>act(async()=>{Object.getOwnPropertyDescriptor(node.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,'value').set.call(node,value);node.dispatchEvent(new Event('input',{bubbles:true}));});
const filter=async label=>{
 const trigger=document.querySelector('[role="combobox"]');
 await act(async()=>{trigger.focus();trigger.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true,cancelable:true}));});
 const option=[...document.querySelectorAll('[role="option"]')].find(node=>node.textContent===label);assert(option,'Expected status option remains');
 await act(async()=>{option.focus();option.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}));});
};
try{
 for(pendingCount of [0,7]){
  await remount();
  const main=document.querySelector('main'),title=main.querySelector('.admin-title'),tools=main.querySelector('.moderation-toolbar');
  assert.equal(title.textContent,'Bewertungen prüfen','The title area contains only the retained heading');
  assert.equal(main.querySelector('.moderation-count'),null,'The duplicate submission metric leaves no empty tile');
  assert.equal(tools.querySelector('button:not([role="combobox"])'),null,'The search and status toolbar has no manual refresh action');
  assert.equal(tools.querySelector('input').getAttribute('aria-label'),'Geladene Bewertungen durchsuchen');
  assert.equal(tools.querySelector('[role="combobox"]').getAttribute('aria-label'),'Prüfstatus filtern');
  assert.equal(main.querySelector('.moderation-loaded-count').textContent,'1 Einreichungen geladen · 1 in dieser Auswahl','The result count below the list remains');
  const navigation=document.querySelector('nav[aria-label="Verwaltung"]');
  assert.equal(navigation.querySelector('[aria-current="page"]').getAttribute('href'),'/verwaltung/bewertungen','The active administration destination remains');
 }
 const style=document.createElement('style');style.textContent=await readFile(new URL('../app/workshop-pages.css',import.meta.url),'utf8');document.head.append(style);
 assert.equal(getComputedStyle(document.querySelector('.admin-title h1')).marginTop,'0px','The heading does not reserve spacing for its removed eyebrow');
 style.remove();
 assert(!document.querySelector('.notification-panel'),'The complete notification delivery area is absent from moderation');
 assert(!requests.some(request=>request.url.startsWith('/api/notifications')),'The compact moderation page does not read or dispatch the delivery queue');
 mode='error';await remount();
 assert.equal(document.querySelector('main [role="alert"]').textContent,getMessages('de').customer.reviewUnavailable,'A failed initial load remains announced');
 assert(!document.querySelector('.empty'),'A failed load is not presented as an empty queue');
 assert(button('Einreichungen erneut laden'),'A failed initial load offers a focused recovery action');
 mode='success';await click(button('Einreichungen erneut laden'));
 assert.equal(document.querySelectorAll('.moderation-entry').length,1,'Recovery loads the same moderation queue');
 assert(!document.querySelector('main [role="alert"]')&&!button('Einreichungen erneut laden'),'Recovery removes its error and retry action');
 assert(button('Prüfen & veröffentlichen').disabled&&button('Ergänzung anfordern').disabled,'Moderation still requires a private reason');
 const note=document.querySelector('textarea');
 assert.equal(document.querySelector('label[for="'+note.id+'"]').textContent,'Prüfvermerk','The reason remains explicitly labelled');
 await type(note,'Fiktiver Nachweis wurde geprüft.');mutationMode='reload-error';
 await click(button('Prüfen & veröffentlichen'));
 assert.equal(document.querySelector('main [role="status"]').textContent,'Bewertung veröffentlicht.','An accepted decision remains confirmed even when its queue refresh fails');
 assert.equal(document.querySelector('main [role="alert"]').textContent,getMessages('de').customer.reviewUnavailable);
 assert(button('Einreichungen erneut laden'),'A failed queue refresh after successful moderation remains recoverable');
 const decisions=requests.filter(request=>request.method==='PATCH').length;
 mode='success';mutationMode='success';await click(button('Einreichungen erneut laden'));
 assert.equal(requests.filter(request=>request.method==='PATCH').length,decisions,'Recovering the list never repeats the successful moderation decision');
 assert.equal(document.querySelectorAll('.moderation-entry').length,0,'The published item leaves the open queue after recovery');
 await filter('Veröffentlicht');
 assert.equal(document.querySelector('.visit-status').textContent,'Veröffentlicht','The real status picker remains operable by keyboard');
 assert.equal(document.querySelector('.moderation-evidence a').getAttribute('href'),'/api/evidence/'+visit.id+'?locale=de','Private evidence retains its authorized localized download destination');
 await type(document.querySelector('textarea'),'Fiktive Ergänzung wird benötigt.');
 await click(button('Ausblenden & Ergänzung anfordern'));
 assert.equal(requests.filter(request=>request.method==='PATCH').at(-1).body.status,'needs_more','Published reviews retain the hide and supplement decision');
 await filter('Ergänzung nötig');
 assert.equal(document.querySelector('.visit-status').textContent,'Ergänzung nötig');
 await type(document.querySelector('textarea'),'Fiktiver Vermerk bleibt erhalten.');mutationMode='error';
 await click(button('Prüfen & veröffentlichen'));
 assert.equal(document.querySelector('main [role="alert"]').textContent,getMessages('de').customer.reviewConflict,'Decision conflicts remain announced');
 await click(button('Einreichungen erneut laden'));
 assert.equal(document.querySelector('textarea').value,'Fiktiver Vermerk bleibt erhalten.','Reading the queue after a failed decision preserves the private draft');
 mutationMode='success';await filter('Alle Status');
 const search=document.querySelector('input[aria-label="Geladene Bewertungen durchsuchen"]');
 await type(search,'fIxTuRe cAr');assert.equal(document.querySelectorAll('.moderation-entry').length,1,'Search preserves case-insensitive vehicle matching');
 await type(search,'unmatched fictional search');
 assert(document.querySelector('.empty').textContent.includes('Keine passenden Einreichungen geladen.'),'A search without matches retains its empty state');
 assert.equal(document.querySelector('.moderation-loaded-count').textContent,'1 Einreichungen geladen · 0 in dieser Auswahl');
 await type(search,'');
 nextCursor='fixture-cursor';await remount();await click(button('Weitere Einreichungen laden'));
 assert.equal(document.querySelectorAll('.moderation-entry').length,1,'The next page reaches an older pending review while the supplemented review stays filtered');
 assert.equal(document.querySelector('.moderation-loaded-count').textContent,'2 Einreichungen geladen · 1 in dieser Auswahl','Pagination appends instead of replacing loaded submissions');
 assert(!button('Weitere Einreichungen laden'),'The final page removes its continuation action');nextCursor=null;
 mode='loading';await remount();
 assert(document.querySelector('main [role="status"]').textContent.includes('Einreichungen werden geladen'),'Initial loading is announced');
 assert(!document.querySelector('.empty'),'Loading does not suggest an empty queue');
 await act(async()=>resolveLoad());mode='success';
 records=[];await remount();assert(document.querySelector('.empty').textContent.includes('Für diesen Filter liegt keine Einreichung vor.'),'An empty queue keeps the filter-specific guidance');
 records=[visit];await remount();mode='forbidden';await type(document.querySelector('textarea'),'Fiktive Ergänzung wird benötigt.');
 // A failed decision gives the user a safe read path; the next GET revokes access.
 mutationMode='error';await click(button('Ergänzung anfordern'));await click(button('Einreichungen erneut laden'));
 assert.equal(document.querySelectorAll('.moderation-entry').length,0,'Lost access clears previously loaded private reviews');
 assert.equal(document.querySelector('main [role="alert"]').textContent,getMessages('de').common.forbidden);
 assert(!requests.some(request=>request.url.startsWith('/api/notifications')),'Preserved decisions and recovery never dispatch delivery from this page');
 console.log('Review administration: compact layout, absent delivery panel, search, keyboard filter, evidence, decisions, pagination, recovery and load/access states passed');
}finally{await act(async()=>root.unmount());dom.window.close();}

function fixtureMessages(element){return createElement(I18nProvider,{locale:"de",messages:getMessages("de",["common","customer","management"])},element);}
