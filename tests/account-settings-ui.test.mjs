import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {JSDOM,VirtualConsole} from 'jsdom';
const dom=new JSDOM('<div id="root"></div>',{url:'https://riparim.example.test/einstellungen',pretendToBeVisual:true,virtualConsole:new VirtualConsole()});
for(const key of ['window','document','navigator','HTMLElement','HTMLButtonElement','HTMLFormElement','HTMLInputElement','DocumentFragment','Element','Node','NodeFilter','MutationObserver','CustomEvent','Event','MouseEvent','KeyboardEvent','getComputedStyle'])Object.defineProperty(globalThis,key,{value:dom.window[key],configurable:true});
globalThis.requestAnimationFrame=dom.window.requestAnimationFrame.bind(dom.window);globalThis.cancelAnimationFrame=dom.window.cancelAnimationFrame.bind(dom.window);globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const {build}=createRequire(new URL('../package.json',import.meta.url))('esbuild');
const output='.test-runtime/account-settings-ui';
const bundle=await build({stdin:{contents:"export {AccountSettings} from './components/account-settings';export {I18nProvider} from './lib/i18n/client';export {getMessages} from './lib/i18n/messages';",resolveDir:process.cwd(),loader:'tsx'},outfile:output+'/ui.mjs',bundle:true,write:false,platform:'node',format:'esm',packages:'external',plugins:[{name:'ui-boundaries',setup(b){b.onResolve({filter:/^next\/(link|navigation)$/},args=>({path:args.path,namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},args=>({loader:'js',resolveDir:process.cwd(),contents:args.path==='next/link'?`import React from 'react';export default function Link({children,href,...props}){return React.createElement('a',{...props,href},children);}`:'export function useRouter(){return {refresh(){globalThis.fixtureRefreshes++;}};}'}));}}]});
await mkdir(output,{recursive:true});await writeFile(output+'/ui.mjs',bundle.outputFiles[0].contents);
const {createElement,act}=await import('react'),{createRoot}=await import('react-dom/client');
const {AccountSettings,I18nProvider,getMessages}=await import(new URL('../'+output+'/ui.mjs',import.meta.url));
let state={account:{email:'member@example.test',name:'Fixture Member',provider:'E-Mail',protected:false},deletionReady:false,deletionStarted:false};
let mode='success',pending=null,loadFailure=false;
const requests=[];globalThis.fixtureRefreshes=0;
globalThis.fetch=async(url,options)=>{
 const method=options?.method??'GET',body=options?.body?JSON.parse(options.body):null;requests.push({url,method,body});assert.equal(url,'/api/account','Fixtures never send external account requests');
 if(method==='GET')return loadFailure?Response.json({error:'Fixture load failed',errorCode:'account_unavailable'},{status:503}):Response.json(state);
 if(method==='PATCH'){assert.deepEqual(Object.keys(body),['name']);if(mode==='failure')return Response.json({error:'Fixture invalid name'},{status:400});state={...state,account:{...state.account,name:body.name.trim()}};return Response.json({name:state.account.name});}
 if(method==='POST'){assert.deepEqual(Object.keys(body),['password']);if(mode==='failure')return Response.json({error:'Fixture wrong password',errorCode:'password_proof_failed'},{status:401});state={...state,deletionReady:true};return Response.json({ok:true});}
 assert.equal(method,'DELETE');assert.deepEqual(body,{confirmation:'KONTO LÖSCHEN'});
 const commit=()=>{state={account:null,deletionReady:false,deletionStarted:false};return Response.json({ok:true});};
 if(mode==='pending')return new Promise(resolve=>{pending={resolve,commit};});
 if(mode==='partial'){state={account:null,deletionReady:false,deletionStarted:true};return Response.json({error:'Fixture interrupted deletion',errorCode:'deletion_incomplete'},{status:503});}
 return commit();
};
let activeLocale='de';
let root=createRoot(document.getElementById('root')),passed=0;
const check=(condition,label)=>{assert(condition,label);passed++;};
const button=label=>[...document.querySelectorAll('button')].find(node=>node.textContent===label);
const click=async control=>{assert(control,'The requested control is visible');await act(async()=>{control.focus();control.click();});};
const dialog=()=>document.querySelector('[role="alertdialog"]');
const input=label=>document.getElementById([...document.querySelectorAll('label')].find(node=>node.textContent===label)?.htmlFor);
const type=async(control,value)=>{await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(control,value);control.dispatchEvent(new Event('input',{bubbles:true}));});};
const mount=async()=>act(async()=>root.render(createElement(I18nProvider,{locale:activeLocale,messages:getMessages(activeLocale,["common","customer"])},createElement(AccountSettings))));
const remount=async()=>{await act(async()=>root.unmount());root=createRoot(document.getElementById('root'));await mount();};
try{
 loadFailure=true;await mount();check(document.querySelector('[role="alert"]').textContent===getMessages('de').customer.accountUnavailable&&button('Erneut laden'),'Failed account loading exposes an accessible retry');
 loadFailure=false;await click(button('Erneut laden'));
 check(document.querySelector('.account-identity').textContent.includes(state.account.email),'The account view identifies the signed-in email and provider');
 const name=input('Anzeigename');check(name.value==='Fixture Member'&&name.required&&name.minLength===2&&name.maxLength===80,'The display name has an accessible label and length constraints');
 await type(name,'  Updated Member  ');await act(async()=>document.querySelector('form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
 check(input('Anzeigename').value==='Updated Member'&&document.querySelector('[role="status"]').textContent.includes('unverändert'),'Saving announces success and explains existing review names');
 check(globalThis.fixtureRefreshes===1&&requests.find(r=>r.method==='PATCH').body.name==='  Updated Member  ','Saving refreshes the account header and sends no account identifier');
 await click(button('Konto löschen'));check(dialog()&&dialog().contains(document.activeElement),'Deletion uses a real alert dialog with keyboard focus inside');
 check(dialog().textContent.includes('privaten Nachweisdateien')&&dialog().textContent.includes('Identität'),'The dialog describes affected data and requires a fresh identity proof');
 check(!button('Endgültig löschen')&&button('Passwort bestätigen').disabled,'The destructive action is unavailable before reauthentication');
 await act(async()=>document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true})));
 check(!dialog()&&requests.filter(r=>r.method==='DELETE').length===0,'Escape closes the initial dialog without deletion');
 await click(button('Konto löschen'));await type(input('Aktuelles Passwort'),'fixture-password');mode='failure';await click(button('Passwort bestätigen'));
 check(dialog().querySelector('[role="alert"]').textContent===getMessages('de').customer.passwordProofFailed&&!button('Endgültig löschen'),'Failed password confirmation never exposes deletion');
 check(input('Aktuelles Passwort').value==='','A failed password is cleared');
 mode='success';await type(input('Aktuelles Passwort'),'fixture-password');await click(button('Passwort bestätigen'));
 check(!input('Aktuelles Passwort')&&button('Endgültig löschen').disabled,'A successful proof clears the password and requires a separate explicit confirmation');
 await type(input('Gib zur Bestätigung KONTO LÖSCHEN ein'),'yes');check(button('Endgültig löschen').disabled,'The dialog rejects a vague confirmation');
 await type(input('Gib zur Bestätigung KONTO LÖSCHEN ein'),'KONTO LÖSCHEN');mode='pending';await click(button('Endgültig löschen'));
 check([...dialog().querySelectorAll('button')].every(node=>node.disabled),'Pending deletion disables every dialog action');
 await act(async()=>document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true})));
 check(dialog()&&requests.filter(r=>r.method==='DELETE').length===1,'Pending deletion cannot be dismissed or sent twice');
 await act(async()=>pending.resolve(pending.commit()));mode='success';pending=null;
 check(!dialog()&&!document.querySelector('.account-name-form')&&document.querySelector('[role="status"]').textContent.includes('wurden gelöscht'),'Completed deletion clears the account and announces cleanup');
 check(globalThis.fixtureRefreshes===2,'Completed deletion refreshes the signed-out header');
 state={account:{email:'member@example.test',name:'Member',provider:'E-Mail',protected:false},deletionReady:true,deletionStarted:false};await remount();
 check(dialog()&&button('Endgültig löschen').disabled,'Returning from a verified identity proof opens the confirmation without deleting automatically');
 await type(input('Gib zur Bestätigung KONTO LÖSCHEN ein'),'KONTO LÖSCHEN');mode='partial';await click(button('Endgültig löschen'));
 check(dialog().querySelector('[role="alert"]').textContent===getMessages('de').customer.deletionIncomplete&&button('Löschung wiederholen'),'Partial failure reloads the server state and offers a scoped retry');
 check(!document.querySelector('.account-name-form')&&dialog().textContent.includes('sieben Tagen'),'An interrupted deletion cannot continue ordinary account editing');
 mode='success';await click(button('Löschung wiederholen'));
 check(!dialog()&&document.querySelector('[role="status"]').textContent.includes('wurden gelöscht'),'Confirmed retry completes the interrupted deletion');
 state={account:{email:'admin@example.test',name:'Admin',provider:'Google',protected:true},deletionReady:false,deletionStarted:false};await remount();
 check(!button('Konto löschen')&&document.querySelector('.account-settings').textContent.includes('Administrationszugänge'),'Protected accounts explain the guard and expose no deletion control');
 state={account:{email:'member@example.test',name:'Member',provider:'Google',protected:false},deletionReady:false,deletionStarted:false};await remount();await click(button('Konto löschen'));
 check(button('Mit Google erneut bestätigen')&&!input('Aktuelles Passwort'),'Google accounts use the dedicated OAuth proof action');await click(button('Abbrechen'));
 check(!dialog(),'Cancel dismisses Google proof without starting an action');
 state={account:null,deletionReady:false,deletionStarted:false};await remount();
 check(document.querySelector('a').getAttribute('href')==='/anmelden?weiter=/einstellungen'&&!button('Konto löschen'),'Signed-out or native-only views link back to login without destructive controls');
 for(const [locale,phrase] of [['de','KONTO LÖSCHEN'],['sq','FSHI LLOGARINË'],['en','DELETE ACCOUNT']]){
  activeLocale=locale;const copy=getMessages(locale).customer;
  state={account:{email:'member@example.test',name:'Fixture Member',provider:'E-Mail',protected:false},deletionReady:true,deletionStarted:false};await remount();
  const field=input(copy.enterDeletePhrase.replace('{phrase}',phrase));check(field&&dialog().textContent.includes(phrase),'The exact localized deletion phrase is visible and labelled');
  for(const wrong of [phrase+' ',phrase.toLowerCase(),'KONTO LÖSCHEN'===phrase?'DELETE ACCOUNT':'KONTO LÖSCHEN']){
   await type(field,wrong);check(button(copy.deletePermanently).disabled,'Whitespace, case and another locale phrase cannot enable deletion');
  }
  await type(field,phrase);check(!button(copy.deletePermanently).disabled,'Only the exact visible phrase enables the separate destructive action');
  await click(button(copy.deletePermanently));check(requests.at(-1).body.confirmation==='KONTO LÖSCHEN','Each localized phrase sends the existing canonical server sentinel');
 }
 console.log(JSON.stringify({accountSettingsUiChecksPassed:passed,liveRequests:false}));
}finally{await act(async()=>root.unmount());dom.window.close();}
