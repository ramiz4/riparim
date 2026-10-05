import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdir,writeFile} from 'node:fs/promises';
import {JSDOM,VirtualConsole} from 'jsdom';

const dom=new JSDOM('<div id="root"></div>',{url:'https://riparim.example.test/verwaltung/anmeldung',pretendToBeVisual:true,virtualConsole:new VirtualConsole()});
for(const key of ['window','document','navigator','HTMLElement','HTMLButtonElement','HTMLFormElement','HTMLInputElement','HTMLTextAreaElement','HTMLSelectElement','DocumentFragment','Element','Node','NodeFilter','MutationObserver','CustomEvent','Event','MouseEvent','KeyboardEvent','getComputedStyle'])Object.defineProperty(globalThis,key,{value:dom.window[key],configurable:true});
globalThis.requestAnimationFrame=dom.window.requestAnimationFrame.bind(dom.window);
globalThis.cancelAnimationFrame=dom.window.cancelAnimationFrame.bind(dom.window);
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
// jsdom has no layout; native geometry and keyboard activation are checked separately.
globalThis.ResizeObserver=class{observe(){}unobserve(){}disconnect(){}};
const output='.test-runtime/auth-setup-ui';
const bundle=await build({stdin:{contents:"export {default as AuthSetup} from './app/[locale]/verwaltung/anmeldung/setup';export * from './lib/auth/email-templates';",resolveDir:process.cwd(),loader:'tsx'},outfile:output+'/ui.mjs',bundle:true,write:false,platform:'node',format:'esm',packages:'external'});
await mkdir(output,{recursive:true});await writeFile(output+'/ui.mjs',bundle.outputFiles[0].contents);
const {createElement,act}=await import('react'),{createRoot}=await import('react-dom/client');
const {AuthSetup,confirmationEmailSubject,confirmationEmailTemplate,recoveryEmailSubject,recoveryEmailTemplate}=await import(new URL('../'+output+'/ui.mjs',import.meta.url));
let config=null,loadMode='success',saveMode='success',pendingLoad,pendingSave;
const requests=[];
globalThis.fetch=async(url,options)=>{
 assert.equal(url,'/api/auth-settings','UI fixtures never contact external services');
 const method=options?.method??'GET';requests.push({method,body:options?.body?JSON.parse(options.body):null});
 if(method==='GET'){
  if(loadMode==='pending')return new Promise(resolve=>{pendingLoad=()=>resolve(Response.json({config}));});
  return loadMode==='failure'?Response.json({error:'Fixture configuration unavailable'},{status:503}):Response.json({config});
 }
 assert.equal(method,'POST');
 if(saveMode==='pending')return new Promise(resolve=>{pendingSave=()=>resolve(Response.json({ok:true}));});
 return saveMode==='failure'?Response.json({error:'Fixture connection rejected'},{status:400}):Response.json({ok:true});
};
let root=createRoot(document.getElementById('root'));
const mount=async()=>act(async()=>root.render(createElement(AuthSetup,{account:{email:'fixture@example.test',displayName:'Fixture Admin',provider:'ChatGPT'}})));
const remount=async()=>{await act(async()=>root.unmount());root=createRoot(document.getElementById('root'));await mount();};
const form=()=>document.querySelector('main form'),submitButton=()=>form().querySelector('button[type="submit"]');
const click=async node=>act(async()=>node.click());
const type=async(node,value)=>act(async()=>{Object.getOwnPropertyDescriptor(node.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,'value').set.call(node,value);node.dispatchEvent(new Event('input',{bubbles:true}));});
const submit=async()=>act(async()=>form().dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
try{
 await mount();
 assert.equal(document.querySelector('main h1').textContent,'Anmeldung verbinden.','The existing page title remains');
 assert.equal(document.querySelector('main h1+p').textContent,'Google und E-Mail über Supabase einrichten.','The existing subtitle remains');
 assert(!document.querySelector('main').textContent.includes('EIGENE KUNDENKONTEN'),'The redundant customer-account eyebrow is absent');
 const instructions=document.querySelector('section.setup-instructions');
 function visibleText(node){
  if(node.nodeType===Node.TEXT_NODE)return node.textContent;
  if(node.tagName==='DETAILS'&&!node.open)return visibleText(node.querySelector('summary'));
  return [...node.childNodes].map(visibleText).join(' ');
 }
 const initialText=visibleText(instructions);
 assert(initialText.includes('bestehende Supabase-Projekt'),'An already configured project can be reused');
 assert(initialText.length<1800&&!initialText.includes('{{'),'The initial instructions stay concise and hide lengthy provider templates');
 const disclosure=label=>[...instructions.querySelectorAll('details')].find(node=>node.querySelector('summary')?.textContent===label);
 const mailHelp=disclosure('URLs, SMTP und Mailvorlagen');
 assert(mailHelp&&!mailHelp.open,'Detailed provider settings are available in a closed native disclosure');
 await act(async()=>{mailHelp.querySelector('summary').focus();mailHelp.querySelector('summary').click();});
 assert(mailHelp.open&&document.activeElement===mailHelp.querySelector('summary'),'Opening provider help retains focus on its accessible summary');
 assert(mailHelp.textContent.includes('https://riparim.com/auth/bestaetigen\\?**'),'The copyable callback glob contains one literal backslash before the query delimiter');
 assert(!mailHelp.textContent.includes('https://riparim.com/auth/bestaetigen?**'),'The unescaped single-character wildcard is not offered as a callback allowlist value');
 assert(!mailHelp.textContent.includes('https://riparim.com/auth/bestaetigen**'),'The obsolete path wildcard is absent');
 assert(mailHelp.textContent.includes('SMTP')&&mailHelp.textContent.includes('Free-Projekten'),'The execution order accounts for SMTP before template customization');
 for(const [label,subject,body] of [['E-Mail-Bestätigung',confirmationEmailSubject,confirmationEmailTemplate],['Passwort-Wiederherstellung',recoveryEmailSubject,recoveryEmailTemplate]]){
  const template=disclosure(label);assert(template&&!template.open,'Large mail source is separately disclosed');
  await act(async()=>template.querySelector('summary').click());
  const fields=[...template.querySelectorAll('pre')].map(node=>node.textContent);
  assert.deepEqual(fields,[subject,body],'Each provider template supplies its central subject and HTML body together');
  for(const source of template.querySelectorAll('pre')){
   assert.equal(source.tabIndex,0,'Long provider sources are reachable for keyboard scrolling');
   source.focus();assert.equal(document.activeElement,source,'Each labelled source can receive keyboard focus');
  }
 }
 const googleHelp=disclosure('Google-Einstellungen');
 assert(googleHelp&&!googleHelp.open,'Google setup help is optional and initially closed');
 await act(async()=>googleHelp.querySelector('summary').click());
 assert(googleHelp.textContent.includes('https://riparim.com')&&googleHelp.textContent.includes('Callback-Adresse')&&googleHelp.textContent.includes('Client-ID')&&googleHelp.textContent.includes('Client-Secret'),'Google help retains the executable origin, provider callback and credential steps');
 assert(instructions.querySelector('a[href="https://supabase.com/docs/guides/auth/auth-smtp"]')&&instructions.querySelector('a[href="https://supabase.com/docs/guides/auth/social-login/auth-google"]'),'Official provider help stays reachable');
 assert(instructions.textContent.includes('Eine gleiche E-Mail-Adresse allein genügt nicht.'),'Evidence ownership guidance remains');
 assert.deepEqual(requests.map(request=>request.method),['GET'],'Reading and opening all guidance never saves or changes provider configuration');
 assert.equal(form().querySelector('h2').textContent,'Projekt verbinden','The existing connection form remains');
 const url=form().querySelector('input[type="url"]'),key=form().querySelector('textarea');
 assert(url.required&&url.closest('label').textContent==='Supabase-Projektadresse'&&key.required&&key.closest('label').textContent==='Öffentlicher Publishable-Key','Required connection fields retain their accessible labels');
 assert.equal(url.value,'');assert.equal(key.value,'');
 assert.deepEqual([...form().querySelectorAll('.auth-preview-links a')].map(node=>[node.textContent,node.getAttribute('href')]),[['Anmeldung ansehen','/anmelden'],['Registrierung ansehen','/registrieren'],['Passwort-Zurücksetzen ansehen','/passwort-vergessen']],'All customer previews retain their destinations');
 await type(url,'https://fixture.supabase.co');await type(key,'sb_publishable_fixture');await submit();
 assert.deepEqual(requests.at(-1).body,{projectUrl:'https://fixture.supabase.co',publicKey:'sb_publishable_fixture',enabled:false,emailDeliveryConfirmed:false},'Draft submission preserves the existing four-field settings contract');
 assert(form().querySelector('[role="status"]').textContent.includes('als Entwurf gespeichert'),'Draft success is announced');
 await click(form().querySelector('[role="switch"][aria-label="Kundenanmeldung aktivieren"]'));
 assert.equal(submitButton().textContent,'Verbindung prüfen & aktivieren','Activation retains its existing submit action');
 await submit();assert(requests.at(-1).body.enabled&&!requests.at(-1).body.emailDeliveryConfirmed,'Activation never claims untested mail delivery');
 assert(form().querySelector('[role="status"]').textContent.includes('Passwort-Wiederherstellung bleibt'),'Unconfirmed SMTP retains its existing recovery explanation');
 await click(form().querySelector('[role="checkbox"][aria-label="Produktiven E-Mail-Versand bestätigen"]'));
 saveMode='pending';await submit();
 assert(submitButton().disabled&&submitButton().textContent.includes('Verbindung wird geprüft'),'Connection verification announces its busy state and disables submission');
 const before=requests.length;await click(submitButton());assert.equal(requests.length,before,'A disabled submit action cannot send another connection request');
 await act(async()=>pendingSave());saveMode='success';
 assert(requests.at(-1).body.emailDeliveryConfirmed&&form().querySelector('[role="status"]').textContent.includes('Kundenanmeldung aktiviert.'),'Confirmed SMTP and activation retain their existing success state');
 saveMode='failure';await submit();
 assert.equal(form().querySelector('[role="alert"]').textContent,'Fixture connection rejected','Connection errors remain accessible');
 assert(!form().querySelector('[role="status"]'),'A failed save clears earlier success');
 config={projectUrl:'https://saved.supabase.co',publicKey:'sb_publishable_saved',enabled:true,emailDeliveryConfirmed:true};loadMode='pending';await remount();
 assert(submitButton().disabled&&form().querySelector('[role="status"]').textContent==='Konfiguration wird geladen …','Configuration loading retains its disabled submit action and announcement');
 await act(async()=>pendingLoad());loadMode='success';
 assert.equal(form().querySelector('input[type="url"]').value,'https://saved.supabase.co');assert.equal(form().querySelector('textarea').value,'sb_publishable_saved');
 assert.equal(form().querySelector('[role="switch"]').getAttribute('aria-checked'),'true');assert.equal(form().querySelector('[role="checkbox"]').getAttribute('aria-checked'),'true');
 assert(!submitButton().disabled,'Saved connection, activation and SMTP settings are reused without repeating setup');
 loadMode='failure';await remount();
 assert.equal(form().querySelector('[role="alert"]').textContent,'Fixture configuration unavailable','Loading failures remain accessible');
 console.log('Auth setup UI: compact native guidance, central subject/body templates, unchanged draft/activation/SMTP, previews, loading and errors passed; no live requests');
}finally{await act(async()=>root.unmount());dom.window.close();}
