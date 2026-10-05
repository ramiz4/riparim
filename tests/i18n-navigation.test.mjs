import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdir,writeFile,readdir} from 'node:fs/promises';
const out=new URL('../.test-runtime/i18n-navigation/',import.meta.url);await mkdir(out,{recursive:true});
const result=await build({entryPoints:['lib/i18n/locale.ts','lib/auth/config.ts','lib/profile-navigation.ts'],outdir:out.pathname,bundle:true,format:'esm',platform:'node',write:false,plugins:[{name:'isolate-db',setup(builder){builder.onResolve({filter:/^(?:@\/db\/storage|cloudflare:workers)$/},()=>({path:'storage',namespace:'fixture'}));builder.onLoad({filter:/.*/,namespace:'fixture'},()=>({loader:'js',contents:'export const env={SITE_ORIGIN:"https://riparim.com"};export function storage(){return {env};}'}));}}]});for(const file of result.outputFiles){await mkdir(new URL('.', 'file://'+file.path),{recursive:true});await writeFile(file.path,file.text);}
const {localizeHref,stripLocalePrefix,publicAssetPaths}=await import(new URL('i18n/locale.js',out));
const {safeReturnPath}=await import(new URL('auth/config.js',out));
const {profileSearchHref}=await import(new URL('profile-navigation.js',out));
assert.deepEqual([...publicAssetPaths].sort(),(await readdir('public',{recursive:true,withFileTypes:true})).filter(file=>file.isFile()).map(file=>'/'+file.parentPath.replace(/^public\/?/, '')+(file.parentPath==='public'?'':'/')+file.name).sort(),'physical public asset inventory matches files independently');
assert.equal(localizeHref('/sq/werkstatt/profile?ort=prizren#bewerten','en'),'/en/werkstatt/profile?ort=prizren#bewerten');
assert.equal(stripLocalePrefix('/en/werkstaetten'),'/werkstaetten');
assert.equal(stripLocalePrefix('/sq?besuche=1#suche'),'/?besuche=1#suche');
assert.equal(safeReturnPath('/sq/auth/bestaetigen?token_hash=private'), '/?besuche=1','Localized callbacks cannot create a callback loop');
assert.equal(safeReturnPath('/sq/%61uth/bestaetigen?token_hash=private'),'/?besuche=1','Encoded callback paths also cannot loop');
assert.equal(safeReturnPath('/en/signin-with-chatgpt'), '/?besuche=1');
assert.equal(safeReturnPath('/en/callback'),'/?besuche=1','Native callbacks cannot be locale return targets');
assert.equal(safeReturnPath('//evil.example/private'), '/?besuche=1');
assert.equal(profileSearchHref('/sq/werkstaetten?sprache=sq&ort=prizren',[]),'/sq/werkstaetten?ort=prizren&sprache=sq','Catalogue return targets retain locale and canonical filter values');
console.log('Locale navigation and auth return boundaries passed');
