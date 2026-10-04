import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {JSDOM,VirtualConsole} from 'jsdom';

const dom=new JSDOM('<div id="root"></div>',{url:'https://riparim.test/',pretendToBeVisual:true,virtualConsole:new VirtualConsole()});
for(const key of ['window','document','navigator','HTMLElement','Element','Node','NodeFilter','MutationObserver','CustomEvent','Event','MouseEvent','KeyboardEvent','getComputedStyle'])Object.defineProperty(globalThis,key,{value:dom.window[key],configurable:true});
globalThis.requestAnimationFrame=dom.window.requestAnimationFrame.bind(dom.window);
globalThis.cancelAnimationFrame=dom.window.cancelAnimationFrame.bind(dom.window);
globalThis.IS_REACT_ACT_ENVIRONMENT=true;

const {build}=createRequire(new URL('../package.json',import.meta.url))('esbuild');
const bundle=await build({entryPoints:['components/site-header.tsx'],bundle:true,platform:'node',format:'esm',outfile:'.test-runtime/admin-menu/header.mjs',write:false,packages:'external',loader:{'.css':'empty'},define:{'process.env.__VINEXT_HAS_PAGES_ROUTER':'"false"','process.env.__VINEXT_HAS_CLIENT_REWRITES':'"false"'},plugins:[{name:'app-router-boundary',setup(b){
 b.onResolve({filter:/^next\/link$/},()=>({path:new URL('../node_modules/vinext/dist/shims/link.js',import.meta.url).pathname}));
 // Exercise the real Link and Radix menu with an App Router that never commits.
 b.onResolve({filter:/^\.\/navigation\.js$/},args=>args.importer.endsWith('/shims/link.js')?{path:'stalled-router',namespace:'fixture'}:undefined);
 b.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:'export function navigateClientSide(href){globalThis.routerAttempts.push(href);return new Promise(()=>{});}',loader:'js'}));
}}]});
await mkdir('.test-runtime/admin-menu',{recursive:true});
await writeFile('.test-runtime/admin-menu/header.mjs',bundle.outputFiles[0].contents);
const {createElement,act}=await import('react');
const {createRoot}=await import('react-dom/client');
const {SiteHeader}=await import(new URL('../.test-runtime/admin-menu/header.mjs',import.meta.url));
window[Symbol.for('vinext.navigationRuntime')]={bootstrap:{routeManifest:null,rsc:undefined},functions:{navigate:()=>new Promise(()=>{})}};
globalThis.routerAttempts=[];
const documents=[];
document.addEventListener('click',event=>{
 const link=event.target.closest('a');
 if(link&&!event.defaultPrevented){documents.push(new URL(link.href).pathname);event.preventDefault();}
});

const root=createRoot(document.getElementById('root'));
async function render(email,isAdmin){await act(async()=>root.render(createElement(SiteHeader,{account:{email,displayName:'Ramiz',provider:'Google'},isAdmin})));}
async function openMenu(){
 const trigger=document.querySelector('[aria-label="Benutzermenü öffnen"]');
 await act(async()=>trigger.dispatchEvent(new MouseEvent('pointerdown',{bubbles:true,cancelable:true,button:0})));
 assert(document.querySelector('[role="menu"]'),'the real user menu opens');
}

try{
 for(const email of ['ramiz4@gmx.de','ramiz.loki@gmx.de']){
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
 console.log('Admin menu: both accounts, mouse and keyboard navigation, menu closure and customer visibility passed');
}finally{
 await act(async()=>root.unmount());
 dom.window.close();
}
