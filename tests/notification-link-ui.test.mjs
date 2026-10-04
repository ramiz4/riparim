import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {JSDOM,VirtualConsole} from 'jsdom';
const id='00000000-0000-4000-8000-000000000001',other='00000000-0000-4000-8000-000000000002';
const dom=new JSDOM('<div id="root"></div>',{url:'https://riparim.example.test/?besuche=1&einreichung='+id,pretendToBeVisual:true,virtualConsole:new VirtualConsole()});
for(const key of ['window','document','navigator','HTMLElement','HTMLButtonElement','HTMLFormElement','HTMLInputElement','HTMLSelectElement','HTMLTextAreaElement','Option','DocumentFragment','Element','Node','NodeFilter','MutationObserver','CustomEvent','Event','MouseEvent','KeyboardEvent','getComputedStyle'])Object.defineProperty(globalThis,key,{value:dom.window[key],configurable:true});
globalThis.requestAnimationFrame=dom.window.requestAnimationFrame.bind(dom.window);globalThis.cancelAnimationFrame=dom.window.cancelAnimationFrame.bind(dom.window);globalThis.IS_REACT_ACT_ENVIRONMENT=true;globalThis.ResizeObserver=class{observe(){}unobserve(){}disconnect(){}};
const {build}=createRequire(new URL('../package.json',import.meta.url))('esbuild'),out='.test-runtime/notification-link-ui';await mkdir(out,{recursive:true});
const bundle=await build({entryPoints:['app/journeys.tsx'],outfile:out+'/ui.mjs',bundle:true,write:false,format:'esm',platform:'node',packages:'external',plugins:[{name:'navigation-boundary',setup(b){b.onResolve({filter:/^next\/link$/},()=>({path:'link',namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},()=>({loader:'js',resolveDir:process.cwd(),contents:"import React from 'react';export default function Link({href,children,...props}){return React.createElement('a',{...props,href},children)}"}));}}]});await writeFile(out+'/ui.mjs',bundle.outputFiles[0].contents);
const {createElement,act}=await import('react'),{createRoot}=await import('react-dom/client'),{MyVisits}=await import(new URL('../'+out+'/ui.mjs',import.meta.url));
const visit=id=>({id,workshop:'fixture-workshop',workshop_name:'Fiktive Werkstatt',date:'2026-10-04',vehicle:'Fixture Car',service:'Repair',evidence_type:'document',evidence_note:'Private fictional evidence',status:'needs_more',moderator_note:'Private fictional request for another proof.',display_name:'Fixture Driver',rating:4,review:'A sufficiently detailed fictional repair review.',created_at:'2026-10-04',file_name:null,revision:1});
let mode='member';const requests=[];
globalThis.fetch=async(url,options)=>{assert(!options?.method||options.method==='GET','Deep-link fixtures never mutate submissions');requests.push(url);const target=new URL(url,'https://riparim.example.test').searchParams.get('id');if(mode==='foreign'&&target)return Response.json({error:'Diese Einreichung gehört nicht zu deinem Konto.'},{status:404});return Response.json({visits:target?[visit(target)]:[visit(id),visit(other)],nextCursor:null});};
let root=createRoot(document.getElementById('root')),passed=0;const check=(value,label)=>{assert(value,label);passed++;};
const render=async()=>act(async()=>root.render(createElement(MyVisits,{open:true,onClose(){},directory:[{id:'fixture-workshop'}],signedIn:true,account:{email:mode==='member'?'fixture@example.test':'other@example.test',displayName:'Fixture',provider:'E-Mail'},onResubmit(){}})));
const button=label=>[...document.querySelectorAll('button')].find(node=>node.textContent===label);
try{
 await render();check(requests[0]==='/api/visits?id='+id&&document.querySelectorAll('.visit').length===1,'The authenticated return opens the exact owned submission instead of an unrelated history page');
 check(document.querySelector('.visit-status').textContent==='Ergänzung nötig'&&button('Ergänzen'),'The owner can act on the requested proof supplement');
 await act(async()=>button('Alle meine Bewertungen anzeigen').click());check(requests.at(-1)==='/api/visits'&&document.querySelectorAll('.visit').length===2,'The targeted view can return to the complete owned history');
 await act(async()=>root.unmount());mode='foreign';root=createRoot(document.getElementById('root'));await render();
 check(document.querySelectorAll('.visit').length===0&&document.querySelector('[role="alert"]').textContent.includes('nicht zu deinem Konto'),'A different login sees no private submission behind a copied notification link');
 check(button('Alle meine Bewertungen anzeigen'),'A foreign/deleted target still allows safe recovery to the current account’s own history');
 console.log(JSON.stringify({notificationLinkUiChecksPassed:passed,realEmailsSent:false}));
}finally{await act(async()=>root.unmount());dom.window.close();}
