import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {build} from 'esbuild';
import {JSDOM} from 'jsdom';

const dom=new JSDOM('<div id="root"></div>',{url:'https://fixture.example.test',pretendToBeVisual:true});
Object.assign(globalThis,{window:dom.window,document:dom.window.document,HTMLElement:dom.window.HTMLElement,HTMLInputElement:dom.window.HTMLInputElement,Event:dom.window.Event,IS_REACT_ACT_ENVIRONMENT:true,requestAnimationFrame:fn=>setTimeout(fn,0)});
const React=await import('react'),{act}=React,{createRoot}=await import('react-dom/client');
await mkdir('.test-runtime/workshop-emails-ui',{recursive:true});
await build({stdin:{contents:"export {WorkshopEmailsEditor} from './components/workshop-emails';export {I18nProvider} from './lib/i18n/client';export {getMessages} from './lib/i18n/messages';",resolveDir:process.cwd(),loader:'ts'},bundle:true,format:'esm',platform:'node',packages:'external',outfile:'.test-runtime/workshop-emails-ui/source.mjs'});
const {WorkshopEmailsEditor,I18nProvider,getMessages}=await import(new URL('../.test-runtime/workshop-emails-ui/source.mjs',import.meta.url));
let root=createRoot(document.getElementById('root')),entries;
function Harness({locale}){const [emails,setEmails]=React.useState([{address:'one@example.test',active:true,verified:false},{address:'two@example.test',active:true,verified:true}]);entries=emails;return React.createElement(I18nProvider,{locale,messages:getMessages(locale,['common'])},React.createElement(WorkshopEmailsEditor,{emails,onChange:setEmails}));}
const click=async element=>act(async()=>{element.click();await new Promise(resolve=>setTimeout(resolve,10));});
try{
 for(const locale of ['de','sq','en']){
  await act(async()=>root.render(React.createElement(Harness,{locale,key:locale})));
  const messages=getMessages(locale).common,fieldset=document.querySelector('fieldset');
  assert.equal(fieldset.querySelector('legend').textContent,messages.workshopEmails);
  assert.equal(document.querySelectorAll('input[type="email"]').length,2);
  for(const input of document.querySelectorAll('input[type="email"]'))assert(document.querySelector(`label[for="${input.id.replaceAll('"','\\"')}"]`));
  const flags=document.querySelectorAll('input[type="checkbox"]');await click(flags[1]);assert(entries[0].verified);await click(flags[0]);assert(!entries[0].active&&entries[0].verified);
  let input=document.querySelector('input[type="email"]');await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'changed@example.test');input.dispatchEvent(new Event('input',{bubbles:true}));});assert(!entries[0].verified,'Changing an address clears its previous verification');
  const add=[...document.querySelectorAll('button')].find(b=>b.textContent===messages.workshopEmailAdd);
  await click(add);assert.equal(entries.length,3);assert.equal(document.querySelectorAll('input[type="email"]')[2],document.activeElement,'Adding an address focuses its input');
  await click(document.querySelectorAll('.workshop-email-row button')[2]);assert.equal(entries.length,2);assert.equal(document.activeElement,document.querySelectorAll('input[type="email"]')[1],'Removing an address preserves keyboard focus');
  for(let i=entries.length;i<10;i++)await click(add);assert(add.disabled);assert.equal(entries.length,10);assert.equal(document.querySelector('input[type="email"]').maxLength,254);
  while(entries.length)await click(document.querySelector('.workshop-email-row button'));assert.equal(document.activeElement,add);assert.equal(document.querySelectorAll('input[type="email"]').length,0);
 }
 console.log('Workshop email editor: DE/SQ/EN labels, per-address verification/deactivation, changed-address reset, add/remove keyboard focus, empty state and ten-address limit passed');
}finally{await act(async()=>root.unmount());dom.window.close();}
