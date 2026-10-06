import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdir,writeFile} from 'node:fs/promises';
import {JSDOM,VirtualConsole} from 'jsdom';
const dom=new JSDOM('<div id="root"></div>',{url:'https://riparim.example.test/en/anmelden',pretendToBeVisual:true,virtualConsole:new VirtualConsole()});
for(const key of ['window','document','navigator','HTMLElement','HTMLButtonElement','HTMLFormElement','HTMLInputElement','HTMLTextAreaElement','HTMLSelectElement','DocumentFragment','Element','Node','NodeFilter','MutationObserver','CustomEvent','Event','MouseEvent','KeyboardEvent','getComputedStyle','FormData'])Object.defineProperty(globalThis,key,{value:dom.window[key],configurable:true});
globalThis.requestAnimationFrame=dom.window.requestAnimationFrame.bind(dom.window);globalThis.cancelAnimationFrame=dom.window.cancelAnimationFrame.bind(dom.window);globalThis.IS_REACT_ACT_ENVIRONMENT=true;globalThis.ResizeObserver=class{observe(){}unobserve(){}disconnect(){}};
const out='.test-runtime/customer-localization-ui.mjs';
const result=await build({stdin:{contents:`export {default as AuthForm} from './app/auth-form';export {ReviewForm} from './components/review-form';export {MyVisits,VisitForm} from './app/journeys';export {ThemeSettings} from './components/theme-settings';export {SiteHeader} from './components/site-header';export {I18nProvider} from './lib/i18n/client';export {getMessages} from './lib/i18n/messages';`,resolveDir:process.cwd(),loader:'tsx'},outfile:out,bundle:true,write:false,format:'esm',platform:'node',packages:'external',loader:{'.css':'empty','.module.css':'empty'},plugins:[{name:'router-boundary',setup(b){b.onResolve({filter:/^next\/(link|navigation)$/},args=>({path:args.path,namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},args=>({loader:'js',resolveDir:process.cwd(),contents:args.path==='next/link'?"import React from 'react';export default function Link({href,children,...props}){return React.createElement('a',{...props,href},children);}":"export function useRouter(){return {refresh(){}}};"}));}}]});await mkdir('.test-runtime',{recursive:true});await writeFile(out,result.outputFiles[0].contents);
const {createElement,act}=await import('react'),{createRoot}=await import('react-dom/client');
const {AuthForm,ReviewForm,MyVisits,VisitForm,ThemeSettings,SiteHeader,I18nProvider,getMessages}=await import(new URL('../'+out,import.meta.url));
let root=createRoot(document.getElementById('root')),passed=0;const check=(condition,label)=>{assert(condition,label);passed++;};
const button=label=>[...document.querySelectorAll('button')].find(node=>node.textContent===label);
const click=async control=>{assert(control);await act(async()=>{control.focus();control.click();});};
async function render(locale,Component,props={}){await act(async()=>root.unmount());root=createRoot(document.getElementById('root'));await act(async()=>root.render(createElement(I18nProvider,{locale,messages:getMessages(locale,['common','customer'])},createElement(Component,props))));}
const type=async(node,value)=>{await act(async()=>{Object.getOwnPropertyDescriptor(node.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,'value').set.call(node,value);node.dispatchEvent(new Event('input',{bubbles:true}));});};
const submit=async()=>act(async()=>document.querySelector('form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
const requests=[];let mode='auth-error';
const originalFetch=globalThis.fetch;
globalThis.fetch=async(url,init)=>{
 requests.push({url,init});
 if(url==='/api/visits'&&!init?.method)return Response.json({visits:[{id:'11111111-1111-4111-8111-111111111111',workshop:'fixture-workshop',workshop_name:'Original name',date:'2026-10-04',vehicle:'Original car',service:'Inspektion & Wartung',evidence_type:'Rechnung',evidence_note:'Original private note',status:'needs_more',moderator_note:'Original moderation note',display_name:'Original reviewer',rating:4,review:'Original unchanged customer review text.',file_name:'original.png'}],nextCursor:null});
 if(mode==='review-success')return Response.json({status:'pending'});
 if(mode==='network')throw new TypeError('Raw provider/internal failure must never be rendered');
 if(url==='/api/visits')return Response.json({error:'Deutscher Originalfehler',errorCode:'review_conflict'},{status:409});
 if(mode==='auth-success')return Response.json({message:'Deutscher Providertext',messageCode:'confirm_email'});
 return Response.json({error:'Deutscher Rohfehler mit privaten Daten',errorCode:'invalid_email'},{status:400});
};
try{
 for(const locale of ['de','sq','en']){
  const prefix=locale==='de'?'':'/'+locale,copy=getMessages(locale).customer;
  for(const [screen,heading] of [['login','authLogin'],['register','authRegister'],['recovery','authRecovery'],['reset','authReset']]){
   await render(locale,AuthForm,{account:null,screen,emailReady:true,googleReady:true,isOwner:false,returnTo:prefix+'/werkstatt/fixture-workshop#bewerten'});
   check(document.querySelector('h1').textContent===copy[heading],'Auth heading uses the active locale');
   if(screen!=='recovery'){
    const reveal=document.querySelector('[aria-label="'+copy.showPassword+'"]');check(reveal,'Password toggle has an active-locale accessible label');await click(reveal);check(document.querySelector('[name="password"]').type==='text'&&document.querySelector('[aria-label="'+copy.hidePassword+'"]'),'Password visibility preserves accessible state');
   }
  }
  await render(locale,AuthForm,{account:null,screen:'register',emailReady:true,googleReady:true,isOwner:false,returnTo:prefix+'/werkstatt/fixture-workshop#bewerten'});
  await type(document.querySelector('[name="email"]'),'fixture@example.test');await type(document.querySelector('[name="password"]'),'fixture-password-123');mode='auth-error';await submit();
  check(document.querySelector('[role="alert"]').textContent===copy.invalidEmail&&!document.body.textContent.includes('privaten Daten'),'Auth errors use only stable codes, never raw provider copy');
  const payload=JSON.parse(requests.at(-1).init.body);check(payload.locale===locale&&payload.returnTo===prefix+'/werkstatt/fixture-workshop#bewerten','Every custom Auth action sends explicit locale and its safe target');
  mode='auth-success';await submit();check(document.querySelector('.auth-success').textContent.includes(copy.confirmEmailMessage),'Confirmation success is localized without exposing legacy provider text');
  check(document.querySelector('.auth-success a').getAttribute('href').startsWith(prefix+'/anmelden?weiter='),'Success returns to localized login');
  await render(locale,AuthForm,{account:null,screen:'reset',emailReady:true,googleReady:false,isOwner:false,returnTo:prefix});await type(document.querySelector('[name="password"]'),'fixture-password-123');await type(document.querySelector('[name="passwordRepeat"]'),'other-password-123');const before=requests.length;await submit();
  check(document.querySelector('[role="alert"]').textContent===copy.passwordMismatch&&requests.length===before,'Password mismatch is local and never reaches the API');
  await render(locale,ThemeSettings);check(document.querySelector('h2').textContent===copy.appearance&&document.body.textContent.includes(copy.themeSystemNote),'Appearance settings and descriptions are localized');
  await render(locale,ReviewForm,{signedIn:true,workshop:{id:'fixture-workshop',name:'Original workshop',services:['Inspektion & Wartung']},directory:[{id:'fixture-workshop'}],returnTo:prefix+'/werkstatt/fixture-workshop#bewerten'});
  check(document.querySelector('[name="file"]').required&&document.querySelector('[name="review"]').minLength===30,'New profile reviews retain required private receipt and review validation');
  const beforeNew=requests.length;await submit();check(document.querySelector('[role="alert"]').textContent===copy.chooseStars&&requests.length===beforeNew,'A missing rating announces validation before any submission');
  await click(document.querySelector('[role="radio"][aria-label="'+copy.stars.other.replace('{count}','4')+'"]'));
  await submit();check(document.querySelector('[role="checkbox"]').getAttribute('aria-invalid')==='true'&&requests.length===beforeNew,'Consent remains required before new submission');
  await type(document.querySelector('[name="date"]'),'2026-10-04');await type(document.querySelector('[name="vehicle"]'),'Synthetic vehicle');await type(document.querySelector('[name="review"]'),'Synthetic review with more than thirty characters.');await type(document.querySelector('[name="name"]'),'Synthetic customer');
  const kindSelect=[...document.querySelectorAll('select')].find(node=>[...node.options].some(option=>option.value==='Anderer Nachweis'));
  await act(async()=>{kindSelect.value='Anderer Nachweis';kindSelect.dispatchEvent(new Event('change',{bubbles:true}));});
  await type(document.querySelector('[name="evidenceNote"]'),'Synthetic private explanation with more than forty characters.');await click(document.querySelector('[role="checkbox"]'));mode='review-success';await submit();
  const created=requests.at(-1);check(created.init.method==='POST'&&created.init.body.get('workshop')==='fixture-workshop'&&created.init.body.get('rating')==='4'&&created.init.body.get('evidenceType')==='Anderer Nachweis'&&created.init.body.get('evidenceNote').includes('Synthetic private explanation')&&created.init.body.get('consent')==='true'&&created.init.body.get('revision')==='0','New review and private evidence use one submission assigned to the profile workshop');
  check(document.querySelector('[role="status"]').textContent.includes(copy.reviewSubmittedNote),'Success explains publication after private moderation');
  const existing={id:'11111111-1111-4111-8111-111111111111',workshop:'fixture-workshop',date:'2026-10-04',vehicle:'Original vehicle',service:'Inspektion & Wartung',evidence_type:'Rechnung',evidence_note:'Original private note',status:'approved',moderator_note:'Original moderation note',display_name:'Original name',rating:4,review:'An existing original review with enough detail.',file_name:'original.png',revision:7};
  await render(locale,ReviewForm,{signedIn:true,workshop:{id:'fixture-workshop',services:['Inspektion & Wartung']},directory:[{id:'fixture-workshop',services:['Inspektion & Wartung'],name:'Original workshop'}],existing,returnTo:prefix+'/werkstatt/fixture-workshop'});
  check(document.querySelector('form').textContent.includes('Original workshop'),'The review form names the assigned workshop next to its fields');
  check(document.querySelector('form').getAttribute('aria-label')===copy.reviewForm&&document.querySelector('[name="vehicle"]').value==='Original vehicle','Review ARIA is localized and existing private originals remain unchanged');
  const stars=document.querySelectorAll('[role="radio"]');check(stars[0].getAttribute('aria-label')===copy.stars.one.replace('{count}','1'),'Star controls have localized singular labels');
  await act(async()=>{stars[3].focus();stars[3].dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true,cancelable:true}));});check(document.activeElement===stars[4]&&stars[4].getAttribute('aria-checked')==='true','Arrow-key selection and focus remain accessible');
  await click(document.querySelector('[role="checkbox"]'));mode='auth-error';await submit();
  const submission=requests.at(-1);check(submission.url==='/api/visits'&&submission.init.method==='PUT'&&submission.init.body.get('service')==='Inspektion & Wartung'&&submission.init.body.get('evidenceType')==='Rechnung'&&submission.init.body.get('keepEvidence')==='true'&&submission.init.body.get('revision')==='7','Older visits retain canonical values and their private receipt when edited in every locale');
  check(document.querySelector('[role="alert"]').textContent===copy.reviewConflict&&!document.body.textContent.includes('Deutscher Originalfehler'),'Review conflicts localize by code while keeping edits');
  mode='network';await submit();check(document.querySelector('[role="alert"]').textContent===copy.reviewUnavailable,'Review network failures retain input and localize safely');
  await render(locale,ReviewForm,{signedIn:true,workshop:null,directory:[{id:'other-workshop',name:'New selected workshop',services:['Inspektion & Wartung']}],existing:{...existing,workshop_name:'Original unavailable workshop'},returnTo:prefix+'/werkstatt/fixture-workshop'});
  const workshopSelect=[...document.querySelectorAll('select')].find(node=>[...node.options].some(option=>option.value==='other-workshop'));
  await act(async()=>{workshopSelect.value='other-workshop';workshopSelect.dispatchEvent(new Event('change',{bubbles:true}));});
  check(document.querySelector('form > .note strong').textContent.includes('New selected workshop')&&!document.querySelector('form > .note strong').textContent.includes('Original unavailable workshop'),'Existing workshop selection keeps the displayed identity aligned with its assigned submission');
  await render(locale,VisitForm,{open:true,onClose(){},workshop:{id:'fixture-workshop',name:'Original workshop',services:['Inspektion & Wartung']},directory:[{id:'fixture-workshop'}],signedIn:false,existing});
  const editLogin=new URL(document.querySelector('.login-prompt a').href);
  check(editLogin.pathname===prefix+'/anmelden'&&editLogin.searchParams.get('weiter')===prefix+'/bewertungen?einreichung='+existing.id,'Editing auth returns to the localized targeted own submission instead of a new review');
  await render(locale,VisitForm,{open:true,onClose(){},workshop:null,directory:[{id:'fixture-workshop'}],signedIn:false,existing:null});
  check(!document.querySelector('[role="dialog"]'),'The retained edit dialog cannot open an unassigned new review');
  await render(locale,MyVisits,{directory:[{id:'fixture-workshop'}],signedIn:true,account:{provider:'E-Mail',email:'fixture@example.test'}});
  check(document.querySelector('main h1').textContent===copy.myReviews&&!document.querySelector('[role="dialog"]'),'The actual own review page has an active-locale heading without a modal frame');
  check(document.querySelector('.visit-status').textContent==={de:'Ergänzung nötig',sq:'Nevojitet plotësim',en:'More information needed'}[locale],'Canonical needs_more uses the exact localized status label');
  check(document.querySelector('.evidence-details a').getAttribute('href').endsWith('?locale='+locale),'Customer evidence links use the shared explicit locale download helper');
  check(document.querySelector('.visit').textContent.includes('Original unchanged customer review text.')&&document.querySelector('.visit').textContent.includes('Original private note'),'Free text is never translated');
  await click(button(copy.delete));check(document.querySelector('[role="alertdialog"]').textContent.includes(copy.deleteReviewNote),'Delete dialog describes the review/evidence scope in the active locale');
  for(const provider of ['Google','E-Mail']){
   await render(locale,SiteHeader,{account:{email:'fixture@example.test',displayName:'Fixture Customer',provider}});
   const trigger=document.querySelector('[aria-label="'+getMessages(locale).common.userMenu+'"]');
   await act(async()=>trigger.dispatchEvent(new MouseEvent('pointerdown',{bubbles:true,cancelable:true,button:0})));
   const ownReviews=[...document.querySelectorAll('a[role="menuitem"]')].find(node=>node.textContent===getMessages(locale).common.myReviews);check(ownReviews?.getAttribute('href')===prefix+'/bewertungen','Every account menu navigates to the independently addressable localized review page');
   const logout=[...document.querySelectorAll('[role="menuitem"]')].find(node=>node.textContent===getMessages(locale).common.logout);check(logout,'The actual localized account menu exposes the canonical session logout');
   mode='network';await click(logout);
   check(document.querySelector('.header-error[role="alert"]').textContent===getMessages(locale).common.logoutFailed&&!document.body.textContent.includes('Raw provider/internal failure'),'Header network failures show only the active-locale logout message');
   check(requests.at(-1).url==='/api/auth/logout'&&JSON.stringify(JSON.parse(requests.at(-1).init.body))===JSON.stringify({locale}),'Logout keeps its stable physical API and explicit locale payload');
  }
 }
 console.log(JSON.stringify({customerUiChecksPassed:passed,realAccounts:false,realUploads:false,realEmails:false}));
}finally{globalThis.fetch=originalFetch;await act(async()=>root.unmount());dom.window.close();}
