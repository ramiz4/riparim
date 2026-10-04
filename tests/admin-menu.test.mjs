import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {JSDOM,VirtualConsole} from 'jsdom';

const dom=new JSDOM('<div id="root"></div>',{url:'https://riparim.test/',pretendToBeVisual:true,virtualConsole:new VirtualConsole()});
for(const key of ['window','document','navigator','HTMLElement','HTMLFormElement','HTMLInputElement','HTMLSelectElement','Option','DocumentFragment','Element','Node','NodeFilter','MutationObserver','CustomEvent','Event','MouseEvent','KeyboardEvent','getComputedStyle'])Object.defineProperty(globalThis,key,{value:dom.window[key],configurable:true});
globalThis.requestAnimationFrame=dom.window.requestAnimationFrame.bind(dom.window);
globalThis.cancelAnimationFrame=dom.window.cancelAnimationFrame.bind(dom.window);
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
// jsdom has no layout; these tests exercise navigation, not element sizing.
globalThis.ResizeObserver=class{observe(){}unobserve(){}disconnect(){}};
globalThis.fetch=async(path,options)=>{
 assert(!options?.method||options.method==='GET','navigation fixtures never mutate data');
 const fixtures={'/api/workshops?admin=1':{workshops:[]},'/api/visits?moderation=1':{visits:[],pendingCount:0,nextCursor:null},'/api/auth-settings':{config:null},'/api/users?page=1&perPage=20':{users:[],page:1,perPage:20,hasMore:false,configured:true}};
 assert(Object.hasOwn(fixtures,path),`unexpected fixture request: ${path}`);
 return new Response(JSON.stringify(fixtures[path]),{headers:{'Content-Type':'application/json'}});
};

const {build}=createRequire(new URL('../package.json',import.meta.url))('esbuild');
const bundle=await build({stdin:{contents:`export {SiteHeader} from './components/site-header';export {default as AdminPanel} from './app/verwaltung/panel';export {default as AdminReviews} from './app/verwaltung/bewertungen/reviews';export {default as AdminUsers} from './app/verwaltung/benutzer/users';export {default as AuthSetup} from './app/verwaltung/anmeldung/setup';`,resolveDir:process.cwd(),loader:'tsx'},bundle:true,platform:'node',format:'esm',outfile:'.test-runtime/admin-menu/header.mjs',write:false,packages:'external',loader:{'.css':'empty'},define:{'process.env.__VINEXT_HAS_PAGES_ROUTER':'"false"','process.env.__VINEXT_HAS_CLIENT_REWRITES':'"false"'},plugins:[{name:'app-router-boundary',setup(b){
 b.onResolve({filter:/^next\/link$/},()=>({path:new URL('../node_modules/vinext/dist/shims/link.js',import.meta.url).pathname}));
 // Exercise the real Link and Radix menu with an App Router that never commits.
 b.onResolve({filter:/^\.\/navigation\.js$/},args=>args.importer.endsWith('/shims/link.js')?{path:'stalled-router',namespace:'fixture'}:undefined);
 b.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:'export function navigateClientSide(href){globalThis.routerAttempts.push(href);return new Promise(()=>{});}',loader:'js'}));
}}]});
await mkdir('.test-runtime/admin-menu',{recursive:true});
await writeFile('.test-runtime/admin-menu/header.mjs',bundle.outputFiles[0].contents);
const {createElement,act}=await import('react');
const {createRoot}=await import('react-dom/client');
const {SiteHeader,AdminPanel,AdminReviews,AdminUsers,AuthSetup}=await import(new URL('../.test-runtime/admin-menu/header.mjs',import.meta.url));
window[Symbol.for('vinext.navigationRuntime')]={bootstrap:{routeManifest:null,rsc:undefined},functions:{navigate:()=>new Promise(()=>{})}};
globalThis.routerAttempts=[];
const documents=[];
document.addEventListener('click',event=>{
 const link=event.target.closest('a');
 if(link&&!event.defaultPrevented){documents.push(new URL(link.href).pathname);event.preventDefault();}
});

const root=createRoot(document.getElementById('root'));
async function render(email,isAdmin,provider='Google'){await act(async()=>root.render(createElement(SiteHeader,{account:{email,displayName:'Fixture account',provider},isAdmin})));}
async function openMenu(){
 const trigger=document.querySelector('[aria-label="Benutzermenü öffnen"]');
 await act(async()=>trigger.dispatchEvent(new MouseEvent('pointerdown',{bubbles:true,cancelable:true,button:0})));
 assert(document.querySelector('[role="menu"]'),'the real user menu opens');
}

try{
 for(const email of ['first-admin@example.test','second-admin@example.test']){
  await render(email,true);
  for(const [label,path] of [['Verwaltung','/verwaltung'],['Bewertungen prüfen','/verwaltung/bewertungen']]){
   for(const input of ['click','Enter']){
    await openMenu();
    const item=[...document.querySelectorAll('[role="menuitem"]')].find(node=>node.textContent===label);
    assert(item,`${label} is available to ${email}`);
    assert.equal(item.getAttribute('href'),path);
    const before=documents.length;
    await act(async()=>{
     if(input==='Enter'){item.focus();item.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}));}
     else item.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,button:0}));
    });
    assert.equal(documents.length,before+1,`${email}: ${input} on ${label} must open the destination even when the client router stalls`);
    assert.equal(documents.at(-1),path);
    assert.equal(document.querySelector('[role="menu"]'),null,'selection closes the menu');
   }
  }
 }
 await render('customer@example.test',false);
 await openMenu();
 assert(![...document.querySelectorAll('[role="menuitem"]')].some(node=>['Verwaltung','Bewertungen prüfen'].includes(node.textContent)),'customers do not receive admin entries');
 assert.deepEqual(routerAttempts,[],'admin navigation does not depend on the stalled client router');
 const control=[...document.querySelectorAll('[role="menuitem"]')].find(node=>node.textContent==='Meine Bewertungen');
 const before=documents.length;
 await act(async()=>control.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,button:0})));
 assert.deepEqual(routerAttempts,['/?besuche=1'],'the control link exercises the real client-router boundary');
 assert.equal(documents.length,before,'the stalled client-router control cannot load a document');
 routerAttempts.length=0;
 const sections=[['Werkstätten','/verwaltung','workshops'],['Bewertungen prüfen','/verwaltung/bewertungen','reviews'],['Benutzer','/verwaltung/benutzer','users'],['Login & Registrierung','/verwaltung/anmeldung','login']];
 async function activate(link,input){
  const before=documents.length;
  await act(async()=>{
   if(input==='Enter'){
    link.focus();
    // The browser activates an anchor after an unhandled Enter keydown.
    if(link.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true})))link.click();
   }else link.click();
  });
  assert.equal(documents.length,before+1,`${input} on ${link.textContent} must load the destination when the client router stalls`);
  assert.equal(documents.at(-1),new URL(link.href).pathname);
 }
 for(const email of ['first-admin@example.test','second-admin@example.test']){
  for(const [Page,active] of [[AdminPanel,'workshops'],[AdminReviews,'reviews'],[AdminUsers,'users'],[AuthSetup,'login']]){
   await act(async()=>root.render(createElement(Page,{account:{email,displayName:'Fixture account',provider:'Google'}})));
   const navigation=document.querySelector('nav[aria-label="Verwaltung"]');
   assert(navigation,`${active} includes the shared admin navigation`);
   assert.equal(navigation.querySelectorAll('[aria-current="page"]').length,1);
   for(const [label,path,section] of sections){
    const link=[...navigation.querySelectorAll('a')].find(node=>node.textContent===label);
    assert(link,`${active} offers ${label}`);
    assert.equal(link.getAttribute('href'),path);
    assert.equal(link.getAttribute('aria-current'),section===active?'page':null);
    for(const input of ['click','Enter'])await activate(link,input);
   }
   if(active==='workshops'){
    for(const link of document.querySelectorAll('main a[href="/verwaltung/bewertungen"]')){
     for(const input of ['click','Enter'])await activate(link,input);
    }
   }
  }
 }
 assert.deepEqual(routerAttempts,[],'all admin section links work independently of the client router');
 const originalFetch=globalThis.fetch,logoutRequests=[];
 try{
  // A retryable response avoids jsdom's unimplemented document navigation;
  // the auth route suite separately verifies successful session revocation.
  globalThis.fetch=async(url,options)=>{logoutRequests.push({url,options});return new Response(null,{status:503});};
  for(const provider of ['Google','E-Mail']){
   await render('logout@example.test',false,provider);await openMenu();
   const logout=[...document.querySelectorAll('[role="menuitem"]')].find(node=>node.textContent==='Abmelden');
   const requestsBefore=logoutRequests.length,documentsBefore=documents.length;
   await act(async()=>logout.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,button:0})));
   assert.equal(logoutRequests.length,requestsBefore+1,`${provider} logout must revoke its app session through the auth API`);
   assert.equal(logoutRequests.at(-1).url,'/api/auth/logout');assert.equal(logoutRequests.at(-1).options.method,'POST');
   assert.equal(documents.length,documentsBefore,`${provider} logout must not use the ChatGPT sign-out endpoint`);
   await act(async()=>document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true})));
  }
 }finally{globalThis.fetch=originalFetch;}
 console.log('Admin navigation: both accounts, all four pages, mouse/keyboard, shortcuts, active section and customer visibility passed');
}finally{
 await act(async()=>root.unmount());
 dom.window.close();
}
