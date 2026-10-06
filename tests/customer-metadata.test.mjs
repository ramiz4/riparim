import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdir,writeFile} from 'node:fs/promises';
const out='.test-runtime/customer-metadata.mjs';
const source=`export {authCallbackUrl} from './lib/auth/locale';export {generateMetadata as home} from './app/[locale]/page';export {generateMetadata as login} from './app/[locale]/anmelden/page';export {generateMetadata as register} from './app/[locale]/registrieren/page';export {generateMetadata as recovery} from './app/[locale]/passwort-vergessen/page';export {generateMetadata as reset} from './app/[locale]/passwort-neu/page';export {generateMetadata as settings} from './app/[locale]/einstellungen/page';export {generateMetadata as ownReviews} from './app/[locale]/bewertungen/page';`;
const result=await build({stdin:{contents:source,resolveDir:process.cwd(),loader:'tsx'},outfile:out,bundle:true,write:false,format:'esm',platform:'node',packages:'external',loader:{'.css':'empty','.module.css':'empty'},plugins:[{name:'worker-boundary',setup(b){b.onResolve({filter:/^(cloudflare:workers|next\/(headers|navigation|link))$/},args=>({path:args.path,namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},args=>({contents:args.path==='cloudflare:workers'?'export const env={};':args.path==='next/navigation'?'export function redirect(){};export function notFound(){};export function useRouter(){return {}};export function useSearchParams(){return new URLSearchParams()};export function usePathname(){return \"/\"};':args.path==='next/headers'?'export async function headers(){return new Headers()};export async function cookies(){return {}};':'export default function Link(){return null}',loader:'js'}));}}]});await mkdir('.test-runtime',{recursive:true});await writeFile(out,result.outputFiles[0].contents);
const pages=await import(new URL('../'+out,import.meta.url));
for(const locale of ['de','sq','en']){
 const params=Promise.resolve({locale});
 for(const name of ['login','register','recovery','reset','settings','ownReviews']){
  const metadata=await pages[name]({params});assert.equal(metadata.robots.index,false);assert.equal(metadata.robots.follow,false);assert.equal(metadata.alternates,null);
  assert(!JSON.stringify(metadata).includes('einreichung='),'Private metadata cannot expose a submission ID');
 }
 for(const query of [{besuche:'1'},{einreichung:'11111111-1111-4111-8111-111111111111'},{nachweis:'neu'},{besuche:['0','1']},{einreichung:['','private-fixture']}]){
  const metadata=await pages.home({params,searchParams:Promise.resolve(query)});assert.equal(metadata.robots.index,false);assert.equal(metadata.alternates,null);
 }
 const publicLanding=await pages.home({params,searchParams:Promise.resolve({ort:'prizren'})});assert.notEqual(publicLanding.robots?.index,false,'Regular public landing keeps its indexability');
}
process.stdout.write('Customer metadata: auth/settings and private landing modes noindex with no private alternates; ordinary landing remains public\n');

const url=new URL(pages.authCallbackUrl('https://riparim.example.test','en','/sq/werkstatt/fixture#bewerten',{token_hash:'fixture-hash',type:'signup',locale:'sq',weiter:'//outside.test',unsafe:'discard'}));
assert.equal(url.href,'https://riparim.example.test/auth/bestaetigen?locale=en&weiter=%2Fen%2Fwerkstatt%2Ffixture%23bewerten&token_hash=fixture-hash&type=signup');
