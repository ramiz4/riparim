import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdir,writeFile} from 'node:fs/promises';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
const out='.test-runtime/review-entry.mjs';
const bundle=await build({stdin:{contents:`export {default as Home} from './app/[locale]/page';export {default as Catalogue} from './app/[locale]/werkstaetten/catalogue';export {I18nProvider} from './lib/i18n/client';export {getMessages} from './lib/i18n/messages';export {defaultCatalogueFilters} from './lib/catalogue-filters';`,resolveDir:process.cwd(),loader:'tsx'},outfile:out,bundle:true,write:false,format:'esm',platform:'node',packages:'external',loader:{'.css':'empty','.module.css':'empty'},plugins:[{name:'route-boundaries',setup(b){
 b.onResolve({filter:/^next\/(navigation|link)$/},a=>({path:a.path,namespace:'next-fixture'}));b.onLoad({filter:/.*/,namespace:'next-fixture'},a=>({loader:'js',contents:a.path==='next/link'?`export default function Link(){return null;}`:`export function redirect(href){throw Object.assign(new Error('redirect'),{href});}export function useRouter(){return {};}export function usePathname(){return '/';}export function useSearchParams(){return new URLSearchParams();}`}));
 b.onResolve({filter:/^@\/(app\/auth|db\/directory|lib\/auth\/config|lib\/workshop-display.server)$/},a=>({path:a.path,namespace:'server-fixture'}));b.onLoad({filter:/.*/,namespace:'server-fixture'},a=>({loader:'js',contents:a.path.endsWith('/auth')?`export async function getAppUser(){return null;}export async function getAdminUser(){return null;}`:a.path.endsWith('/directory')?`export async function listWorkshops(){if(globalThis.directoryUnavailable)throw Error('fixture outage');return [{id:'fixture-workshop',status:'published'}];}`:a.path.endsWith('/config')?`export function siteOrigin(){return 'https://riparim.test';}`:`export async function workshopDisplayById(){return {};}`}));
}}]});await mkdir('.test-runtime',{recursive:true});await writeFile(out,bundle.outputFiles[0].text);
const {Home,Catalogue,I18nProvider,getMessages,defaultCatalogueFilters}=await import(new URL('../'+out,import.meta.url));
async function target(locale,query){try{await Home({params:Promise.resolve({locale}),searchParams:Promise.resolve(query)});return null;}catch(error){if(error.href)return error.href;throw error;}}
for(const locale of ['de','sq','en']){
 const prefix=locale==='de'?'':`/${locale}`;
 assert.equal(await target(locale,{nachweis:'fixture-workshop'}),prefix+'/werkstatt/fixture-workshop#bewerten','old workshop review links reach the matching public profile');
 for(const value of ['neu','unknown-workshop','//outside.test','', ['fixture-workshop','neu']])assert.equal(await target(locale,{nachweis:value}),prefix+'/werkstaetten?bewerten=1','generic, missing, malformed and ambiguous old links reach workshop selection');
 globalThis.directoryUnavailable=true;
 const originalError=console.error;console.error=()=>{};
 try{assert.equal(await target(locale,{nachweis:'fixture-workshop'}),prefix+'/werkstaetten?bewerten=1','an unavailable catalogue leads to the finder retry flow');}finally{globalThis.directoryUnavailable=false;console.error=originalError;}
 const ownSubmission='11111111-1111-4111-8111-111111111111';
 assert.equal(await target(locale,{besuche:'1',einreichung:ownSubmission,nachweis:'fixture-workshop'}),prefix+'/bewertungen?einreichung='+ownSubmission,'Legacy own-submission links retain their private target when a public review entry is also present');
 assert.equal(await target(locale,{besuche:'1',einreichung:[ownSubmission,'ambiguous'],nachweis:'fixture-workshop'}),prefix+'/bewertungen','Mixed old links cannot turn an ambiguous private submission into a public review draft');
 assert.equal(await target(locale,{}),null,'normal landing remains available');
}
console.log('Review entry routes: localized public profiles, safe finder fallback and unchanged landing passed');

for(const locale of ['de','sq','en']){
 for(const initialError of ['', 'unavailable']){
  const html=renderToStaticMarkup(createElement(I18nProvider,{locale,messages:getMessages(locale,['common','public','customer'])},createElement(Catalogue,{initialWorkshops:[],initialError,initialFilters:defaultCatalogueFilters,signedIn:false,account:null,isAdmin:false,reviewEntry:true})));
  assert(html.includes({de:'Öffne das Profil der Werkstatt, die du besucht hast. Dort kannst du deine Bewertung und den privaten Nachweis einreichen.',sq:'Hap profilin e servisit që ke vizituar. Aty mund të dërgosh vlerësimin dhe dëshminë private.',en:'Open the profile of the workshop you visited. You can submit your review and private evidence there.'}[locale]),'finder explains where to submit a review in empty and error states');
 }
}
console.log('Review finder context: localized empty and retry screens explain profile entry passed');
