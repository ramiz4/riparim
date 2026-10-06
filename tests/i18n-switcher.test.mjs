import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdir,writeFile} from 'node:fs/promises';
import {JSDOM,VirtualConsole} from 'jsdom';
import {createElement,act} from 'react';
import {createRoot} from 'react-dom/client';
const out=new URL('../.test-runtime/i18n-switcher.mjs',import.meta.url);
const source=`export {I18nProvider} from './lib/i18n/client';export {getMessages} from './lib/i18n/messages';export {LanguageSwitcher} from './components/language-switcher';export {useNavigationGuard} from './lib/i18n/navigation-guard';export {languageSwitchHref} from './lib/i18n/navigation';export {preferredLanguageHref} from './lib/i18n/preference';`;
const result=await build({stdin:{contents:source,resolveDir:process.cwd(),loader:'tsx'},bundle:true,format:'esm',platform:'node',jsx:'automatic',write:false,external:['react','react/jsx-runtime','lucide-react']});await mkdir(new URL('.',out),{recursive:true});await writeFile(out,result.outputFiles[0].text);
const {I18nProvider,getMessages,LanguageSwitcher,useNavigationGuard,languageSwitchHref,preferredLanguageHref}=await import(out);
assert.equal(languageSwitchHref('/sq#suche','en'),'/en#suche');
assert.equal(languageSwitchHref('/#so-gehts','sq'),'/sq#so-gehts');
assert.equal(languageSwitchHref('/sq/werkstatt/test-id?suche=%2Fsq%2Fwerkstaetten%3Fort%3Dprizren%26sprache%3Dsq&token_hash=secret&vehicle=private#bewerten','en'),'/en/werkstatt/test-id?suche=%2Fen%2Fwerkstaetten%3Fort%3Dprizren%26sprache%3Dsq#bewerten');
assert.equal(languageSwitchHref('/anmelden?weiter=%2Fsq%2Fauth%2Fbestaetigen%3Ftoken_hash%3Dsecret','en'),'/en/anmelden');
assert.equal(languageSwitchHref('/sq/anmelden?weiter=%2Fsq%2Fwerkstatt%2Ftest-id%3Fvehicle%3Dprivate%23bewerten&access_token=secret','en'),'/en/anmelden?weiter=%2Fen%2Fwerkstatt%2Ftest-id%23bewerten');
assert.equal(languageSwitchHref('/?besuche=1&einreichung=11111111-1111-1111-1111-111111111111&problem=private','sq'),'/sq?besuche=1');
assert.equal(languageSwitchHref('/werkstaetten?sprache=sq&ort=prizren&localeNotice=preference_not_saved','en'),'/en/werkstaetten?ort=prizren&sprache=sq');
assert.equal(languageSwitchHref('/werkstaetten?bewerten=1','sq'),'/sq/werkstaetten?bewerten=1','Language navigation retains the public review-selection context');
assert.equal(languageSwitchHref('/?nachweis=fixture-workshop','en'),'/en?nachweis=fixture-workshop','An old workshop link retains its assignment across languages before redirect');
const errors=[],console=new VirtualConsole();console.on('jsdomError',error=>errors.push(error.message));
const dom=new JSDOM('<div id="root"></div>',{url:'https://riparim.test/en/werkstatt/test-id#bewerten',virtualConsole:console});
for(const key of ['window','document','navigator','HTMLElement','Element','Node','Event','MouseEvent'])Object.defineProperty(globalThis,key,{value:dom.window[key],configurable:true});globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const root=createRoot(document.getElementById('root'));let confirmations=[];window.confirm=message=>{confirmations.push(message);return false;};
function FormState({dirty,busy}){useNavigationGuard({dirty,busy});return createElement("input",{"aria-label":"Private fixture draft",defaultValue:"Original in-memory fixture draft"});}
async function render(state,verifiedAccount=false,locale='en'){await act(async()=>root.render(createElement(I18nProvider,{locale,messages:getMessages(locale,['common'])},createElement(FormState,state),createElement(LanguageSwitcher,{verifiedAccount}))));}
try{
 await render({dirty:true,busy:false});const select=document.querySelector('select');assert.equal(select.value,'en');assert.equal(select.options[1].textContent,'Shqip');assert.equal(document.querySelector('label').htmlFor,select.id);select.focus();assert.equal(document.activeElement,select);
 await act(async()=>{select.value='sq';select.dispatchEvent(new Event('change',{bubbles:true}));});assert.equal(confirmations.length,1);assert.equal(select.value,'en','Cancelled language remains visibly active');assert.match(confirmations[0],/unsaved/i);assert.deepEqual(errors,[],'Cancelling retains the document and private draft');
 await render({dirty:true,busy:true});assert.equal(document.querySelector('select').disabled,true,'Active mutation blocks language navigation');
 await render({dirty:false,busy:false});assert.equal(document.querySelector('select').disabled,false,'Clearly finished mutation releases the selector');
 const originalComponentFetch=globalThis.fetch;
 try{
  for(const locale of ['de','sq','en']){
   dom.reconfigure({url:'https://riparim.test'+(locale==='de'?'':'/'+locale)+'/werkstatt/test-id#bewerten'});
   const next=locale==='de'?'sq':locale==='sq'?'en':'de';
   for(const mode of ['busy','dirty-cancel','dirty-confirm','existing-dirty-cancel']){
    let complete,called=false;globalThis.fetch=async(_url,init)=>{assert.deepEqual(JSON.parse(init.body),{preferredLocale:next});called=true;return new Promise(resolve=>complete=resolve);};
    const initialDirty=mode==='existing-dirty-cancel';let calls=0;
    window.confirm=message=>{confirmations.push(message);calls++;return initialDirty?calls===1:mode==='dirty-confirm';};
    await render({dirty:initialDirty,busy:false},true,locale);errors.length=0;
    const select=document.querySelector('select');
    await act(async()=>{select.value=next;select.dispatchEvent(new Event('change',{bubbles:true}));});
    assert(called&&select.disabled,'Actual selector waits on the verified-account PATCH');
    const draft=document.querySelector('[aria-label="Private fixture draft"]');draft.value='New private in-memory fixture draft';
    await render({dirty:mode!=='busy',busy:mode==='busy'},true,locale);
    await act(async()=>complete(Response.json({preferredLocale:next})));
    const navigation=errors.filter(message=>/navigation/i.test(message));
    if(mode==='dirty-confirm')assert.equal(navigation.length,1,'Freshly dirty inputs can leave only after an explicit localized confirmation');
    else{
     assert.equal(navigation.length,0,'A new mutation or declined latest draft confirmation cancels pending document navigation');
     assert.equal(select.value,locale,'Cancelled pending navigation keeps the active locale');
     assert.equal(draft.value,'New private in-memory fixture draft','Cancelled pending navigation retains new private input only in the document');
     if(mode==='busy'){assert(select.disabled,'Active mutation still guards the selector');await render({dirty:false,busy:false},true,locale);}
     assert.equal(document.querySelector('select').disabled,false,'Cancellation releases the pending preference lock for a later explicit retry');
    }
    if(mode!=='busy')assert.equal(confirmations.at(-1),getMessages(locale).common.discardDraft,'Latest dirty confirmation uses the current source document language');
    if(initialDirty)assert.equal(calls,2,'Existing dirty input is re-confirmed after the wait because new private edits are not sent through the boolean-only guard');
    // A successful document navigation remains locked; use a fresh component for the next case.
    await act(async()=>root.render(null));
   }
  }
 }finally{globalThis.fetch=originalComponentFetch;}
}finally{await act(async()=>root.unmount());dom.window.close();}
process.stdout.write('Language switch: public URL sanitization, safe return, keyboard control, localized draft cancellation and mutation guard passed\n');

const originalFetch=globalThis.fetch;let writes=[];
try{
 globalThis.fetch=async(url,init)=>{writes.push({url,init});return Response.json({preferredLocale:'sq'});};
 assert.equal(await preferredLanguageHref('/en/werkstaetten?ort=prizren&sprache=sq','sq',true),'/sq/werkstaetten?ort=prizren&sprache=sq');
 assert.equal(writes[0].url,'/api/account');assert.equal(writes[0].init.method,'PATCH');assert.deepEqual(JSON.parse(writes[0].init.body),{preferredLocale:'sq'});
 globalThis.fetch=async()=>Response.json({errorCode:'unavailable'},{status:503});
 assert.equal(await preferredLanguageHref('/en/werkstatt/test-id#bewerten','sq',true),'/sq/werkstatt/test-id?localeNotice=preference_not_saved#bewerten');
 const before=writes.length;assert.equal(await preferredLanguageHref('/en?besuche=1','de',false),'/?besuche=1');assert.equal(writes.length,before,'Legacy accounts skip provider preference writes');
 const start=Date.now();globalThis.fetch=async()=>new Promise(()=>{});
 assert.equal(await preferredLanguageHref('/sq/einstellungen','en',true),'/en/einstellungen?localeNotice=preference_not_saved');
 assert.ok(Date.now()-start<4500,'Even an unresponsive provider cannot indefinitely block document navigation');
}finally{globalThis.fetch=originalFetch;}
