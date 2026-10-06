import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdir,writeFile,readFile,readdir} from 'node:fs/promises';
import {DatabaseSync} from 'node:sqlite';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {JSDOM} from 'jsdom';

const id='00000000-0000-4000-8000-000000000001',out='.test-runtime/my-reviews-page';
const db=new DatabaseSync(':memory:');
for(const file of (await readdir('drizzle')).filter(file=>file.endsWith('.sql')).sort())db.exec(await readFile('drizzle/'+file,'utf8'));
const d1={prepare(sql){const statement=db.prepare(sql);const adapter=(values=[])=>({bind:(...next)=>adapter(next),first:async()=>statement.get(...values)??null,all:async()=>({results:statement.all(...values)}),run:async()=>({meta:statement.run(...values)})});return adapter();},async batch(statements){return Promise.all(statements.map(statement=>statement.run()));}};
globalThis.fixtureEnv={DB:d1,BUCKET:{},SITE_ORIGIN:'https://riparim.example.test'};
globalThis.fixtureHeaders=new Headers();
const result=await build({stdin:{contents:"export {default as Home} from './app/[locale]/page';export {default as ReviewsPage,generateMetadata} from './app/[locale]/bewertungen/page';export {isPagePath} from './lib/i18n/locale';export {I18nProvider} from './lib/i18n/client';export {getMessages} from './lib/i18n/messages';",resolveDir:process.cwd(),loader:'tsx'},outfile:out+'/server.mjs',bundle:true,write:false,format:'esm',platform:'node',packages:'external',loader:{'.css':'empty'},plugins:[{name:'request-boundaries',setup(builder){
 builder.onResolve({filter:/^(cloudflare:workers|next\/(headers|navigation|link))$/},args=>({path:args.path,namespace:'fixture'}));
 builder.onLoad({filter:/.*/,namespace:'fixture'},args=>({loader:'js',resolveDir:process.cwd(),contents:args.path==='cloudflare:workers'?'export const env=globalThis.fixtureEnv;':args.path==='next/headers'?'export async function headers(){return globalThis.fixtureHeaders;}export async function cookies(){return {getAll(){return []},set(){}};}':args.path==='next/navigation'?'export function redirect(location){throw Object.assign(new Error("redirect"),{location});}export function notFound(){throw Error("not found")}export function useRouter(){return {refresh(){},push(){}}}export function useSearchParams(){return new URLSearchParams()}export function usePathname(){return "/"}':'import React from "react";export default function Link({href,children,...props}){return React.createElement("a",{href,...props},children)}'}));
 }}]});
await mkdir(out,{recursive:true});await writeFile(out+'/server.mjs',result.outputFiles[0].contents);
const {Home,ReviewsPage,generateMetadata,isPagePath,I18nProvider,getMessages}=await import(new URL('../'+out+'/server.mjs',import.meta.url));
try{
 for(const locale of ['de','sq','en']){
  const prefix=locale==='de'?'':'/'+locale;
  await assert.rejects(()=>Home({params:Promise.resolve({locale}),searchParams:Promise.resolve({besuche:'1',einreichung:id})}),error=>error.location===prefix+'/bewertungen?einreichung='+id,'Legacy own-review links navigate to the independent localized page with the exact submission');
  for(const [query,destination] of [[{besuche:'1'},prefix+'/bewertungen'],[{einreichung:id},prefix+'/bewertungen?einreichung='+id],[{besuche:['0','1'],einreichung:'//outside.example.test'},prefix+'/bewertungen'],[{besuche:'1',einreichung:[id,'other-private-id'],weiter:'//outside.example.test'},prefix+'/bewertungen']])await assert.rejects(()=>Home({params:Promise.resolve({locale}),searchParams:Promise.resolve(query)}),error=>error.location===destination,'Legacy navigation retains locale and only an unambiguous safe own-submission target');
  assert(isPagePath(prefix+'/bewertungen'),'The independently addressable review page passes the locale request guard');
  const metadata=await generateMetadata({params:Promise.resolve({locale}),searchParams:Promise.resolve({einreichung:id})});assert.deepEqual(metadata.robots,{index:false,follow:false});assert.equal(metadata.alternates,null);assert(!JSON.stringify(metadata).includes(id),'Private page metadata never advertises a submission target');
  for(const target of [id,'https://outside.example.test/private']){
   const guest=await ReviewsPage({params:Promise.resolve({locale}),searchParams:Promise.resolve({einreichung:target})});
   const dom=new JSDOM(renderToStaticMarkup(createElement(I18nProvider,{locale,messages:getMessages(locale,['common'])},guest)));
   try{
    const document=dom.window.document;assert.equal(document.querySelectorAll('main').length,1);assert.equal(document.querySelector('main h1').textContent,getMessages(locale).customer.myReviews);assert(!document.querySelector('[role="dialog"], [data-slot="dialog-overlay"]'),'Direct guest page has a regular document frame');
    assert.equal(document.querySelector('.login-prompt a').getAttribute('href'),prefix+'/anmelden?weiter='+encodeURIComponent(prefix+'/bewertungen'+(target===id?'?einreichung='+id:'')),'Logged-out direct calls preserve only their localized validated page destination through sign-in');
    assert(!document.querySelector('.visit, .evidence-details'),'Guests never render private reviews or evidence');assert(document.querySelector('footer'),'The private page retains standard site navigation');
   }finally{dom.window.close();}
  }
  globalThis.fixtureHeaders=new Headers({'oai-authenticated-user-id':'fixture-owner','oai-authenticated-user-email':'fixture@example.test'});
  const page=await ReviewsPage({params:Promise.resolve({locale}),searchParams:Promise.resolve({einreichung:id})});
  const dom=new JSDOM(renderToStaticMarkup(createElement(I18nProvider,{locale,messages:getMessages(locale,['common'])},page)));
  try{assert.equal(dom.window.document.querySelector('main [role="status"]')?.textContent,getMessages(locale).customer.myReviewsLoading,'A direct authenticated page displays its localized loading state before hydration');}finally{dom.window.close();}
  globalThis.fixtureHeaders=new Headers();
 }
 console.log('Own reviews: direct locale pages, private metadata, safe sign-in and compatible legacy submission redirects passed');
}finally{db.close();}
