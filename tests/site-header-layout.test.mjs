import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {JSDOM} from 'jsdom';

const {build}=createRequire(new URL('../package.json',import.meta.url))('esbuild');
const output='.test-runtime/site-header-layout';
await build({stdin:{contents:`
 export {default as Finder} from './app/finder';
 export {default as Catalogue} from './app/[locale]/werkstaetten/catalogue';
 export {default as AdminPanel} from './app/[locale]/verwaltung/panel';
 export {default as AuthForm} from './app/auth-form';
 export {default as PrivacyPage} from './app/[locale]/datenschutz/page';
 export {default as BusinessPage} from './app/[locale]/betrieb/page';
 export {defaultCatalogueFilters} from './lib/catalogue-filters';`,resolveDir:process.cwd(),loader:'tsx'},bundle:true,platform:'node',format:'esm',outfile:output+'/pages.mjs',packages:'external',loader:{'.css':'empty'},plugins:[{name:'page-boundaries',setup(b){
 b.onResolve({filter:/^(next\/(link|navigation)|@\/app\/auth|@\/db\/directory)$/},args=>({path:args.path,namespace:'fixture'}));
 b.onLoad({filter:/.*/,namespace:'fixture'},args=>({loader:'js',resolveDir:process.cwd(),contents:args.path==='next/link'?`import {createElement} from 'react';export default function Link({href,children}){return createElement('a',{href},children);}`:args.path==='next/navigation'?`export function useRouter(){return {push(){},replace(){},refresh(){}};}export function useSearchParams(){return new URLSearchParams();}export function usePathname(){return '/';}`:args.path==='@/app/auth'?`export async function getAppUser(){return globalThis.headerAccount;}export async function getAdminUser(){return globalThis.headerIsAdmin?{isModerator:true}:null;}`:`export async function listWorkshops(){return [];}`}));
}}]});
const {Finder,Catalogue,AdminPanel,AuthForm,PrivacyPage,BusinessPage,defaultCatalogueFilters}=await import(new URL('../'+output+'/pages.mjs',import.meta.url));
let checks=0;

for(const account of [null,{email:'customer@example.test',displayName:'Fixture account',provider:'Google'}]){
 for(const isAdmin of account?[false,true]:[false]){
  globalThis.headerAccount=account;globalThis.headerIsAdmin=isAdmin;
  const props={account,isAdmin,signedIn:!!account,initialWorkshops:[],initialError:'',initialFilters:defaultCatalogueFilters};
  const pages=[['landing',createElement(Finder,props)],['catalogue',createElement(Catalogue,props)],['login',createElement(AuthForm,{...props,isOwner:isAdmin,screen:'login',emailReady:false,googleReady:false,returnTo:'/'})],['privacy',await PrivacyPage()],['business',await BusinessPage({params:Promise.resolve({locale:'de'}),searchParams:Promise.resolve({})})]];
  if(isAdmin)pages.push(['admin',createElement(AdminPanel,props)]);
  let reference;
  for(const [page,element] of pages){
   const dom=new JSDOM(renderToStaticMarkup(element));
   try{
    const header=dom.window.document.querySelector('header');
    assert(header,`${page} has a site header`);
    const wrapper=header.parentElement;
    // Ignore generated Radix IDs; compare the visible header and its wrapper.
    for(const node of header.querySelectorAll('[id]'))node.removeAttribute('id');
    for(const node of header.querySelectorAll('[for]'))node.removeAttribute('for');
    const signature=JSON.stringify({wrapper:wrapper.className,header:header.outerHTML});
    if(reference)assert(signature===reference,`${page} must present the same header as the landing page for this account`);
    else reference=signature;
    assert.equal(header.querySelector('[aria-label="Riparim Startseite"]').getAttribute('href'),'/',`${page} logo targets the root`);
    checks++;
   }finally{dom.window.close();}
  }
 }
}

console.log(JSON.stringify({sharedHeaderChecksPassed:checks,roles:['guest','customer','admin'],liveRequests:false}));
