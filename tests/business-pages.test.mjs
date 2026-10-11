import {localizeHref} from '../scripts/lib/locale.mjs';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdir,writeFile} from 'node:fs/promises';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {JSDOM} from 'jsdom';
const out='.test-runtime/business-pages';await mkdir(out,{recursive:true});
const result=await build({stdin:{contents:"export {default as BusinessPage} from './app/[locale]/betrieb/page';export {default as ClaimPage,generateMetadata} from './app/[locale]/betrieb/beanspruchen/page';export {I18nProvider} from './lib/i18n/client';export {getMessages} from './lib/i18n/messages';export {isPagePath} from './lib/i18n/locale';",resolveDir:process.cwd(),loader:'tsx'},outfile:out+'/server.mjs',bundle:true,write:false,format:'esm',platform:'node',packages:'external',loader:{'.css':'empty'},plugins:[{name:'page-fixtures',setup(builder){
 builder.onResolve({filter:/^(next\/(navigation|link)|@\/app\/auth|@\/db\/directory)$/},args=>({path:args.path,namespace:'fixture'}));
 builder.onLoad({filter:/.*/,namespace:'fixture'},args=>({loader:'js',resolveDir:process.cwd(),contents:args.path==='@/app/auth'?'export async function getAppUser(){return globalThis.fixtureAccount;}export async function getAdminUser(){return null;}':args.path==='@/db/directory'?'export async function listWorkshops(){globalThis.catalogueReads++;if(globalThis.directoryFailure)throw Error("fixture catalogue unavailable");return globalThis.fixtureWorkshops.filter(workshop=>workshop.status==="published");}':args.path==='next/navigation'?'export function useRouter(){return {refresh(){},push(){}}}export function useSearchParams(){return new URLSearchParams()}export function usePathname(){return "/"}':'import React from "react";export default function Link({href,children,...props}){return React.createElement("a",{href,...props},children)}'}));
 }}]});await writeFile(out+'/server.mjs',result.outputFiles[0].contents);
const {BusinessPage,ClaimPage,generateMetadata,I18nProvider,getMessages,isPagePath}=await import(new URL('../'+out+'/server.mjs',import.meta.url));
globalThis.fixtureWorkshops=[{id:'fixture-workshop',name:'Fiktive Werkstatt',city:'Prizren',address:'Teststraße 10',status:'published'},{id:'other-workshop',name:'Another public workshop',status:'published'},{id:'draft-workshop',name:'Private draft workshop',status:'draft'}];
globalThis.catalogueReads=0;globalThis.directoryFailure=false;let passed=0;
const check=(value,label)=>{assert(value,label);passed++;};
const props=(locale,query={})=>({params:Promise.resolve({locale}),searchParams:Promise.resolve(query)});
function documentOf(locale,page){return new JSDOM(renderToStaticMarkup(createElement(I18nProvider,{locale,messages:getMessages(locale,['common'])},page))).window.document;}
for(const locale of ['de','sq','en']){
 check(isPagePath(localizeHref('/betrieb',locale))&&isPagePath(localizeHref('/betrieb/beanspruchen',locale)),'Both independent pages pass the locale route boundary');
 const metadata=await generateMetadata(props(locale));check(metadata.title===getMessages(locale).management.claimProfile+' · Riparim'&&metadata.robots.index===false&&metadata.robots.follow===false&&metadata.alternates===null,'Claim metadata has a distinct private localized title');
 for(const account of [null,{userId:'fixture-owner',displayName:'Fixture Member',email:'fixture@example.test',provider:'E-Mail'}]){
  globalThis.fixtureAccount=account;
  for(const query of [{werkstatt:'fixture-workshop'},{werkstatt:['fixture-workshop','other-workshop']},{werkstatt:'unknown'}]){
   const overview=documentOf(locale,await BusinessPage(props(locale,query)));
   check(overview.querySelector('main h1').textContent===getMessages(locale).management.myBusiness&&!overview.querySelector('main form'),'Workshop query parameters do not turn the business overview into a claim entry');
   if(!account)check(overview.querySelector('main a').getAttribute('href')===localizeHref('/anmelden?weiter=',locale)+encodeURIComponent(localizeHref('/betrieb',locale)),'Overview login never preserves workshop query parameters');
  }
  let document=documentOf(locale,await BusinessPage(props(locale)));check(document.querySelector('main h1').textContent===getMessages(locale).management.myBusiness&&!document.querySelector('main form'),'The overview is its own document and never renders a claim form');
  if(!account){const before=globalThis.catalogueReads;document=documentOf(locale,await ClaimPage(props(locale,{werkstatt:'fixture-workshop'})));check(document.querySelector('main h1').textContent===getMessages(locale).management.claimTitle&&!document.querySelector('form')&&globalThis.catalogueReads===before,'The guest claim has its own title and reads no account or catalogue details');check(document.querySelector('main a').getAttribute('href')===localizeHref('/anmelden?weiter=',locale)+encodeURIComponent(localizeHref('/betrieb/beanspruchen?werkstatt=fixture-workshop',locale)),'Login preserves the exact claim page, workshop and locale');}
  else{
   document=documentOf(locale,await ClaimPage(props(locale,{werkstatt:'fixture-workshop'})));check(document.querySelector('main h1').textContent===getMessages(locale).management.claimTitle&&document.querySelector('main h2').textContent==='Fiktive Werkstatt'&&document.querySelector('form'),'Authenticated claim documents render the fixed selected workshop and form');check(!document.body.textContent.includes('Another public workshop')&&!document.querySelector('.business-request'),'The claim contains no alternate workshop or business overview');
   for(const target of [undefined,'unknown','draft-workshop',['fixture-workshop','other-workshop']]){document=documentOf(locale,await ClaimPage(props(locale,{werkstatt:target})));check(!document.querySelector('form')&&!document.body.textContent.includes('Private draft workshop')&&document.querySelector('main a[href="'+localizeHref('/werkstaetten',locale)+'"]'),'Missing, unpublished and ambiguous targets never expose or select another workshop');}
   globalThis.directoryFailure=true;document=documentOf(locale,await ClaimPage(props(locale,{werkstatt:'fixture-workshop'})));check(document.querySelector('[role=alert]')&&!document.querySelector('form')&&document.querySelector('main a').getAttribute('href')===localizeHref('/betrieb/beanspruchen?werkstatt=fixture-workshop',locale),'Catalogue failure offers a retry preserving the selected claim target');globalThis.directoryFailure=false;
  }
 }
}
console.log(JSON.stringify({independentBusinessPageChecksPassed:passed,liveRequests:false}));
