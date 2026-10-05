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
const bundle=await build({stdin:{contents:"export {default as AuthSetup} from './app/[locale]/verwaltung/anmeldung/setup';export * from './lib/auth/email-templates';export {I18nProvider} from './lib/i18n/client';export {getMessages} from './lib/i18n/messages';",resolveDir:process.cwd(),loader:'tsx'},outfile:output+'/ui.mjs',bundle:true,write:false,platform:'node',format:'esm',packages:'external'});
await mkdir(output,{recursive:true});await writeFile(output+'/ui.mjs',bundle.outputFiles[0].contents);
const {createElement,act}=await import('react'),{createRoot}=await import('react-dom/client');
const {AuthSetup,I18nProvider,getMessages,confirmationEmailSubject,confirmationEmailTemplate,recoveryEmailSubject,recoveryEmailTemplate}=await import(new URL('../'+output+'/ui.mjs',import.meta.url));
let config=null,loadMode='success',saveMode='success',pendingLoad,pendingSave,locale='de';
const requests=[],copied=[];
globalThis.fetch=async(url,options)=>{
 assert.equal(url,'/api/auth-settings','UI fixtures never contact external services');
 const method=options?.method??'GET';requests.push({method,body:options?.body?JSON.parse(options.body):null});
 if(method==='GET'){
  if(loadMode==='pending')return new Promise(resolve=>{pendingLoad=()=>resolve(Response.json({config}));});
  return loadMode==='failure'?Response.json({error:'Private raw load failure',errorCode:'auth_config_unavailable'},{status:503}):Response.json({config});
 }
 assert.equal(method,'POST');
 if(saveMode==='pending')return new Promise(resolve=>{pendingSave=()=>resolve(Response.json({ok:true}));});
 return saveMode==='failure'?Response.json({error:'Private raw connection failure',errorCode:'auth_provider_connection'},{status:400}):Response.json({ok:true});
};
Object.defineProperty(navigator,'clipboard',{configurable:true,value:{async writeText(source){copied.push(source);}}});
let root=createRoot(document.getElementById('root'));
const mount=async()=>act(async()=>root.render(createElement(I18nProvider,{locale,messages:getMessages(locale,['common','customer','management'])},createElement(AuthSetup,{account:{email:'fixture@example.test',displayName:'Fixture Admin',provider:'ChatGPT'}}))));
const remount=async()=>{await act(async()=>root.unmount());root=createRoot(document.getElementById('root'));await mount();};
const form=()=>document.querySelector('main form'),submitButton=()=>form().querySelector('button[type="submit"]');
const click=async node=>act(async()=>node.click());
const type=async(node,value)=>act(async()=>{Object.getOwnPropertyDescriptor(node.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,'value').set.call(node,value);node.dispatchEvent(new Event('input',{bubbles:true}));});
const submit=async()=>act(async()=>form().dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
function visibleText(node){
 if(node.nodeType===Node.TEXT_NODE)return node.textContent;
 if(node.tagName==='DETAILS'&&!node.open)return visibleText(node.querySelector('summary'));
 return [...node.childNodes].map(visibleText).join(' ');
}
const screens=[
 {locale:'de',title:'Anmeldung verbinden.',subtitle:'Google und E-Mail über Supabase einrichten.',mailHelp:'URLs, SMTP und Mailvorlagen',googleHelp:'Google-Einstellungen',headings:['Projekt wählen','Website und E-Mails','Versand testen','Google verbinden'],fields:['Bestätigungsbetreff','Bestätigungs-HTML','Wiederherstellungsbetreff','Wiederherstellungs-HTML']},
 {locale:'sq',title:'Lidh hyrjen.',subtitle:'Konfiguro Google dhe email përmes Supabase.',mailHelp:'URL-të, SMTP dhe modelet e emailit',googleHelp:'Cilësimet e Google',headings:['Zgjidh projektin','Faqja dhe emailet','Testo dërgimin','Lidh Google'],fields:['Subjekti i konfirmimit','HTML i konfirmimit','Subjekti i rikthimit','HTML i rikthimit']},
 {locale:'en',title:'Connect authentication.',subtitle:'Set up Google and email through Supabase.',mailHelp:'URLs, SMTP and email templates',googleHelp:'Google settings',headings:['Choose project','Website and email','Test sending','Connect Google'],fields:['Confirmation subject','Confirmation HTML','Recovery subject','Recovery HTML']}
];
try{
 for(const screen of screens){
  locale=screen.locale;config=null;loadMode='success';saveMode='success';requests.length=0;copied.length=0;await remount();
  const copy=getMessages(locale).management,prefix=locale==='de'?'':'/'+locale;
  assert.equal(document.querySelector('main h1').textContent,screen.title,'The current localized page title remains');
  assert.equal(document.querySelector('main h1+p').textContent,screen.subtitle,'The current localized subtitle remains');
  assert(!document.querySelector('main .eyebrow'),'The redundant account eyebrow stays absent in every locale');
  const instructions=document.querySelector('section.setup-instructions'),initialText=visibleText(instructions);
  assert.deepEqual([...instructions.querySelectorAll('.setup-steps>li>h3')].map(node=>node.textContent),screen.headings,'Every locale has the same four concise setup tasks');
  assert(initialText.includes(copy.authReuseProject),'An existing project and tested configuration can be reused in the active locale');
  assert(initialText.length<1800&&!initialText.includes('{{')&&!initialText.includes('SITE_ORIGIN'),'The initial view hides large Go sources and lengthy export instructions');
  assert([...instructions.querySelectorAll('details')].every(node=>!node.open),'All optional provider help and mail sources start closed');
  const disclosure=label=>[...instructions.querySelectorAll('details')].find(node=>node.querySelector('summary')?.textContent===label);
  const mailHelp=disclosure(screen.mailHelp);assert(mailHelp,'The localized provider help is available');
  await act(async()=>{mailHelp.querySelector('summary').focus();mailHelp.querySelector('summary').click();});
  assert(mailHelp.open&&document.activeElement===mailHelp.querySelector('summary'),'Native help opens while retaining summary focus');
  assert(mailHelp.textContent.includes('https://riparim.com/auth/bestaetigen\\?**'),'The copyable allowlist pattern contains exactly one literal backslash before the query delimiter');
  assert(!mailHelp.textContent.includes('https://riparim.com/auth/bestaetigen?**')&&!mailHelp.textContent.includes('https://riparim.com/auth/bestaetigen**'),'Unescaped or broad callback patterns are not offered');
  const providerText=mailHelp.textContent;
  for(const key of ['smtpHelp','authSmtpFreeRule','authOriginRule','authReleaseBackup','authExportHelp','authOriginFailure','authFieldPairHelp','authReadbackHelp','authActivationFailure'])assert(providerText.includes(copy[key]),'Current localized SMTP, origin, backup, export, field-pair, readback and rollback instructions remain reachable');
  assert(providerText.indexOf(copy.smtpHelp)<providerText.indexOf(copy.authFieldPairHelp),'SMTP setup precedes template customization');
  const sources=[['confirmation-subject',confirmationEmailSubject],['confirmation-body',confirmationEmailTemplate],['recovery-subject',recoveryEmailSubject],['recovery-body',recoveryEmailTemplate]];
  for(const [index,[id,source]] of sources.entries()){
   const field=instructions.querySelector('[data-auth-mail-field="'+id+'"]');assert(field&&!field.open,'Each mail field remains separately disclosed');
   assert.equal(field.querySelector('summary').textContent,screen.fields[index],'Each source has an active-locale accessible summary');await click(field.querySelector('summary'));
   const pre=field.querySelector('pre');assert.equal(pre.textContent,source,'Technical subject/body source remains centrally defined and byte-exact');
   assert.equal(pre.tabIndex,0,'Scrollable source is keyboard reachable');pre.focus();assert.equal(document.activeElement,pre,'The source receives keyboard focus');
   assert.equal(field.querySelector('button').getAttribute('aria-label'),copy.copyMailField.replace('{field}',screen.fields[index]),'The copy action names its localized source');
   await click(field.querySelector('button'));assert.equal(copied.at(-1),source,'Copy writes the exact central provider source');
   assert.equal(instructions.querySelector('[role="status"]').textContent,copy.mailFieldCopied.replace('{field}',screen.fields[index]),'Copy success is announced in the active locale');
  }
  const googleHelp=disclosure(screen.googleHelp);assert(googleHelp&&!googleHelp.open,'Google help starts closed');await click(googleHelp.querySelector('summary'));
  assert(googleHelp.textContent.includes('https://riparim.com')&&googleHelp.textContent.includes(copy.authGoogleCredentials),'Current origin, Supabase callback and Google credentials remain reachable');
  assert(instructions.querySelector('a[href="https://supabase.com/docs/guides/auth/auth-smtp"]')&&instructions.querySelector('a[href="https://supabase.com/docs/guides/auth/social-login/auth-google"]'),'Official help links remain reachable');
  assert(instructions.textContent.includes(copy.legacyProofHelp),'Evidence ownership guidance remains localized');
  assert.deepEqual(requests.map(request=>request.method),['GET'],'Opening and copying guidance cannot save provider configuration');
  assert.equal(form().querySelector('h2').textContent,copy.connectProject,'The current connection form remains localized');
  const url=form().querySelector('input[type="url"]'),key=form().querySelector('textarea');
  assert(url.required&&url.closest('label').textContent===copy.projectUrl&&key.required&&key.closest('label').textContent===copy.publishableKey,'Required fields keep current accessible labels');
  assert.deepEqual([...form().querySelectorAll('.auth-preview-links a')].map(node=>[node.textContent,node.getAttribute('href')]),[[copy.previewLogin,prefix+'/anmelden'],[copy.previewRegistration,prefix+'/registrieren'],[copy.previewRecovery,prefix+'/passwort-vergessen']],'All localized customer previews keep their destinations');
  await type(url,'https://fixture.supabase.co');await type(key,'sb_publishable_fixture');await submit();
  assert.deepEqual(requests.at(-1).body,{projectUrl:'https://fixture.supabase.co',publicKey:'sb_publishable_fixture',enabled:false,emailDeliveryConfirmed:false},'Draft submission preserves the four-field provider settings contract');
  assert.equal(form().querySelector('[role="status"]').textContent,copy.authDraftSaved,'Draft success is announced in the active locale');
  await click(form().querySelector('[role="switch"]'));assert.equal(submitButton().textContent,copy.checkActivate);await submit();
  assert(requests.at(-1).body.enabled&&!requests.at(-1).body.emailDeliveryConfirmed,'Activation cannot claim untested SMTP delivery');
  assert.equal(form().querySelector('[role="status"]').textContent,copy.authProvidersActivated,'Unconfirmed SMTP retains current recovery guidance');
  await click(form().querySelector('[role="checkbox"]'));saveMode='pending';await submit();
  assert(submitButton().disabled&&submitButton().textContent.includes(copy.checkingConnection),'Verification disables submission and announces its busy state');
  assert([...form().querySelectorAll('input,textarea,[role="checkbox"],[role="switch"]')].every(control=>control.disabled)&&document.querySelector('.language-switcher select').disabled,'The current busy guard freezes payload fields and language navigation');
  const before=requests.length;await click(submitButton());await submit();assert.equal(requests.length,before,'Disabled clicks and repeated submit events cannot duplicate a pending mutation');
  await act(async()=>pendingSave());saveMode='success';assert(requests.at(-1).body.emailDeliveryConfirmed&&form().querySelector('[role="status"]').textContent===copy.authActivated,'Confirmed SMTP retains current activation success');
  saveMode='failure';await submit();assert.equal(form().querySelector('[role="alert"]').textContent,copy.auth_provider_connection,'Stable provider errors are localized');
  assert(!document.body.textContent.includes('Private raw connection failure')&&!form().querySelector('[role="status"]'),'Raw errors and stale success are not shown');
  config={projectUrl:'https://saved.supabase.co',publicKey:'sb_publishable_saved',enabled:true,emailDeliveryConfirmed:true};loadMode='pending';await remount();
  assert(submitButton().disabled&&form().querySelector('[role="status"]').textContent===copy.configLoading,'Loading retains its localized announcement');
  assert([...form().querySelectorAll('input,textarea,[role="checkbox"],[role="switch"]')].every(control=>control.disabled),'Loading freezes the current form controls');
  await act(async()=>pendingLoad());loadMode='success';assert.equal(form().querySelector('input[type="url"]').value,config.projectUrl);assert.equal(form().querySelector('textarea').value,config.publicKey);
  assert.equal(form().querySelector('[role="switch"]').getAttribute('aria-checked'),'true');assert.equal(form().querySelector('[role="checkbox"]').getAttribute('aria-checked'),'true');assert(!submitButton().disabled,'Saved configuration is reused');
  loadMode='failure';await remount();assert.equal(form().querySelector('[role="alert"]').textContent,copy.auth_config_unavailable,'Load failure codes remain localized');assert(!document.body.textContent.includes('Private raw load failure'));
 }
 console.log('Auth setup UI: DE/SQ/EN compact native guidance, central copy sources, current form/guard/error contracts, previews and saved state passed; no live requests');
}finally{await act(async()=>root.unmount());dom.window.close();}
