import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdir,writeFile,readdir} from 'node:fs/promises';
const out=new URL('../.test-runtime/i18n-navigation/',import.meta.url);await mkdir(out,{recursive:true});
const result=await build({entryPoints:['lib/i18n/locale.ts','lib/auth/config.ts','lib/profile-navigation.ts','lib/i18n/navigation.ts'],outdir:out.pathname,bundle:true,format:'esm',platform:'node',write:false,plugins:[{name:'isolate-db',setup(builder){builder.onResolve({filter:/^(?:@\/db\/storage|cloudflare:workers)$/},()=>({path:'storage',namespace:'fixture'}));builder.onLoad({filter:/.*/,namespace:'fixture'},()=>({loader:'js',contents:'export const env={SITE_ORIGIN:"https://riparim.com"};export function storage(){return {env};}'}));}}]});for(const file of result.outputFiles){await mkdir(new URL('.', 'file://'+file.path),{recursive:true});await writeFile(file.path,file.text);}
const {localizeHref,stripLocalePrefix,pageIdentityPath,isPagePath,publicAssetPaths}=await import(new URL('i18n/locale.js',out));
const {safeReturnPath}=await import(new URL('auth/config.js',out));
const {languageSwitchHref}=await import(new URL('i18n/navigation.js',out));
const {profileSearchHref}=await import(new URL('profile-navigation.js',out));
assert.deepEqual([...publicAssetPaths].sort(),(await readdir('public',{recursive:true,withFileTypes:true})).filter(file=>file.isFile()).map(file=>'/'+file.parentPath.replace(/^public\/?/, '')+(file.parentPath==='public'?'':'/')+file.name).sort(),'physical public asset inventory matches files independently');
assert.equal(localizeHref('/sq/werkstatt/profile?ort=prizren#bewerten','en'),'/en/workshop/profile?ort=prizren#bewerten');
assert.equal(stripLocalePrefix('/en/werkstaetten'),'/werkstaetten');
assert.equal(stripLocalePrefix('/sq?besuche=1#suche'),'/?besuche=1#suche');
assert.equal(safeReturnPath('/sq/auth/bestaetigen?token_hash=private'), '/?besuche=1','Localized callbacks cannot create a callback loop');
assert.equal(safeReturnPath('/sq/%61uth/bestaetigen?token_hash=private'),'/?besuche=1','Encoded callback paths also cannot loop');
assert.equal(safeReturnPath('/en/signin-with-chatgpt'), '/?besuche=1');
assert.equal(safeReturnPath('/en/callback'),'/?besuche=1','Native callbacks cannot be locale return targets');
assert.equal(safeReturnPath('//evil.example/private'), '/?besuche=1');
assert.equal(profileSearchHref('/sq/serviset?sprache=sq&ort=prizren',[]),'/sq/serviset?ort=prizren&sprache=sq','Catalogue return targets retain locale and canonical filter values');
const routes=[
 ['/', '/sq', '/en'],
 ['/werkstaetten','/sq/serviset','/en/workshops'],
 ['/werkstatt/fixture-id','/sq/servis/fixture-id','/en/workshop/fixture-id'],
 ['/anmelden','/sq/hyr','/en/login'],
 ['/registrieren','/sq/regjistrohu','/en/register'],
 ['/passwort-vergessen','/sq/fjalekalimi-i-harruar','/en/forgot-password'],
 ['/passwort-neu','/sq/fjalekalim-i-ri','/en/reset-password'],
 ['/einstellungen','/sq/cilesimet','/en/settings'],
 ['/bewertungen','/sq/vleresimet','/en/reviews'],
 ['/datenschutz','/sq/privatesia','/en/privacy'],
 ['/betrieb','/sq/biznesi','/en/business'],
 ['/betrieb/beanspruchen','/sq/biznesi/kerko-pronesine','/en/business/claim'],
 ['/verwaltung','/sq/administrimi','/en/admin'],
 ['/verwaltung/anmeldung','/sq/administrimi/autentikimi','/en/admin/authentication'],
 ['/verwaltung/benutzer','/sq/administrimi/perdoruesit','/en/admin/users'],
 ['/verwaltung/betriebe','/sq/administrimi/bizneset','/en/admin/businesses'],
 ['/verwaltung/bewertungen','/sq/administrimi/vleresimet','/en/admin/reviews'],
];
const nativePages=(await readdir('app/[locale]',{recursive:true})).filter(file=>file==='page.tsx'||file.endsWith('/page.tsx')).map(file=>'/'+file.replace(/(?:^|\/)page\.tsx$/,'').replace('[id]','fixture-id'));
assert.deepEqual(routes.map(route=>route[0]).sort(),nativePages.sort(),'Every native page has a reviewed translation');
for(const translations of routes)for(const source of translations)for(const [i,locale] of ['de','sq','en'].entries()){
 assert.equal(localizeHref(source+'?ort=prizren#bewerten',locale),translations[i]+'?ort=prizren#bewerten');
 assert.equal(pageIdentityPath(source),translations[0]);
 assert(isPagePath(source));
 assert.equal(localizeHref((locale==='de'?'':'/'+locale)+translations[0],locale),translations[i],'Legacy German paths remain resolvable');
}
for(const path of ['/api/account','/auth/bestaetigen','/favicon.svg','/sitemap.xml','https://outside.test/werkstaetten','//outside.test/werkstaetten'])assert.equal(localizeHref(path,'en'),path);
for(const path of ['/en/serviset','/sq/workshops','/en/admin/unknown','/sq/servis/id/extra','/en/workshops.png'])assert.equal(isPagePath(path),false,'Unknown page shapes remain rejected');
for(const locale of ['de','sq','en']){
 assert.equal(languageSwitchHref('/betrieb/beanspruchen?werkstatt=fixture-workshop&evidence=private',locale),localizeHref('/betrieb/beanspruchen?werkstatt=fixture-workshop',locale));
 assert.equal(languageSwitchHref('/betrieb/beanspruchen?werkstatt=fixture-workshop&werkstatt=other',locale),localizeHref('/betrieb/beanspruchen',locale));
 assert.equal(languageSwitchHref('/anmelden?weiter='+encodeURIComponent('/betrieb/beanspruchen?werkstatt=fixture-workshop'),locale),localizeHref('/anmelden?weiter=',locale)+encodeURIComponent(localizeHref('/betrieb/beanspruchen?werkstatt=fixture-workshop',locale)));
}
console.log('Locale navigation and auth return boundaries passed');
