import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';

const {build}=createRequire(new URL('../package.json',import.meta.url))('esbuild');
const output='.test-runtime/local-dev-config/config.mjs';
await build({entryPoints:['vite.config.ts'],outfile:output,bundle:true,platform:'node',format:'esm',packages:'external',plugins:[{name:'plugin-boundaries',setup(b){
 b.onResolve({filter:/^(vinext|@cloudflare\/vite-plugin|\.\/build\/(sites-vite-plugin|connector-preview-plugin\.mjs))$/},args=>({path:args.path,namespace:'fixture'}));
 b.onLoad({filter:/.*/,namespace:'fixture'},args=>({loader:'js',contents:args.path==='@cloudflare/vite-plugin'?'export function cloudflare(options){globalThis.localDevOptions=options;return [];}':args.path==='vinext'?'export default function vinext(){return [];}':'export function sites(){return {};}export function connectorPreview(){return {};}'}));
}}]});
const {default:configure}=await import(new URL('../'+output,import.meta.url));
const originalTarget=process.env.BUILD_TARGET;
const originalOrigin=process.env.SITE_ORIGIN;

try{
 process.env.SITE_ORIGIN='http://127.0.0.1:5184';
 for(const target of ['cloudflare','sites']){
  process.env.BUILD_TARGET=target;
  await configure({command:'serve',mode:'test'});
  const options=globalThis.localDevOptions;
  const inherited=JSON.parse(await readFile(options.configPath,'utf8'));
  const overrides=options.config(inherited);
  // The Vite plugin concatenates array overrides with the file's values.
  // Check the effective inputs at this boundary, rather than regexing source.
  const flags=[...(overrides.compatibility_flags??[]),...(inherited.compatibility_flags??[])];
  assert.equal(flags.length,new Set(flags).size,'local startup must not receive duplicate compatibility flags');
  assert(flags.includes('nodejs_compat'),'local runtime keeps Node.js support');
  for(const field of ['d1_databases','r2_buckets','services']){
   const bindings=[...(overrides[field]??[]),...(inherited[field]??[])];
   assert.equal(bindings.length,new Set(bindings.map(value=>value.binding)).size,`${field} must not repeat logical bindings`);
   assert(bindings.every(value=>value.remote!==true),'local preview must not use remote resource bindings');
  }
  assert.equal(overrides.d1_databases[0].database_id,'00000000-0000-4000-8000-000000000000');
  assert.equal(overrides.r2_buckets[0].bucket_name,'site-creator-r2');
  assert.equal(overrides.vars.SITE_ORIGIN,process.env.SITE_ORIGIN);
  assert.equal(inherited.account_id,undefined,'preview does not inherit the production account');
  assert.equal(options.auxiliaryWorkers.length,1,'the existing connector preview remains available');
  await configure({command:'build',mode:'production'});
  const release=globalThis.localDevOptions;
  assert.equal(release.configPath,target==='sites'?'./wrangler.sites.jsonc':'./wrangler.jsonc','build target routing is preserved');
  assert.equal(release.auxiliaryWorkers,undefined,'preview services stay out of release builds');
  if(target==='cloudflare')assert.equal(release.config,undefined,'production keeps the checked-in Wrangler configuration');
 }
 console.log('Local dev configuration: unique flags and bindings, isolated storage, connector preview and both release targets passed');
}finally{
 if(originalTarget===undefined)delete process.env.BUILD_TARGET;else process.env.BUILD_TARGET=originalTarget;
 if(originalOrigin===undefined)delete process.env.SITE_ORIGIN;else process.env.SITE_ORIGIN=originalOrigin;
 delete globalThis.localDevOptions;
}
