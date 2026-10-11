import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdir,writeFile} from 'node:fs/promises';
import {JSDOM,VirtualConsole} from 'jsdom';
const dom=new JSDOM('<div id="root"></div>',{url:'https://riparim.example.test/betrieb/beanspruchen?werkstatt=fixture-workshop',pretendToBeVisual:true,virtualConsole:new VirtualConsole()});
for(const key of ['window','document','navigator','HTMLElement','HTMLFormElement','HTMLInputElement','HTMLTextAreaElement','Node','Event','getComputedStyle'])Object.defineProperty(globalThis,key,{value:dom.window[key],configurable:true});
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const out='.test-runtime/business-claim-ui';await mkdir(out,{recursive:true});
const result=await build({stdin:{contents:"export {BusinessClaimForm} from './components/business-claim-form';export {I18nProvider} from './lib/i18n/client';export {getMessages} from './lib/i18n/messages';",resolveDir:process.cwd(),loader:'tsx'},outfile:out+'/ui.mjs',bundle:true,write:false,format:'esm',platform:'node',packages:'external'});await writeFile(out+'/ui.mjs',result.outputFiles[0].contents);
const {createElement,act}=await import('react'),{createRoot}=await import('react-dom/client'),{BusinessClaimForm,I18nProvider,getMessages}=await import(new URL('../'+out+'/ui.mjs',import.meta.url));
const workshop={id:'fixture-workshop',name:'Fiktive Werkstatt',city:'Prizren',address:'Teststraße 10'};
let root=createRoot(document.getElementById('root')),mode='failure',finish,passed=0;const requests=[];
globalThis.fetch=async(url,init)=>{
 assert.equal(url,'/api/business');assert.equal(init.method,'POST');assert(init.body instanceof FormData);requests.push(init.body);
 if(mode==='pending')return new Promise(resolve=>finish=resolve);
 if(mode==='network')throw Error('Fixture network unavailable');
 return Response.json(mode==='success'?{status:'pending'}:{errorCode:mode==='auth'?'authentication_required':'business_claim_unavailable'},{status:mode==='success'?201:mode==='auth'?401:409});
};
const check=(value,label)=>{assert(value,label);passed++;};
async function render(locale,selected=workshop){await act(async()=>root.unmount());root=createRoot(document.getElementById('root'));await act(async()=>root.render(createElement(I18nProvider,{locale,messages:getMessages(locale,['common','management','customer'])},createElement(BusinessClaimForm,{workshop:selected}))));}
async function type(node,value){await act(async()=>{Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(node,value);node.dispatchEvent(new Event('input',{bubbles:true}));});}
async function submit(form){await act(async()=>form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));}
try{
 for(const locale of ['de','sq','en']){
  await render(locale);const messages=getMessages(locale).management,prefix=locale==='de'?'':'/'+locale;
  check(document.querySelector('h1').textContent===messages.claimProfile&&document.querySelector('h2').textContent===workshop.name,'The claim page has its own localized title and fixed workshop');
  check(!document.querySelector('select')&&document.querySelectorAll('textarea').length===1&&!document.querySelector('.business-request'),'The application contains one text field and no overview or workshop selector');
  check(document.querySelector('a[href="'+prefix+'/werkstatt/'+workshop.id+'"]')&&document.querySelector('a[href="'+prefix+'/betrieb"]'),'The claim offers document navigation back to profile and overview');
  const proof=document.querySelector('textarea'),upload=document.querySelector('input[type=file]');
  check(proof.required&&proof.minLength===40&&proof.maxLength===4000&&document.querySelector('label[for="'+upload.id+'"]')&&document.getElementById(upload.getAttribute('aria-describedby')).textContent===messages.ownershipDocumentHelp,'Text and document fields retain their labelled bounded contract');
  await type(proof,'A sufficiently detailed fictional registered operator ownership explanation.');
  const file=new File(['%PDF-1.7 fictional evidence'],'fixture.pdf',{type:'application/pdf'});
  await act(async()=>{Object.defineProperty(upload,'files',{value:[file],configurable:true});upload.dispatchEvent(new Event('change',{bubbles:true}));});
  mode='failure';await submit(proof.form);check(document.querySelector('[role=alert]').textContent===messages.business_claim_unavailable&&proof.value.includes('ownership'),'Rejected claims retain evidence and show a localized error');
  check(requests.at(-1).get('workshopId')===workshop.id&&requests.at(-1).get('file').name==='fixture.pdf'&&[...requests.at(-1).keys()].join('|')==='workshopId|evidence|file','A claim sends only the fixed workshop, text and private document');
  mode='pending';const form=proof.form;await submit(form);check(form.querySelector('fieldset').disabled&&document.querySelector('.business-panel').getAttribute('aria-busy')==='true','Pending submission announces busy and freezes the fields');
  const count=requests.length;await submit(form);check(requests.length===count,'Pending submissions cannot be duplicated');
  await act(async()=>finish(Response.json({status:'pending'},{status:201})));
  check(!document.querySelector('form')&&document.querySelector('[role=status]').textContent===messages.claimSubmitted&&document.querySelector('a[href="'+prefix+'/betrieb"]'),'Successful claims replace the form with confirmation and a link to the separate overview');
  await submit(form);check(requests.length===count,'A saved application cannot be resubmitted from a stale form');
 }
 for(const modeValue of ['auth','network']){await render('de');mode=modeValue;await type(document.querySelector('textarea'),'A fictional ownership description with enough detail for this isolated test.');await submit(document.querySelector('form'));check(document.querySelector('[role=alert]')&&document.querySelector('textarea').value.includes('fictional'),'Expired sessions and network failures preserve the private draft');}
 await render('de',null);check(!document.querySelector('form')&&document.querySelector('a[href="/werkstaetten"]'),'A missing public workshop provides the finder instead of guessing another profile');
 console.log(JSON.stringify({businessClaimUiChecksPassed:passed,liveRequests:false}));
}finally{await act(async()=>root.unmount());dom.window.close();}
