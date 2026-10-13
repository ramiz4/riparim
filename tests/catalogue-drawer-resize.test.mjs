import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {build} from 'esbuild';
import {JSDOM} from 'jsdom';
const dom=new JSDOM('<div id="root"></div>',{url:'https://riparim.example.test/werkstaetten',pretendToBeVisual:true});
for(const key of ['window','document','navigator','HTMLElement','HTMLInputElement','Element','Node','Event','getComputedStyle'])Object.defineProperty(globalThis,key,{value:dom.window[key],configurable:true});
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
globalThis.requestAnimationFrame=callback=>setTimeout(callback,0);globalThis.cancelAnimationFrame=clearTimeout;
let width=390;
window.matchMedia=query=>({matches:query.includes('max-width: 1000px')&&width<=1000,addEventListener(){},removeEventListener(){}});
window.scrollTo=()=>{};HTMLElement.prototype.scrollIntoView=()=>{};
globalThis.IntersectionObserver=class{observe(){}disconnect(){}};
const output='.test-runtime/catalogue-drawer-resize';await mkdir(output,{recursive:true});
const boundaries={
 '@/components/site-header':'export function SiteHeader(){return null}',
 '@/components/directory-footer':'export function DirectoryFooter(){return null}',
 '@/components/workshop-card':'export function WorkshopCard(){return null}',
 '@/components/searchable-picker':`import React from 'react';export function SearchablePicker({id,label,value,onChange,values}){return <select id={id} aria-label={label} value={value} onChange={e=>onChange(e.target.value)}>{values.map(v=><option key={v}>{v}</option>)}</select>}`,
 '@/components/ui/dialog':`import React from 'react';export const Context=React.createContext(null);export function Dialog({open,onOpenChange,children}){return <Context.Provider value={{open,onOpenChange}}>{children}</Context.Provider>};export function DialogTrigger({children}){const c=React.useContext(Context);return React.cloneElement(children,{onClick:e=>{children.props.onClick?.(e);c.onOpenChange(true)}})}`,
 '@/components/modal-shell':`import React from 'react';import {Context} from '@/components/ui/dialog';export function ModalContent({children,footer,title,onCloseAutoFocus}){const c=React.useContext(Context);const prev=React.useRef(c.open);React.useEffect(()=>{if(prev.current&&!c.open)onCloseAutoFocus?.({preventDefault(){}});prev.current=c.open},[c.open]);return c.open?<div role="dialog" aria-label={title}>{children}{footer}</div>:null}`,
};
boundaries['@/components/picker']=boundaries['@/components/searchable-picker'].replace('function SearchablePicker','function Picker');
await build({stdin:{contents:"export {default as Catalogue} from './app/[locale]/werkstaetten/catalogue';export {defaultCatalogueFilters} from './lib/catalogue-filters';export {I18nProvider} from './lib/i18n/client';export {getMessages} from './lib/i18n/messages';",resolveDir:process.cwd(),loader:'tsx'},outfile:output+'/ui.mjs',bundle:true,platform:'node',format:'esm',packages:'external',plugins:[{name:'layout-boundaries',setup(b){b.onResolve({filter:/^@\/components\//},args=>boundaries[args.path]?{path:args.path,namespace:'fixture'}:undefined);b.onLoad({filter:/.*/,namespace:'fixture'},args=>({contents:boundaries[args.path],loader:'tsx',resolveDir:process.cwd()}));}}]});
const {Catalogue,defaultCatalogueFilters,I18nProvider,getMessages}=await import(new URL('../'+output+'/ui.mjs',import.meta.url));
const {createElement:h,act}=await import('react'),{createRoot}=await import('react-dom/client');
const root=createRoot(document.getElementById('root'));
try{
 await act(async()=>root.render(h(I18nProvider,{locale:'de',messages:getMessages('de',['common','public'])},h(Catalogue,{initialWorkshops:[],initialError:'',initialFilters:defaultCatalogueFilters,account:null,isAdmin:false}))));
 const trigger=document.querySelector('.catalogue-filter-button');
 await act(async()=>trigger.click());assert(document.querySelector('[role=dialog]'));
 const draft=document.querySelector('[role=dialog] select[aria-label="Leistung"]');
 await act(async()=>{draft.value='Bremsen & Fahrwerk';draft.dispatchEvent(new Event('change',{bubbles:true}));});
 assert.equal(window.location.search,'','Editing a draft does not commit filters');
 width=1001;await act(async()=>window.dispatchEvent(new Event('resize')));
 assert(!document.querySelector('[role=dialog]'),'Leaving mobile closes the drawer instead of retaining a desktop modal');
 assert.equal(document.activeElement,document.querySelector('input[type=search]'),'Resize returns focus to the visible search');
 assert.equal(window.location.search,'','Resize discards unconfirmed draft changes');
 width=390;await act(async()=>window.dispatchEvent(new Event('resize')));await act(async()=>trigger.click());
 assert.equal(document.querySelector('[role=dialog] select[aria-label="Leistung"]').value,'Alle Leistungen','Reopening starts with the committed filters');
 console.log('Catalogue drawer: draft isolation, breakpoint dismissal, search focus and discarded draft passed');
}finally{await act(async()=>root.unmount());dom.window.close();}
