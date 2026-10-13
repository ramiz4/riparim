import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {JSDOM,VirtualConsole} from 'jsdom';

const require=createRequire(new URL('../package.json',import.meta.url));
const {build}=require('esbuild');
const output='.test-runtime/brand-navigation';
const bundle=await build({entryPoints:{header:'components/site-header.tsx',footer:'components/directory-footer.tsx',anchor:'components/locale-anchor.tsx',admin:'components/admin-navigation.tsx',i18n:'lib/i18n/client.tsx',messages:'lib/i18n/messages.ts'},outdir:output,bundle:true,splitting:true,write:false,platform:'node',format:'esm',jsx:'automatic',packages:'external',external:['react','react/jsx-runtime'],plugins:[{name:'navigation-boundaries',setup(b){
 b.onResolve({filter:/^next\/link$/},()=>({path:fileURLToPath(import.meta.resolve('vinext/shims/link')),external:true}));
 b.onResolve({filter:/\.module\.css$/},args=>({path:args.path,namespace:'css-fixture'}));
 b.onLoad({filter:/.*/,namespace:'css-fixture'},()=>({contents:"export default {logo:'brand-logo'};",loader:'js'}));
 b.onResolve({filter:/^(\.\/theme-toggle|@\/components\/(ui\/(dropdown-menu|dialog)|modal-shell))$/},args=>({path:args.path,namespace:'unrelated-ui'}));
 b.onLoad({filter:/.*/,namespace:'unrelated-ui'},()=>({loader:'js',contents:`
  import {createElement} from 'react';
  const Wrapper=({children})=>createElement('div',null,children);
  export const DropdownMenu=Wrapper,DropdownMenuTrigger=Wrapper,DropdownMenuContent=Wrapper,DropdownMenuLabel=Wrapper,DropdownMenuItem=Wrapper,DropdownMenuSeparator=()=>null;
  export function ThemeToggle(){return createElement('button',{'aria-label':'Theme wechseln'});}
  export const Dialog=Wrapper;
  export function DialogTrigger({children}){return children;}
  export const ModalContent=Wrapper;`}));
}}]});
await mkdir(output,{recursive:true});
for(const file of bundle.outputFiles)await writeFile(file.path,file.contents);

const dom=new JSDOM('<div id="root"></div>',{url:'https://riparim.example.test/anmelden?weiter=%2Fwerkstatt%2Ffixture#formular',pretendToBeVisual:true,virtualConsole:new VirtualConsole()});
for(const key of ['window','document','navigator','HTMLElement','Element','Node','Event','MouseEvent','KeyboardEvent','PopStateEvent'])Object.defineProperty(globalThis,key,{value:dom.window[key],configurable:true});
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
// Match this app's Vinext App Router mode; use the real Link shim rather than
// replacing its click handler with an inert anchor in the test.
process.env.__VINEXT_HAS_PAGES_ROUTER='false';
process.env.__VINEXT_HAS_CLIENT_REWRITES='false';
const {createElement,act}=await import('react');
const {createRoot}=await import('react-dom/client');
const {SiteHeader}=await import(new URL('../'+output+'/header.js',import.meta.url));
const {I18nProvider}=await import(new URL('../'+output+'/i18n.js',import.meta.url));
const {getMessages}=await import(new URL('../'+output+'/messages.js',import.meta.url));
const {LocaleAnchor}=await import(new URL('../'+output+'/anchor.js',import.meta.url));
const {AdminNavigation}=await import(new URL('../'+output+'/admin.js',import.meta.url));
const {DirectoryFooter}=await import(new URL('../'+output+'/footer.js',import.meta.url));
window[Symbol.for('vinext.navigationRuntime')]={bootstrap:{routeManifest:null,rsc:undefined},functions:{navigate:async href=>{window.history.pushState({},'',href);}}};
await import('vinext/shims/navigation');

const root=createRoot(document.getElementById('root'));
const routes=['/anmelden?weiter=%2Fwerkstatt%2Ffixture#formular','/registrieren?weiter=%2Fwerkstaetten','/werkstaetten?ort=prizren&leistung=diagnose-elektronik','/werkstatt/fixture?suche=%2Fwerkstaetten#bewerten','/?besuche=1#nachweise','/betriebe','/betriebe/beanspruchen?werkstatt=fixture','/verwaltung','/verwaltung/betriebe','/einstellungen','/datenschutz','/'];
let checks=0;
try{
 for(const [caller,Component,props] of [['header',SiteHeader,{account:null}],['footer',DirectoryFooter,{}]]){
  await act(async()=>root.render(createElement(Component,props)));
  for(const route of routes){
   window.history.replaceState({},'',route);
   const logo=document.querySelector(`${caller} a[aria-label="Riparim Startseite"]`);
   assert(logo,`${caller} exposes the real Brand as an accessible home link`);
   assert.equal(logo.getAttribute('href'),'/',`${caller} uses the root route`);
   logo.focus();
   assert.equal(document.activeElement,logo,`${caller} logo is keyboard focusable`);
   // Keyboard activation dispatches the same click with detail=0 in browsers.
   const event=new MouseEvent('click',{bubbles:true,cancelable:true,button:0,detail:route.startsWith('/anmelden')?0:1});
   await act(async()=>logo.dispatchEvent(event));
   assert.equal(event.defaultPrevented,true,`${caller} uses the client router without reloading the document`);
   assert.equal(window.location.pathname+window.location.search+window.location.hash,'/',`${caller} logo returns from ${route} to the root without preserving query or hash through the client router`);
   checks++;
  }
  const logo=document.querySelector(`${caller} a[aria-label="Riparim Startseite"]`);
  const modified=new MouseEvent('click',{bubbles:true,cancelable:true,button:0,ctrlKey:true});
  await act(async()=>logo.dispatchEvent(modified));
  assert.equal(modified.defaultPrevented,false,`${caller} preserves the browser's open-in-new-tab action`);
  checks++;
 }
 for(const locale of ['de','sq','en']){
  for(const [Component,props] of [[SiteHeader,{account:null}],[SiteHeader,{account:{email:'fixture@example.test',displayName:'Fixture Member',provider:'E-Mail'},isAdmin:true}],[AdminNavigation,{active:'workshops'}],[DirectoryFooter,{}]]){
   await act(async()=>root.render(createElement(I18nProvider,{locale,messages:getMessages(locale,['common','public','management'])},createElement(Component,props))));
   const anchors=[...document.querySelectorAll('a')].filter(anchor=>anchor.getAttribute('href')?.startsWith('/'));
   assert(anchors.length>0);
   for(const anchor of anchors){
    window.history.replaceState({},'','/fixture-origin');
    const href=anchor.getAttribute('href');
    assert(locale==='de'?!/^\/(sq|en)(\/|$)/.test(href):href.startsWith('/'+locale),`Navigation carries ${locale}`);
    const event=new MouseEvent('click',{bubbles:true,cancelable:true,button:0,detail:0});
    await act(async()=>anchor.dispatchEvent(event));
    assert(event.defaultPrevented,`${href} avoids document navigation`);
    assert.equal(window.location.pathname+window.location.search+window.location.hash,href);
    checks++;
   }
  }
 }
 // Technical endpoints, external destinations, downloads and explicit recovery
 // must keep native semantics. Intercept only after observing React's decision.
 for(const props of [
  {href:'/api/evidence/fixture?locale=en'},
  {href:'/auth/bestaetigen?code=fixture'},
  {href:'/signout-with-chatgpt?return_to=/'},
  {href:'https://outside.example.test/'},
  {href:'mailto:fixture@example.test'},
  {href:'tel:+38344123456'},
  {href:'#details'},
  {href:'/datenschutz',download:''},
  {href:'/einstellungen',target:'_blank'},
  {href:'/anmelden',target:'_top'},
  {href:'/bewertungen',reloadDocument:true},
 ]){
  await act(async()=>root.render(createElement(LocaleAnchor,props,'Fixture link')));
  const anchor=document.querySelector('a');
  let prevented;
  const observe=event=>{prevented=event.defaultPrevented;event.preventDefault();};
  window.addEventListener('click',observe);
  await act(async()=>anchor.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,button:0})));
  window.removeEventListener('click',observe);
  assert.equal(prevented,false,`${props.href} preserves native document/link semantics`);
  assert.equal(anchor.hasAttribute('reloadDocument'),false);
  checks++;
 }
 await act(async()=>root.render(createElement(LocaleAnchor,{href:'/einstellungen?weiter=%2Fwerkstaetten#konto',onClick:event=>event.preventDefault()},'Fixture link')));
 window.history.replaceState({},'','/fixture-origin');
 await act(async()=>document.querySelector('a').dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,button:0})));
 assert.equal(window.location.pathname,'/fixture-origin','A caller can cancel client navigation');
 checks++;
 console.log(JSON.stringify({appNavigationChecksPassed:checks,callers:['header','footer'],liveRequests:false}));
}finally{await act(async()=>root.unmount());dom.window.close();}
