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

const authOutput='.test-runtime/local-dev-config/auth-screen.mjs';
await build({stdin:{contents:"export {default} from './app/auth-screen';export {localSeedPreviewAccount} from './lib/auth/local-development';",resolveDir:process.cwd(),loader:'tsx'},outfile:authOutput,bundle:true,platform:'node',format:'esm',packages:'external',plugins:[{name:'auth-page-boundaries',setup(b){
 b.onResolve({filter:/^(next\/headers|next\/navigation|\.\/auth|\.\/auth-form|@\/lib\/auth\/config|@\/lib\/public-release|@\/components\/deferred-auth)$/},args=>({path:args.path,namespace:'fixture'}));
 b.onLoad({filter:/.*/,namespace:'fixture'},args=>({loader:'js',contents:args.path==='next/headers'?'export async function headers(){return new Headers({host:globalThis.fixtureHost});}':args.path==='next/navigation'?'export function redirect(){throw Error("Unexpected redirect");}':args.path==='./auth'?'export async function getAppUser(){return null;}export async function getAdminUser(){return null;}':args.path==='./auth-form'?'export default function AuthForm(){return null;}':args.path==='@/components/deferred-auth'?'export function DeferredAuth(){return null;}':args.path==='@/lib/public-release'?'export function publicReleaseRender(){return false;}':'export async function getAuthConfig(){return null;}export function safeReturnPath(value){return value??"/einstellungen";}export async function providerAvailability(){return {email:false,emailSignup:false,emailRecovery:false,google:false};}'}));
}}]});
const {default:AuthScreenPage,localSeedPreviewAccount}=await import(new URL('../'+authOutput,import.meta.url));
const originalMode=process.env.NODE_ENV;
try{
 for(const mode of ['development','production','test'])for(const host of ['127.0.0.1:5199','localhost:5199','[::1]:5199','riparim.com','127.0.0.1.evil.test:5199'])for(const screen of ['login','register','recovery','reset']){
  process.env.NODE_ENV=mode;globalThis.fixtureHost=host;
  const page=await AuthScreenPage({screen,params:Promise.resolve({locale:'de'}),searchParams:Promise.resolve({weiter:'/einstellungen'})});
  const local=mode==='development'&&['127.0.0.1:5199','localhost:5199','[::1]:5199'].includes(host)&&screen==='login';
  assert.equal(page.props.children.props.localSeedLogin,local,'Only the local development login page offers the seed entry');
  const seed={userId:'local_seedy',email:'seedy@sites.test',displayName:'Seedy',provider:'ChatGPT'};
  assert.equal(!!await localSeedPreviewAccount(seed),mode==='development'&&['127.0.0.1:5199','localhost:5199','[::1]:5199'].includes(host),'Only the verified local seed identity receives preview account data');
  for(const user of [null,{...seed,userId:'another-user'},{...seed,provider:'E-Mail'},{...seed,email:'another@example.test'}])assert.equal(await localSeedPreviewAccount(user),undefined,'Guests and real accounts never receive seed data');
 }
 console.log('Local login UI boundary: development loopback only; production, external hosts and other Auth screens omit the entry');
}finally{
 if(originalMode===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=originalMode;
 delete globalThis.fixtureHost;
}
