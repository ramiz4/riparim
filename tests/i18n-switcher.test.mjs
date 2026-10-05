import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdir,writeFile} from 'node:fs/promises';
import {JSDOM,VirtualConsole} from 'jsdom';
import {createElement,act} from 'react';
import {createRoot} from 'react-dom/client';
const out=new URL('../.test-runtime/i18n-switcher.mjs',import.meta.url);
const source=`export {I18nProvider} from './lib/i18n/client';export {getMessages} from './lib/i18n/messages';export {LanguageSwitcher} from './components/language-switcher';export {useNavigationGuard} from './lib/i18n/navigation-guard';export {languageSwitchHref} from './lib/i18n/navigation';`;
const result=await build({stdin:{contents:source,resolveDir:process.cwd(),loader:'tsx'},bundle:true,format:'esm',platform:'node',jsx:'automatic',write:false,external:['react','react/jsx-runtime','lucide-react']});await mkdir(new URL('.',out),{recursive:true});await writeFile(out,result.outputFiles[0].text);
const {I18nProvider,getMessages,LanguageSwitcher,useNavigationGuard,languageSwitchHref}=await import(out);
assert.equal(languageSwitchHref('/sq#suche','en'),'/en#suche');
assert.equal(languageSwitchHref('/#so-gehts','sq'),'/sq#so-gehts');
assert.equal(languageSwitchHref('/sq/werkstatt/test-id?suche=%2Fsq%2Fwerkstaetten%3Fort%3Dprizren%26sprache%3Dsq&token_hash=secret&vehicle=private#bewerten','en'),'/en/werkstatt/test-id?suche=%2Fen%2Fwerkstaetten%3Fort%3Dprizren%26sprache%3Dsq#bewerten');
assert.equal(languageSwitchHref('/anmelden?weiter=%2Fsq%2Fauth%2Fbestaetigen%3Ftoken_hash%3Dsecret','en'),'/en/anmelden');
assert.equal(languageSwitchHref('/sq/anmelden?weiter=%2Fsq%2Fwerkstatt%2Ftest-id%3Fvehicle%3Dprivate%23bewerten&access_token=secret','en'),'/en/anmelden?weiter=%2Fen%2Fwerkstatt%2Ftest-id%23bewerten');
assert.equal(languageSwitchHref('/?besuche=1&einreichung=11111111-1111-1111-1111-111111111111&problem=private','sq'),'/sq?besuche=1');
assert.equal(languageSwitchHref('/werkstaetten?sprache=sq&ort=prizren&localeNotice=preference_not_saved','en'),'/en/werkstaetten?ort=prizren&sprache=sq');
const errors=[],console=new VirtualConsole();console.on('jsdomError',error=>errors.push(error.message));
const dom=new JSDOM('<div id="root"></div>',{url:'https://riparim.test/en/werkstatt/test-id#bewerten',virtualConsole:console});
for(const key of ['window','document','navigator','HTMLElement','Element','Node','Event','MouseEvent'])Object.defineProperty(globalThis,key,{value:dom.window[key],configurable:true});globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const root=createRoot(document.getElementById('root'));let confirmations=[];window.confirm=message=>{confirmations.push(message);return false;};
function FormState({dirty,busy}){useNavigationGuard({dirty,busy});return null;}
async function render(state){await act(async()=>root.render(createElement(I18nProvider,{locale:'en',messages:getMessages('en',['common'])},createElement(FormState,state),createElement(LanguageSwitcher))));}
try{
 await render({dirty:true,busy:false});const select=document.querySelector('select');assert.equal(select.value,'en');assert.equal(select.options[1].textContent,'Shqip');assert.equal(document.querySelector('label').htmlFor,select.id);select.focus();assert.equal(document.activeElement,select);
 await act(async()=>{select.value='sq';select.dispatchEvent(new Event('change',{bubbles:true}));});assert.equal(confirmations.length,1);assert.equal(select.value,'en','Cancelled language remains visibly active');assert.match(confirmations[0],/unsaved/i);assert.deepEqual(errors,[],'Cancelling retains the document and private draft');
 await render({dirty:true,busy:true});assert.equal(document.querySelector('select').disabled,true,'Active mutation blocks language navigation');
 await render({dirty:false,busy:false});assert.equal(document.querySelector('select').disabled,false,'Clearly finished mutation releases the selector');
}finally{await act(async()=>root.unmount());dom.window.close();}
process.stdout.write('Language switch: public URL sanitization, safe return, keyboard control, localized draft cancellation and mutation guard passed\n');
