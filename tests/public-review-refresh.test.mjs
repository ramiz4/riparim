import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdir} from 'node:fs/promises';
import {JSDOM,VirtualConsole} from 'jsdom';
const dom=new JSDOM('<div id="root"></div>',{url:'https://riparim.test/werkstatt/fixture-profile',pretendToBeVisual:true,virtualConsole:new VirtualConsole()});
for(const key of ['window','document','navigator','HTMLElement','HTMLFormElement','HTMLButtonElement','HTMLInputElement','HTMLSelectElement','DocumentFragment','Element','Node','NodeFilter','MutationObserver','CustomEvent','Event','MouseEvent','KeyboardEvent','getComputedStyle'])Object.defineProperty(globalThis,key,{value:dom.window[key],configurable:true});
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
globalThis.requestAnimationFrame=dom.window.requestAnimationFrame.bind(dom.window);globalThis.cancelAnimationFrame=dom.window.cancelAnimationFrame.bind(dom.window);
globalThis.IntersectionObserver=class{observe(){}disconnect(){}};globalThis.ResizeObserver=class{observe(){}disconnect(){}};
window.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});
const directory=[{id:'fixture-profile',name:'Fixture profile',city:'Prishtina',address:'Fixture street',phone:'+38349123456',phoneNote:'',whatsapp:'',brands:[],services:['Karosserie & Lack'],serviceDetails:['Fixture detailing'],languages:[],specialty:'Fixture detailing',description:'Independent fixture description',sources:[],checkedAt:'2026-10-10',updatedAt:'2026-10-10T00:00:00Z',status:'published',lat:null,lng:null,rating:null,count:0,googleRating:null}];
let reviews=[],loads=0,sessionRequests=0,finishSession;
const nativeFetch=globalThis.fetch;
globalThis.fetch=async url=>{
 if(String(url).startsWith('/api/reviews?')){loads++;return Response.json({reviews});}
 if(String(url).startsWith('/api/workshops?'))return Response.json({workshops:directory,displayById:{}});
 if(url==='/api/session'){sessionRequests++;return new Promise(resolve=>{finishSession=resolve;});}
 return Response.json({enabled:false});
};
await mkdir('.test-runtime/public-review-refresh',{recursive:true});
await build({stdin:{contents:"export {default as Profile} from './app/[locale]/werkstatt/[id]/profile';export {I18nProvider} from './lib/i18n/client';export {getMessages} from './lib/i18n/messages';export {rememberSearchSession,readSearchSession} from './lib/search-session';export {invalidatePublicSession} from './components/use-public-session';",resolveDir:process.cwd(),loader:'tsx'},outfile:'.test-runtime/public-review-refresh/ui.mjs',bundle:true,platform:'node',format:'esm',packages:'external',plugins:[{name:'review-completion-boundary',setup(b){
 b.onResolve({filter:/^@\/components\/review-form$/},()=>({path:'form',namespace:'fixture'}));
 b.onResolve({filter:/^next\/link$/},()=>({path:'link',namespace:'fixture'}));
 b.onResolve({filter:/^next\/navigation$/},()=>({path:'navigation',namespace:'fixture'}));
 b.onLoad({filter:/.*/,namespace:'fixture'},a=>({loader:'js',resolveDir:process.cwd(),contents:a.path==='link'?"import {createElement} from 'react';export default function Link({href,children,...props}){return createElement('a',{...props,href},children);}":a.path==='form'?"export function ReviewForm(props){globalThis.completePublicReview=props.onSubmitted;return null;}":"export function useRouter(){return {refresh(){globalThis.dynamicRefreshes=(globalThis.dynamicRefreshes??0)+1;}};}export function usePathname(){return '/werkstatt/fixture-profile';}"}));
}}]});
const api=await import(new URL('../.test-runtime/public-review-refresh/ui.mjs',import.meta.url));
const {createElement:h,act}=await import('react'),{createRoot}=await import('react-dom/client');
const root=createRoot(document.getElementById('root'));
try{
 const session={catalogueHref:'/werkstaetten',visibleCount:24,scrollY:300};api.rememberSearchSession(session);
 window.history.replaceState({},'','/werkstatt/fixture-profile#bewerten');
 await act(async()=>root.render(h(api.I18nProvider,{locale:'de',messages:api.getMessages('de',['common','public','customer'])},h(api.Profile,{publicSnapshot:true,workshop:directory[0],directory,reviews:[],reviewError:'',signedIn:false,account:null,isAdmin:false}))));
 assert.equal(!!document.querySelector('.header-auth'),false,'A loaded workshop profile does not replace the pending header with guest buttons');
 assert.equal(sessionRequests,1,'Profile and header share the initial session request');
 await act(async()=>finishSession(new Response(null,{status:503})));
 assert.equal(!!document.querySelector('.header-auth'),false,'A failed session check is not a confirmed guest on a workshop profile');
 await act(async()=>api.invalidatePublicSession());
 assert.equal(sessionRequests,2,'A profile retry shares one fresh session request');
 await act(async()=>finishSession(Response.json({account:null,isAdmin:false})));
 assert(document.querySelector('.header-auth'),'Only a confirmed guest receives sign-in links');
 assert.equal(typeof globalThis.completePublicReview,'function');
 const before=loads;
 reviews=[{display_name:'Public fixture',vehicle:'Fixture car',service:'Fixture detailing',date:'2026-10-10',rating:5,review:'Fresh approved review'}];
 await act(async()=>globalThis.completePublicReview());
 assert(loads>before,'Successful submission refreshes the live public review data');
 assert(document.querySelector('.public-review-text').textContent.includes('Fresh approved review'));
 assert.equal(api.readSearchSession(),session,'Public review refresh preserves the catalogue paging and scroll');
 assert.equal(globalThis.dynamicRefreshes,undefined,'Snapshot refresh uses the live API instead of a document/RSC refresh');
 console.log('Public review completion refreshes approved data and preserves catalogue paging and scroll');
}finally{await act(async()=>root.unmount());globalThis.fetch=nativeFetch;dom.window.close();delete globalThis.completePublicReview;}
