import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {JSDOM,VirtualConsole} from 'jsdom';

const dom=new JSDOM('<div id="root"></div>',{url:'https://riparim.example.test/',pretendToBeVisual:true,virtualConsole:new VirtualConsole()});
for(const key of ['window','document','navigator','HTMLElement','HTMLButtonElement','HTMLInputElement','DocumentFragment','Element','Node','NodeFilter','MutationObserver','CustomEvent','Event','MouseEvent','KeyboardEvent','getComputedStyle'])Object.defineProperty(globalThis,key,{value:dom.window[key],configurable:true});
globalThis.requestAnimationFrame=dom.window.requestAnimationFrame.bind(dom.window);
globalThis.cancelAnimationFrame=dom.window.cancelAnimationFrame.bind(dom.window);
globalThis.IS_REACT_ACT_ENVIRONMENT=true;

const {build}=createRequire(new URL('../package.json',import.meta.url))('esbuild');
const output='.test-runtime/footer-ui';
const bundle=await build({stdin:{contents:"export {DirectoryFooter} from './components/directory-footer';export {I18nProvider} from './lib/i18n/client';export {getMessages} from './lib/i18n/messages';",resolveDir:process.cwd()},outfile:output+'/footer.mjs',bundle:true,write:false,platform:'node',format:'esm',jsx:'automatic',packages:'external',external:['react','react/jsx-runtime'],plugins:[{name:'footer-boundaries',setup(b){
 b.onResolve({filter:/^next\/link$/},()=>({path:'link',namespace:'fixture'}));
 b.onLoad({filter:/.*/,namespace:'fixture'},()=>({loader:'js',contents:"import {createElement} from 'react';export default function Link({href,children,...props}){return createElement('a',{...props,href},children);}"}));
 b.onResolve({filter:/\.module\.css$/},args=>({path:args.path,namespace:'css-fixture'}));
 b.onLoad({filter:/.*/,namespace:'css-fixture'},()=>({loader:'js',contents:"export default {logo:'brand-logo'};"}));
}}]});
await mkdir(output,{recursive:true});
await writeFile(output+'/footer.mjs',bundle.outputFiles[0].contents);
const {createElement,act,useState}=await import('react');
const {createRoot}=await import('react-dom/client');
const {DirectoryFooter,I18nProvider,getMessages}=await import(new URL('../'+output+'/footer.mjs',import.meta.url));
const changes=[];
function ControlledFooter(){const [open,setOpen]=useState(false);return createElement(DirectoryFooter,{open,onOpenChange:value=>{changes.push(value);setOpen(value);}});}
const root=createRoot(document.getElementById('root'));
const dialog=()=>document.querySelector('[role="dialog"]');
const opener=()=>[...document.querySelectorAll('footer button')].find(button=>button.textContent==='Quellen & Nachweise');
const flushFocus=()=>act(async()=>{await new Promise(resolve=>setTimeout(resolve,0));});
const activate=async control=>{assert(control,'The requested footer control is present');await act(async()=>{control.focus();control.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,button:0,detail:0}));});};
let checks=0;
const check=(condition,label)=>{assert(condition,label);checks++;};
try{
 for(const [mode,Component] of [['uncontrolled',DirectoryFooter],['controlled',ControlledFooter]]){
  await act(async()=>root.render(createElement(I18nProvider,{locale:'de',messages:getMessages('de',['common','public'])},createElement(Component))));
  const source=opener();
  check(source&&!source.disabled&&source.tabIndex>=0,`${mode}: the source opener is a keyboard-focusable button`);
  source.focus();
  check(document.activeElement===source,`${mode}: keyboard focus reaches the source opener`);
  await activate(source);
  check(dialog()&&dialog().contains(document.activeElement),`${mode}: opening sources moves focus inside the real dialog`);
  check(document.getElementById(dialog().getAttribute('aria-labelledby'))?.textContent==='Quellen & Nachweise',`${mode}: the dialog has its existing accessible title`);
  check(dialog().textContent.includes('Betriebsangaben')&&dialog().textContent.includes('Private Belege'),`${mode}: opening sources shows the existing information`);
  await act(async()=>document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true})));
  await flushFocus();
  check(!dialog(),`${mode}: Escape closes the source dialog`);
  check(document.activeElement===source,`${mode}: Escape restores focus to the source opener`);
  check(source.getAttribute('aria-expanded')==='false',`${mode}: the opener announces its closed state`);
  await activate(source);
  check(dialog()&&source.getAttribute('aria-expanded')==='true',`${mode}: the source dialog can be opened again`);
  await activate(dialog().querySelector('[data-slot="dialog-footer"] button'));
  await flushFocus();
  check(!dialog()&&document.activeElement===source,`${mode}: the explicit close button also restores focus to the source opener`);
 }
 check(JSON.stringify(changes)===JSON.stringify([true,false,true,false]),'Controlled opening and both closing actions flow through onOpenChange');
 console.log(JSON.stringify({footerUiChecksPassed:checks,realDialog:true,liveRequests:false}));
}finally{await act(async()=>root.unmount());dom.window.close();}
