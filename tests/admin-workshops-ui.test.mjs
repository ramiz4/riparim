import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {build} from 'esbuild';
import {JSDOM,VirtualConsole} from 'jsdom';

const dom=new JSDOM('<div id="root"></div>',{url:'https://riparim.example.test/verwaltung',pretendToBeVisual:true,virtualConsole:new VirtualConsole()});
for(const key of ['window','document','navigator','HTMLElement','HTMLButtonElement','HTMLFormElement','HTMLInputElement','HTMLSelectElement','HTMLTextAreaElement','DocumentFragment','Element','Node','NodeFilter','MutationObserver','CustomEvent','Event','MouseEvent','KeyboardEvent','getComputedStyle'])Object.defineProperty(globalThis,key,{value:dom.window[key],configurable:true});
globalThis.requestAnimationFrame=dom.window.requestAnimationFrame.bind(dom.window);
globalThis.cancelAnimationFrame=dom.window.cancelAnimationFrame.bind(dom.window);
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
// jsdom has no layout; dialogs still exercise their real keyboard/focus behavior.
globalThis.ResizeObserver=class{observe(){}unobserve(){}disconnect(){}};
const out='.test-runtime/admin-workshops-ui';await mkdir(out,{recursive:true});
const bundle=await build({entryPoints:['app/[locale]/verwaltung/panel.tsx'],outfile:out+'/ui.mjs',bundle:true,write:false,format:'esm',platform:'node',packages:'external'});
await writeFile(out+'/ui.mjs',bundle.outputFiles[0].contents);
const {createElement,act}=await import('react'),{createRoot}=await import('react-dom/client'),{default:AdminPanel}=await import(new URL('../'+out+'/ui.mjs',import.meta.url));
const workshop={id:'fixture-published',name:'Fiktive Werkstatt',city:'Prishtina',address:'Fixture Street 10',phone:'+38344123456',phoneNote:'Betrieb',whatsapp:'',brands:[],services:['Inspektion & Wartung'],serviceDetails:['Inspektion'],languages:[],specialty:'Fahrzeugdiagnose',description:'A sufficiently detailed fictional passenger-car workshop description.',lat:null,lng:null,sources:[],checkedAt:'2026-10-04',status:'published',updatedAt:'2026-10-04T09:00:00Z'};
let records=[workshop,{...workshop,id:'fixture-draft',name:'Entwurfswerkstatt',city:'Peja',status:'draft'}],pendingCount=0,mode='success',resolveLoad;
const requests=[];
globalThis.fetch=async(url,options)=>{
 assert(!options?.method||options.method==='GET','This view-only fixture never mutates workshop or moderation data');requests.push(url);
 if(url==='/api/workshops?admin=1'){if(mode==='loading')return new Promise(resolve=>{resolveLoad=()=>resolve(Response.json({workshops:records}));});if(mode==='error')return Response.json({error:'Fixture directory unavailable'},{status:503});return Response.json({workshops:records});}
 if(url==='/api/visits?moderation=1')return Response.json({pendingCount});
 if(url==='/api/notifications')return Response.json({notifications:[],nextCursor:null,configured:true});
 throw Error('Unexpected fixture request: '+url);
};
let root=createRoot(document.getElementById('root'));
const render=async()=>act(async()=>root.render(createElement(AdminPanel,{account:{email:'admin@example.test',displayName:'Fixture admin',provider:'Google'}})));
const button=label=>[...document.querySelectorAll('button')].find(node=>node.textContent===label);
const click=async node=>{assert(node,'Expected UI action exists');await act(async()=>{node.focus();node.click();});};
const type=async(node,value)=>act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(node,value);node.dispatchEvent(new Event('input',{bubbles:true}));});
const remount=async()=>{await act(async()=>root.unmount());root=createRoot(document.getElementById('root'));await render();};
try{
 for(pendingCount of [0,7]){
  await remount();
  const main=document.querySelector('main'),tools=main.querySelector('.admin-tools'),overview=main.querySelector('.admin-overview');
  assert.equal(tools.querySelectorAll('a,button').length,0,'The search toolbar contains no duplicate destinations or manual refresh action');
  assert(!overview.textContent.includes('Bewertungen zur Prüfung'),'The moderation tile is absent for both empty and nonempty queues');
  assert.equal(overview.children.length,2,'Only published and draft metrics occupy the overview');
  assert.equal(main.querySelector('h1').textContent,'Werkstätten verwalten');
  assert.equal(main.querySelector('.admin-title').textContent,'Werkstätten verwaltenWerkstatt hinzufügen','The title area has only the heading and add action');
  assert.equal(main.querySelector('.admin-note'),null,'The obsolete note below the table is absent');
  const navigation=document.querySelector('nav[aria-label="Verwaltung"]');
  for(const [label,path] of [['Bewertungen prüfen','/verwaltung/bewertungen'],['Login & Registrierung','/verwaltung/anmeldung']]){
   const link=[...navigation.querySelectorAll('a')].find(node=>node.textContent===label);
   assert.equal(link?.getAttribute('href'),path,'The corresponding upper navigation destination stays available');
  }
 }
 assert.deepEqual([...document.querySelectorAll('.admin-overview>div')].map(node=>node.textContent),['1Veröffentlichte Standorte','1Entwürfe'],'Both original publication metrics remain correct');
 const search=document.querySelector('input[aria-label="Werkstattverwaltung durchsuchen"]');
 const names=()=>[...document.querySelectorAll('tbody tr td:first-child strong')].map(node=>node.textContent);
 await type(search,'pEjA');assert.deepEqual(names(),['Entwurfswerkstatt'],'Search still filters names and cities regardless of case');
 await type(search,'no matching fixture');assert(document.querySelector('.empty').textContent.includes('Keine Werkstätten gefunden.'),'Search exposes the empty state');
 await type(search,'');assert.deepEqual(names(),['Fiktive Werkstatt','Entwurfswerkstatt']);
 await click(button('Bearbeiten'));
 let dialog=document.querySelector('[role="dialog"]');assert(dialog?.contains(document.activeElement),'Editing opens the real dialog and takes focus');
 assert.equal(dialog.querySelector('input').value,'Fiktive Werkstatt','The editor retains the selected row');
 await click(button('Abbrechen'));assert.equal(document.querySelector('[role="dialog"]'),null);
 await remount();await click(button('Werkstatt hinzufügen'));dialog=document.querySelector('[role="dialog"]');
 assert(dialog?.textContent.includes('Entwurf speichern'),'The add action retains its draft editor');
 await act(async()=>document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true})));
 assert.equal(document.querySelector('[role="dialog"]'),null,'Escape still dismisses the workshop editor');
 await assertTableStyles();
 mode='loading';await remount();assert(document.querySelector('main [role="status"]').textContent.includes('Werkstätten werden geladen'),'Loading remains announced');
 assert.equal(document.querySelector('.empty'),null,'Loading does not display a misleading empty state');
 await act(async()=>resolveLoad());assert.deepEqual(names(),['Fiktive Werkstatt','Entwurfswerkstatt']);
 mode='error';await remount();assert.equal(document.querySelector('main [role="alert"]').textContent,'Fixture directory unavailable','Load failures remain accessible');
 assert.equal(document.querySelector('.empty'),null,'A failed load is not described as an empty directory');
 mode='success';records=[];await remount();assert(document.querySelector('.empty').textContent.includes('Keine Werkstätten gefunden.'),'An empty directory retains its add action');
 assert.equal(document.querySelector('.empty button').textContent,'Werkstatt hinzufügen');
 console.log('Workshop administration: toolbar, two metrics, navigation, search, editors, load states and scoped light/dark styles passed');
}finally{await act(async()=>root.unmount());dom.window.close();}

async function assertTableStyles(){
 const files=['globals.css','ui-refresh.css','auth.css','catalogue.css','workshop-pages.css','ratings.css','form-controls.css','theme.css'];
 const css=(await Promise.all(files.map(file=>readFile(new URL('../app/'+file,import.meta.url),'utf8')))).join('\n').replace(/^@(?:import|custom-variant).*;$/gm,'').replace(/@theme inline\{[^}]*\}/g,'');
 const table=document.querySelector('.directory-table');
 // The same table outside this page is a control for shared administration views.
 const control=table.cloneNode(true);control.className='directory-table users-table';document.body.append(control);
 const style=document.createElement('style');document.head.append(style);
 function luminance(color){const rgb=color.match(/\d+(?:\.\d+)?/g).slice(0,3).map(Number).map(value=>{value/=255;return value<=.04045?value/12.92:((value+.055)/1.055)**2.4;});return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;}
 function contrast(first,second){const a=luminance(first),b=luminance(second);return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);}
 try{
  for(const dark of [false,true]){
   const tokens={};
   for(const [,selector,declarations] of css.matchAll(/(:root|html\.dark)\s*\{([^}]+)\}/g)){
    if(selector==='html.dark'&&!dark)continue;
    for(const [,name,value] of declarations.matchAll(/(--[\w-]+):\s*([^;]+)/g))tokens[name]=value.trim();
   }
   document.documentElement.classList.toggle('dark',dark);
   // jsdom does not resolve CSS variables itself; use the actual theme values.
   style.textContent=css.replace(/var\((--[\w-]+)\)/g,(match,name)=>tokens[name]??match);
   const target=getComputedStyle(table),shared=getComputedStyle(control);
   assert(contrast(target.borderBottomColor,target.backgroundColor)<contrast(shared.borderBottomColor,shared.backgroundColor),'Workshop table borders are subtler than the unchanged shared table in '+(dark?'dark':'light')+' mode');
   for(const row of table.querySelectorAll('[data-slot="table-row"]'))assert.equal(getComputedStyle(row).borderBottomColor,target.borderBottomColor,'Header and body separators use the scoped subtle border');
   assert.notEqual(getComputedStyle(table.querySelector('th')).backgroundColor,target.backgroundColor,'The header keeps a distinct surface');
   assert.equal(getComputedStyle(document.querySelector('.admin-overview')).gridTemplateColumns,'repeat(2, minmax(0, 1fr))','Two metrics fill the desktop grid without an empty third column');
   assert.equal(getComputedStyle(document.querySelector('.admin-title h1')).marginTop,'0px','The simplified title leaves no eyebrow spacing');
  }
 }finally{control.remove();style.remove();document.documentElement.classList.remove('dark');}
}
