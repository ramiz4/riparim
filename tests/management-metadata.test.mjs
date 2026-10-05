import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdir,writeFile} from 'node:fs/promises';
const out='.test-runtime/management-metadata.mjs';
const names=['betrieb','verwaltung','verwaltung/benutzer','verwaltung/betriebe','verwaltung/bewertungen','verwaltung/anmeldung'];
const source=names.map((path,index)=>`export * as page${index} from './app/[locale]/${path}/page';`).join('\n');
const result=await build({stdin:{contents:source,resolveDir:process.cwd(),loader:'tsx'},outfile:out,bundle:true,write:false,format:'esm',platform:'node',packages:'external',loader:{'.css':'empty','.module.css':'empty'},plugins:[{name:'worker-system-boundary',setup(b){b.onResolve({filter:/^(cloudflare:workers|next\/(headers|navigation|link))$/},args=>({path:args.path,namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},args=>({contents:args.path==='cloudflare:workers'?'export const env={};':args.path==='next/navigation'?'export function redirect(){};export function notFound(){};export function useRouter(){return {}};export function useSearchParams(){return new URLSearchParams()};export function usePathname(){return "/"};':args.path==='next/headers'?'export async function headers(){return new Headers()};export async function cookies(){return {}};':'export default function Link(){return null}',loader:'js'}));}}]});await mkdir('.test-runtime',{recursive:true});await writeFile(out,result.outputFiles[0].contents);
const pages=await import(new URL('../'+out,import.meta.url));
for(const locale of ['de','sq','en'])for(const [index,path] of names.entries()){
 const page=pages['page'+index],metadata=page.generateMetadata?await page.generateMetadata({params:Promise.resolve({locale})}):page.metadata??{};
 assert.equal(metadata.robots?.index,false,path+' must remain private in '+locale);assert.equal(metadata.robots?.follow,false);assert.equal(metadata.alternates,null,'Business/management pages cannot advertise private alternate deep links');
 assert.equal(typeof metadata.title,'string');assert(metadata.title.endsWith(' · Riparim'));
}
console.log('Business and administration metadata: all six active-locale page titles are noindex,nofollow without private alternates');
