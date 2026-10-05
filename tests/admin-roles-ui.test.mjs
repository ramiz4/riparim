import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {JSDOM,VirtualConsole} from 'jsdom';

const dom=new JSDOM('<div id="root"></div>',{url:'https://riparim.example.test/verwaltung/benutzer',pretendToBeVisual:true,virtualConsole:new VirtualConsole()});
for(const key of ['window','document','navigator','HTMLElement','HTMLButtonElement','HTMLFormElement','HTMLInputElement','HTMLSelectElement','Option','DocumentFragment','Element','Node','NodeFilter','MutationObserver','CustomEvent','Event','MouseEvent','KeyboardEvent','getComputedStyle'])Object.defineProperty(globalThis,key,{value:dom.window[key],configurable:true});
globalThis.requestAnimationFrame=dom.window.requestAnimationFrame.bind(dom.window);
globalThis.cancelAnimationFrame=dom.window.cancelAnimationFrame.bind(dom.window);
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
globalThis.ResizeObserver=class{observe(){}unobserve(){}disconnect(){}};

const {build}=createRequire(new URL('../package.json',import.meta.url))('esbuild');
const output='.test-runtime/admin-roles-ui';
const bundle=await build({entryPoints:['app/[locale]/verwaltung/benutzer/users.tsx'],outfile:output+'/users.mjs',bundle:true,write:false,platform:'node',format:'esm',packages:'external',loader:{'.css':'empty'},plugins:[{name:'page-shell-boundaries',setup(b){
 b.onResolve({filter:/^(next\/link|@\/components\/site-header|@\/components\/admin-navigation)$/},args=>({path:args.path,namespace:'fixture'}));
 b.onLoad({filter:/.*/,namespace:'fixture'},args=>({loader:'js',resolveDir:process.cwd(),contents:args.path==='next/link'?`import React from 'react';export default function Link({children,href,...props}){return React.createElement('a',{...props,href},children);}`:args.path.includes('site-header')?'export function SiteHeader(){return null;}':'export function AdminNavigation(){return null;}'}));
}}]});
await mkdir(output,{recursive:true});await writeFile(output+'/users.mjs',bundle.outputFiles[0].contents);
const {createElement,act}=await import('react');
const {createRoot}=await import('react-dom/client');
const {default:AdminUsers}=await import(new URL('../'+output+'/users.mjs',import.meta.url));
const fixtureUser=(id,name,role,protectedAccount=false)=>({id,name,email:name.toLowerCase().replaceAll(' ','-')+'@example.test',role,protected:protectedAccount,active:true,confirmed:true,providers:['email'],createdAt:'2026-10-04',lastSignInAt:null});
const users=[fixtureUser('self','Current Admin','admin',true),fixtureUser('bootstrap','Emergency Admin','admin',true),fixtureUser('member','Fixture Member','user'),fixtureUser('other-admin','Other Admin','admin')];
const requests=[];
let mode='success',pending=null,pendingDeletions=[];
globalThis.fetch=async(url,options)=>{
 const request={url,method:options?.method??'GET',body:options?.body?JSON.parse(options.body):null};requests.push(request);
 if(request.method==='GET'){assert.equal(url,'/api/users?page=1&perPage=20');return Response.json({users,pendingDeletions,page:1,perPage:20,hasMore:false,configured:true});}
 if(request.method==='DELETE'){assert.equal(url,'/api/users/'+pendingDeletions[0].id);pendingDeletions=[];return Response.json({ok:true});}
 assert.equal(request.method,'PATCH','Role UI fixtures never create or delete users');
 assert.deepEqual(Object.keys(request.body),['role'],'Role changes are sent separately from profile and account-status changes');
 assert(['admin','user'].includes(request.body.role));
 const user=users.find(item=>'/api/users/'+item.id===url);assert(user,'Only fictional listed users may be edited');
 const commit=()=>{const roleChanged=user.role!==request.body.role;user.role=request.body.role;return Response.json({user,roleChanged});};
 if(mode==='pending')return new Promise(resolve=>{pending={resolve,commit};});
 if(mode==='uncertain'){user.role=request.body.role;return Response.json({error:'Fixture: Rollenänderung konnte nicht bestätigt werden.'},{status:503});}
 if(mode==='noop'){assert.equal(user.role,request.body.role,'Another request already assigned the desired role');return Response.json({user,roleChanged:false});}
 return commit();
};
const root=createRoot(document.getElementById('root'));
let passed=0;
const check=(condition,label)=>{assert(condition,label);passed++;};
const button=label=>document.querySelector(`button[aria-label="${label}"]`);
const dialog=()=>document.querySelector('[role="alertdialog"]');
const dialogButton=label=>[...dialog().querySelectorAll('button')].find(item=>item.textContent===label);
const mutations=()=>requests.filter(request=>request.method==='PATCH');
const row=id=>[...document.querySelectorAll('tbody tr')].find(item=>item.textContent.includes(users.find(user=>user.id===id).email));
const click=async control=>{assert(control,'Requested control exists');await act(async()=>{control.focus();control.click();});};

try{
 await act(async()=>root.render(createElement(AdminUsers,{account:{email:'current-admin@example.test',displayName:'Current Admin',provider:'E-Mail'}})));
 check(document.querySelector('table').textContent.includes('Rolle'),'The account table exposes the role column');
 check(row('member').querySelector('.users-role').textContent==='Benutzer'&&row('other-admin').querySelector('.users-role').textContent==='Admin','User and admin roles have visible labels');
 for(const name of ['Current Admin','Emergency Admin']){
  const protectedControl=button(`Adminrechte für ${name} entziehen`);
  check(protectedControl.disabled,'Own and emergency admin roles cannot be changed');
  await click(protectedControl);
  check(!dialog()&&mutations().length===0,'Protected role controls never open a confirmation or send a request');
 }
 const promote=()=>button('Fixture Member zum Admin machen');
 await click(promote());
 check(dialog().textContent.includes('Benutzer zum Admin machen?')&&dialog().textContent.includes('Fixture Member'),'Promotion confirmation identifies the selected user');
 check(dialog().textContent.includes('private Nachweise')&&dialog().textContent.includes('Login-Konfiguration')&&dialog().textContent.includes('erneute Anmeldung'),'Promotion confirmation explains permissions and session revocation');
 check(dialog().contains(document.activeElement),'Keyboard focus moves into the real confirmation dialog');
 await act(async()=>document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true})));
 check(!dialog()&&mutations().length===0,'Escape dismisses a confirmation without changing a role');
 await click(promote());await click(dialogButton('Abbrechen'));
 check(!dialog()&&mutations().length===0,'Cancel dismisses a confirmation without changing a role');

 mode='pending';await click(promote());await click(dialogButton('Zum Admin machen'));
 check(mutations().length===1&&mutations()[0].body.role==='admin','Confirmed promotion sends exactly one admin-role request');
 check([...dialog().querySelectorAll('button')].every(control=>control.disabled),'Pending role changes disable confirmation and cancellation');
 check([...document.querySelectorAll('.users-actions button')].every(control=>control.disabled),'Pending role changes disable conflicting account actions');
 await act(async()=>document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true})));
 check(!!dialog()&&mutations().length===1,'Escape cannot dismiss a pending change or issue another mutation');
 await act(async()=>pending.resolve(pending.commit()));pending=null;mode='success';
 check(!dialog()&&row('member').querySelector('.users-role').textContent==='Admin','Successful promotion updates the visible role and closes the confirmation');
 check(document.querySelector('[role="status"]').textContent.includes('Adminrechte erteilt')&&document.querySelector('[role="status"]').textContent.includes('erneut anmelden'),'Successful promotion announces that existing sessions were ended');

 const demote=()=>button('Adminrechte für Fixture Member entziehen');
 await click(demote());
 check(dialog().textContent.includes('Adminrechte entziehen?')&&dialog().textContent.includes('reguläre Kundenrechte'),'Demotion confirmation describes the remaining customer access');
 mode='uncertain';await click(dialogButton('Adminrechte entziehen'));
 check(!dialog()&&document.querySelector('[role="alert"]').textContent.includes('nicht bestätigt'),'An uncertain server result closes the old confirmation and reports the failure');
 check(requests.filter(request=>request.method==='GET').length===2&&row('member').querySelector('.users-role').textContent==='Benutzer','An uncertain result reloads roles and reflects a completed server change');
 check(!document.querySelector('[role="status"]'),'An uncertain result never announces a successful role change');

 mode='success';await click(promote());await click(dialogButton('Zum Admin machen'));
 await click(demote());await click(dialogButton('Adminrechte entziehen'));
 check(row('member').querySelector('.users-role').textContent==='Benutzer'&&mutations().at(-1).body.role==='user','Confirmed demotion restores the visible ordinary role');
 check(document.querySelector('[role="status"]').textContent.includes('Adminrechte entzogen'),'Successful demotion announces the loss of admin rights');

 await click(promote());users.find(user=>user.id==='member').role='admin';mode='noop';
 await click(dialogButton('Zum Admin machen'));
 check(!dialog()&&row('member').querySelector('.users-role').textContent==='Admin','A stale promotion confirmation reflects the role already assigned by another request');
 check(document.querySelector('[role="status"]').textContent==='Diese Rolle war bereits zugewiesen.','An unchanged role is announced as already assigned');
 check(!/Sitzungen|anmelden/.test(document.querySelector('[role="status"]').textContent),'An unchanged promotion does not claim session revocation or require another login');
 await click(demote());users.find(user=>user.id==='member').role='user';
 await click(dialogButton('Adminrechte entziehen'));
 check(!dialog()&&row('member').querySelector('.users-role').textContent==='Benutzer','A stale demotion confirmation reflects an already removed role');
 check(!/Sitzungen|anmelden/.test(document.querySelector('[role="status"]').textContent),'An unchanged demotion does not claim session revocation or require another login');
 pendingDeletions=[fixtureUser('00000000-0000-4000-8000-000000000099','Begonnene Löschung','user')];
 await click([...document.querySelectorAll('button')].find(button=>button.textContent==='Aktualisieren'));
 const finish=button('Löschung für 00000000-0000-4000-8000-000000000099 abschließen');
 check(finish&&document.querySelector('#pending-deletions-title').textContent==='Unvollständige Kontolöschungen','Incomplete local deletions are recoverable in the administrative UI');
 await click(finish);check(dialog().textContent.includes('Begonnene Löschung'),'Administrative recovery still requires an explicit deletion confirmation');
 await click(dialogButton('Benutzer löschen'));
 check(!dialog()&&!document.querySelector('#pending-deletions-title')&&requests.at(-2).method==='DELETE','Confirmed recovery uses the existing delete action and refreshes the pending inventory');
 console.log(JSON.stringify({adminRoleUiChecksPassed:passed,liveRequests:false}));
}finally{
 await act(async()=>root.unmount());dom.window.close();
}
