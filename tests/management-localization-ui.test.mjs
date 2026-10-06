import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdir,writeFile} from 'node:fs/promises';
import {JSDOM,VirtualConsole} from 'jsdom';
const dom=new JSDOM('<div id="root"></div>',{url:'https://riparim.example.test/en/verwaltung',pretendToBeVisual:true,virtualConsole:new VirtualConsole()});
for(const key of ['window','document','navigator','HTMLElement','HTMLButtonElement','HTMLFormElement','HTMLInputElement','HTMLTextAreaElement','HTMLSelectElement','DocumentFragment','Element','Node','NodeFilter','MutationObserver','CustomEvent','Event','MouseEvent','KeyboardEvent','getComputedStyle'])Object.defineProperty(globalThis,key,{value:dom.window[key],configurable:true});
globalThis.requestAnimationFrame=dom.window.requestAnimationFrame.bind(dom.window);globalThis.cancelAnimationFrame=dom.window.cancelAnimationFrame.bind(dom.window);globalThis.IS_REACT_ACT_ENVIRONMENT=true;globalThis.ResizeObserver=class{observe(){}unobserve(){}disconnect(){}};
const out='.test-runtime/management-localization-ui.mjs';
const result=await build({stdin:{contents:"export {AdminNavigation} from './components/admin-navigation';export {BusinessPanel} from './components/business-panel';export {default as AdminPanel} from './app/[locale]/verwaltung/panel';export {default as AdminUsers} from './app/[locale]/verwaltung/benutzer/users';export {default as AdminReviews} from './app/[locale]/verwaltung/bewertungen/reviews';export {NotificationStatus} from './components/notification-status';export {default as AuthSetup} from './app/[locale]/verwaltung/anmeldung/setup';export * as mailSources from './lib/auth/email-templates';export {I18nProvider} from './lib/i18n/client';export {getMessages} from './lib/i18n/messages';",resolveDir:process.cwd(),loader:'tsx'},outfile:out,bundle:true,write:false,format:'esm',platform:'node',packages:'external',plugins:[{name:'router-boundary',setup(b){b.onResolve({filter:/^next\/link$/},args=>({path:args.path,namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},()=>({loader:'js',resolveDir:process.cwd(),contents:"import React from 'react';export default function Link({href,children,...props}){return React.createElement('a',{...props,href},children);}"}));}}]});await mkdir('.test-runtime',{recursive:true});await writeFile(out,result.outputFiles[0].contents);
const {createElement,act}=await import('react'),{createRoot}=await import('react-dom/client');
const {AdminNavigation,BusinessPanel,AdminPanel,AdminUsers,AdminReviews,NotificationStatus,AuthSetup,mailSources,I18nProvider,getMessages}=await import(new URL('../'+out,import.meta.url));
let root=createRoot(document.getElementById('root')),passed=0;
const check=(condition,label)=>{assert(condition,label);passed++;};
async function render(locale,Component,props={}){await act(async()=>root.unmount());root=createRoot(document.getElementById('root'));await act(async()=>root.render(createElement(I18nProvider,{locale,messages:getMessages(locale,['common','customer','management'])},createElement(Component,props))));}
try{
 for(const [locale,name,labels] of [['de','Verwaltung',['Werkstätten','Bewertungen prüfen','Benutzer','Betriebe','Login & Registrierung']],['sq','Administrimi',['Serviset','Kontrollo vlerësimet','Përdoruesit','Bizneset','Hyrja & regjistrimi']],['en','Administration',['Workshops','Review moderation','Users','Businesses','Login & registration']]]){
  await render(locale,AdminNavigation,{active:'users'});
  const nav=document.querySelector('nav'),links=[...nav.querySelectorAll('a')],prefix=locale==='de'?'':'/'+locale;
  check(nav.getAttribute('aria-label')===name,'Administration navigation has the active locale accessible name');
  assert.deepEqual(links.map(link=>link.textContent),labels);passed++;
  assert.deepEqual(links.map(link=>link.getAttribute('href')),['/verwaltung','/verwaltung/bewertungen','/verwaltung/benutzer','/verwaltung/betriebe','/verwaltung/anmeldung'].map(path=>prefix+path));passed++;
  check(links[2].getAttribute('aria-current')==='page'&&links.filter(link=>link.hasAttribute('aria-current')).length===1,'The canonical active section is independent from display language');
 }
 const originalFetch=globalThis.fetch,requests=[],workshop={id:'fixture-workshop',name:'Original workshop',city:'Prishtina',address:'Original address',phone:'+38344123456',phoneNote:'Original note',whatsapp:'',services:['Inspektion & Wartung'],serviceDetails:['Original specific work'],description:'Original unchanged description of the workshop.',updatedAt:'2026-10-04T09:00:00Z'};
 globalThis.fetch=async(url,init)=>{requests.push({url,init});return init?.method?Response.json({error:'Private raw provider detail',errorCode:'business_unavailable'},{status:503}):Response.json({workshops:[workshop],claims:[],changes:[],pendingClaims:[],pendingChangeWorkshopIds:[],pendingChangeRequestIds:[],nextClaimCursor:null,nextChangeCursor:null});};
 try{
  for(const [locale,title,edit,description] of [['de','Deine Profile','Profil bearbeiten','Beschreibung'],['sq','Profilet e tua','Ndrysho profilin','Përshkrimi'],['en','Your profiles','Edit profile','Description']]){
   await render(locale,BusinessPanel,{directory:[workshop]});
   check(document.querySelector('h2').textContent===title,'The actual owner screen shows active-locale headings');
   const editButton=[...document.querySelectorAll('button')].find(button=>button.textContent===edit);await act(async()=>editButton.click());
   const field=[...document.querySelectorAll('label')].find(label=>label.textContent.startsWith(description)).querySelector('textarea');
   check(field.value===workshop.description,'The owner edits original canonical text rather than public translations');
   await act(async()=>field.form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
   const payload=JSON.parse(requests.at(-1).init.body);check(payload.kind==='change'&&payload.profile.services[0]==='Inspektion & Wartung'&&payload.profile.description===workshop.description,'Localized service labels retain canonical server payloads');
   check(!document.body.textContent.includes('Private raw provider detail'),'Provider error text never reaches the localized owner screen');
  }

  let businessFixture;
  globalThis.fetch=async()=>Response.json(businessFixture);
  for(const [locale,edit,claimOutcome,changeOutcome,waiting,privateCheck] of [['de','Profil bearbeiten','Dieser Antrag wurde abgelehnt. Beachte den Prüfvermerk.','Diese Änderungen wurden abgelehnt. Beachte den Prüfvermerk.','Warte auf die Freigabe','privaten Nachweis manuell'],['sq','Ndrysho profilin','Kjo kërkesë është refuzuar. Lexo shënimin e shqyrtimit.','Këto ndryshime janë refuzuar. Lexo shënimin e shqyrtimit.','Prit miratimin','manualisht dëshminë tënde private'],['en','Edit profile','This request was rejected. Read the review note.','These changes were rejected. Read the review note.','Wait for approval','private evidence manually']]){
   const historical={id:'fixture-old-request',workshopId:workshop.id,workshopName:workshop.name,owner:'fixture-owner',status:'rejected',moderatorNote:'A newer decision applies.',revision:1,createdAt:'2020-01-01T00:00:00Z'};
   businessFixture={workshops:[workshop],claims:[historical],changes:[{...historical,id:'fixture-old-change'}],pendingClaims:[],pendingChangeWorkshopIds:[workshop.id],pendingChangeRequestIds:[],nextClaimCursor:null,nextChangeCursor:null};
   await render(locale,BusinessPanel,{directory:[workshop]});
   const editButton=[...document.querySelectorAll('button')].find(button=>button.textContent===edit);
   check(editButton.disabled&&document.body.textContent.includes(waiting),'Each locale bases its current edit lock and guidance on the authoritative pending change summary');
   check(document.body.textContent.includes(claimOutcome)&&document.body.textContent.includes(changeOutcome),'Each locale reports historical rejection outcomes without a conflicting retry instruction');
   businessFixture={...businessFixture,workshops:[],claims:[],changes:[],pendingChangeWorkshopIds:[],pendingClaims:[{id:'fixture-current-claim',workshopId:workshop.id,workshopName:workshop.name,createdAt:'2020-01-01T00:00:00Z'}]};
   await render(locale,BusinessPanel,{directory:[workshop]});check(document.querySelector('.business-request').textContent.includes(privateCheck),'Each locale visibly explains manual private ownership verification for the current claim');
  }

  const canonical={...workshop,brands:['Audi'],languages:['Albanisch'],specialty:'Original specialty',sources:[{url:'https://workshop.example.test/contact',title:'Original source'}],lat:null,lng:null,checkedAt:'2026-10-04',status:'draft'};
  globalThis.fetch=async(url,init)=>{requests.push({url,init});return init?.method?Response.json({error:'Private raw provider error',errorCode:'workshop_invalid_profile'},{status:400}):Response.json(url.startsWith('/api/workshops')?{workshops:[canonical]}:{pendingCount:0});};
  for(const [locale,title,edit,description] of [['de','Werkstätten verwalten','Bearbeiten','Beschreibung'],['sq','Administro serviset','Ndrysho','Përshkrimi'],['en','Manage workshops','Edit','Description']]){
   await render(locale,AdminPanel,{account:{email:'admin@example.test',displayName:'Fixture Admin',provider:'E-Mail'}});
   check(document.querySelector('h1').textContent===title,'The actual workshop administration has an active-locale heading');
   await act(async()=>[...document.querySelectorAll('button')].find(button=>button.textContent===edit).click());
   const field=[...document.querySelectorAll('label')].find(label=>label.textContent.startsWith(description)).querySelector('textarea');check(field.value===canonical.description,'Administration edits the source-owned original description');
   await act(async()=>field.form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
   const payload=JSON.parse(requests.at(-1).init.body);check(payload.services[0]==='Inspektion & Wartung'&&payload.description===canonical.description&&payload.status==='draft'&&payload.languages[0]==='Albanisch','Workshop edits send identical canonical services, status, consultation languages and original content');
   check(!document.body.textContent.includes('Private raw provider error')&&field.value===canonical.description,'A local validation failure retains the original edit without showing raw provider details');
   let finish;const previousFetch=globalThis.fetch;globalThis.fetch=async(url,init)=>init?.method?new Promise(resolve=>finish=resolve):previousFetch(url,init);
   await act(async()=>field.form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
   check(document.querySelector('.language-switcher select').disabled,'A pending workshop mutation blocks document language switching');
   check([...field.form.querySelectorAll('input,textarea')].every(control=>control.disabled),'A pending workshop mutation also freezes the edited payload fields');
   await act(async()=>finish(Response.json({errorCode:'workshop_invalid_profile'},{status:400})));globalThis.fetch=previousFetch;

  }

  const member={id:'11111111-1111-4111-8111-111111111111',email:'member@example.test',name:'Original Member',role:'user',active:true,confirmed:true,createdAt:'2026-10-04T09:00:00Z',lastSignInAt:null,providers:['email'],protected:false};
  globalThis.fetch=async(url,init)=>{requests.push({url,init});return init?.method?Response.json({error:'Private raw role error',errorCode:'role_change_forbidden'},{status:403}):Response.json({users:[member],page:1,perPage:20,hasMore:false,configured:true});};
  for(const [locale,title,make] of [['de','Benutzer verwalten','Zum Admin machen'],['sq','Administro përdoruesit','Bëj administrator'],['en','Manage users','Make admin']]){
   await render(locale,AdminUsers,{account:{email:'admin@example.test',displayName:'Fixture Admin',provider:'E-Mail'}});check(document.querySelector('h1').textContent===title,'The actual user administration uses active-locale copy');
   await act(async()=>[...document.querySelectorAll('button')].find(button=>button.textContent===make).click());
   const dialog=document.querySelector('[role="alertdialog"]');check(dialog.contains(document.activeElement),'The translated role confirmation keeps keyboard focus inside its dialog');
   await act(async()=>[...dialog.querySelectorAll('button')].find(button=>button.textContent===make).click());
   assert.deepEqual(JSON.parse(requests.findLast(request=>request.init?.method==='PATCH').init.body),{role:'admin'});passed++;
   check(!document.body.textContent.includes('Private raw role error'),'Failed role changes show local code messages without raw provider details');
  }

  const visit={id:member.id,workshop:'fixture-workshop',workshop_name:'Original workshop',date:'2026-10-04',vehicle:'Original vehicle',service:'Inspektion & Wartung',evidence_type:'Rechnung',evidence_note:'Original private evidence',status:'pending',moderator_note:'Original private moderator note',display_name:'Original Member',rating:4,review:'Original customer review text with sufficient detail.',file_name:'original.png',revision:7};
  globalThis.fetch=async(url,init)=>{requests.push({url,init});return init?.method?Response.json({error:'Private raw moderation error',errorCode:'review_conflict'},{status:409}):Response.json(url.startsWith('/api/notifications')?{notifications:[{id:'fixture-mail',visitId:visit.id,workshopName:'Original workshop',decision:'published',state:'sent',attempts:2,nextAttemptAt:0,createdAt:'2026-10-04T09:00:00Z',error:null,retryable:false}],configured:true,nextCursor:null}:{visits:[visit],nextCursor:null,pendingCount:1});};
  for(const [locale,title,publish] of [['de','Bewertungen prüfen','Prüfen & veröffentlichen','An Versanddienst übergeben'],['sq','Kontrollo vlerësimet','Kontrollo & publiko','I është dorëzuar shërbimit të dërgimit'],['en','Review moderation','Review & publish','Handed to the email service']]){
   await render(locale,AdminReviews,{account:{email:'admin@example.test',displayName:'Fixture Admin',provider:'E-Mail'}});check(document.querySelector('h1').textContent===title,'The actual moderation queue has active-locale headings');
   check(document.querySelector('.moderation-list').textContent.includes(visit.review)&&document.querySelector('.moderation-list').textContent.includes(visit.evidence_note),'Customer and evidence free text remain unchanged during moderation');
   check(!document.querySelector('.notification-panel'),'The simplified review page preserves Main57 removal of the delivery panel');
   const field=document.querySelector('.moderation-decision textarea');await act(async()=>{Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(field,'Original private moderation reason.');field.dispatchEvent(new Event('input',{bubbles:true}));});
   await act(async()=>[...document.querySelectorAll('button')].find(button=>button.textContent===publish).click());
   const body=JSON.parse(requests.findLast(request=>request.init?.method==='PATCH').init.body);assert.deepEqual(body,{action:'moderate',id:visit.id,status:'published',revision:7,note:'Original private moderation reason.'});passed++;
   check(!document.body.textContent.includes('Private raw moderation error')&&field.value==='Original private moderation reason.','A moderation conflict uses local codes and keeps the private note');
   let finish;const previousFetch=globalThis.fetch;globalThis.fetch=async(url,init)=>init?.method?new Promise(resolve=>finish=resolve):previousFetch(url,init);
   await act(async()=>[...document.querySelectorAll('button')].find(button=>button.textContent===publish).click());
   check(document.querySelector('.language-switcher select').disabled&&field.disabled,'A pending moderation decision blocks language changes and freezes private notes');
   await act(async()=>finish(Response.json({errorCode:'review_conflict'},{status:409})));globalThis.fetch=previousFetch;

  }


  for(const [locale,sent] of [['de','An Versanddienst übergeben'],['sq','I është dorëzuar shërbimit të dërgimit'],['en','Handed to the email service']]){
   await render(locale,NotificationStatus);check(document.querySelector('.notification-entry').textContent.includes(sent),'Retained delivery diagnostics still distinguish service acceptance from delivery in every locale');
  }
  const config={projectUrl:'https://fixture-project.supabase.co',publicKey:'sb_publishable_fixture_public_key_1234567890',enabled:false,emailDeliveryConfirmed:false};
  globalThis.fetch=async(url,init)=>{requests.push({url,init});return init?.method?Response.json({error:'Private raw configuration error',errorCode:'auth_provider_connection'},{status:400}):Response.json({config});};
  for(const [locale,title] of [['de','Anmeldung verbinden.'],['sq','Lidh hyrjen.'],['en','Connect authentication.']]){
   await render(locale,AuthSetup,{account:{email:'admin@example.test',displayName:'Fixture Admin',provider:'E-Mail'}});check(document.querySelector('h1').textContent===title,'Auth setup has active-locale labels and instructions');
   const labels={de:['Bestätigungsbetreff','Bestätigungs-HTML','Wiederherstellungsbetreff','Wiederherstellungs-HTML'],sq:['Subjekti i konfirmimit','HTML i konfirmimit','Subjekti i rikthimit','HTML i rikthimit'],en:['Confirmation subject','Confirmation HTML','Recovery subject','Recovery HTML']}[locale];
   const exports=[['confirmation-subject',mailSources.confirmationEmailSubject],['confirmation-body',mailSources.confirmationEmailTemplate],['recovery-subject',mailSources.recoveryEmailSubject],['recovery-body',mailSources.recoveryEmailTemplate]],copied=[];
   Object.defineProperty(navigator,'clipboard',{configurable:true,value:{async writeText(value){copied.push(value);}}});
   for(const [index,[id,source]] of exports.entries()){
    const section=document.querySelector('[data-auth-mail-field="'+id+'"]');check(section&&!section.open&&section.querySelector('summary').textContent===labels[index],'Every provider subject/body field has its own closed active-locale disclosure');
    const outer=section.parentElement.closest('details');if(!outer.open)await act(async()=>outer.querySelector('summary').click());
    await act(async()=>section.querySelector('summary').click());check(section.open,'Each central mail field is reachable through its native disclosure');
    check(section.querySelector('pre').textContent===source,'Auth setup shows the exact central Go source without translating or rendering it');
    await act(async()=>section.querySelector('button').click());check(copied.at(-1)===source,'Copying a provider field retains the exact central subject or body source');
   }
   const instructions=document.querySelector('.setup-instructions').textContent;
   for(const value of ['SITE_ORIGIN','Site URL','--provider-site-url','--site-origin','auth/bestaetigen\\?**','confirmation.subject.txt','confirmation.body.html','recovery.subject.txt','recovery.body.html'])check(instructions.includes(value),'The operator sees the complete origin, allowlist, release export and paired field activation contract');
   check(!instructions.includes('auth/bestaetigen**')&&!instructions.includes('auth/bestaetigen?**'),'Broad and unescaped callback patterns are replaced by the literal-query physical callback glob');
   Object.defineProperty(navigator,'clipboard',{configurable:true,value:{async writeText(){throw new Error('Raw private clipboard failure');}}});
   await act(async()=>document.querySelector('[data-auth-mail-field="confirmation-subject"] button').click());
   check(document.querySelector('.setup-instructions [role="alert"]').textContent===getMessages(locale).management.mailCopyFailed&&!document.body.textContent.includes('Raw private clipboard failure'),'Clipboard rejection shows only the active-locale manual-copy guidance');

   const form=document.querySelector('form');check(form.querySelector('input[type="url"]').value===config.projectUrl&&form.querySelector('textarea').value===config.publicKey,'Technical URLs and provider keys retain their exact configured values');
   await act(async()=>form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
   assert.deepEqual(JSON.parse(requests.at(-1).init.body),config);passed++;
   check(!document.body.textContent.includes('Private raw configuration error')&&form.querySelector('textarea').value===config.publicKey,'Configuration errors use local stable codes and keep the original configuration');
   let finish;const previousFetch=globalThis.fetch;globalThis.fetch=async(url,init)=>init?.method?new Promise(resolve=>finish=resolve):previousFetch(url,init);
   await act(async()=>form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
   check(document.querySelector('.language-switcher select').disabled&&[...form.querySelectorAll('input,textarea,[role="checkbox"],[role="switch"]')].every(control=>control.disabled),'A pending configuration mutation freezes technical values and explicit activation attestations');
   await act(async()=>finish(Response.json({errorCode:'auth_provider_connection'},{status:400})));globalThis.fetch=previousFetch;

  }
 }finally{globalThis.fetch=originalFetch;}
 console.log(JSON.stringify({managementUiChecksPassed:passed,realAccounts:false,realEmails:false}));
}finally{await act(async()=>root.unmount());dom.window.close();}
