import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
const {build}=createRequire(new URL('../package.json',import.meta.url))('esbuild');
const bundle=await build({entryPoints:['lib/profile-navigation.ts'],bundle:true,platform:'node',format:'esm',write:false});
await mkdir('.test-runtime/profile-navigation',{recursive:true});
await writeFile('.test-runtime/profile-navigation/navigation.mjs',bundle.outputFiles[0].contents);
const {navigateToProfile,profileSearchHref}=await import(new URL('../.test-runtime/profile-navigation/navigation.mjs',import.meta.url));

const target='/werkstatt/as-motors?suche=%2Fwerkstaetten%3Fort%3Dfushe-kosove';
function fixture(){
 const timers=[],visits=[],hardVisits=[];
 let current='https://riparim.com/werkstaetten?ort=fushe-kosove';
 return {timers,visits,hardVisits,setHref:href=>{current=href;},runTimers:()=>timers.forEach(timer=>{if(!timer.cancelled)timer.callback();}),navigation:{
  readHref:()=>current,navigate:href=>visits.push(href),hardNavigate:href=>hardVisits.push(href),
  schedule(callback,delay){const timer={callback,delay,cancelled:false};timers.push(timer);return()=>{timer.cancelled=true;};},
 }};
}
const stalled=fixture();navigateToProfile(target,stalled.navigation);
assert.deepEqual(stalled.visits,[target]);assert.deepEqual(stalled.hardVisits,[]);
stalled.runTimers();assert.deepEqual(stalled.hardVisits,[target],'a stalled client navigation opens the same profile as a document');

const completed=fixture();navigateToProfile(target,completed.navigation);completed.setHref('https://riparim.com'+target);completed.runTimers();
assert.deepEqual(completed.hardVisits,[],'successful client navigation keeps the search draft in memory');

const left=fixture();navigateToProfile(target,left.navigation);left.setHref('https://riparim.com/anmelden');left.runTimers();
assert.deepEqual(left.hardVisits,[],'the fallback cannot pull the visitor away from a later page');

const superseded=fixture();navigateToProfile(target,superseded.navigation);const newer='/werkstatt/auto-mita';navigateToProfile(newer,superseded.navigation);superseded.runTimers();
assert.deepEqual(superseded.hardVisits,[newer],'only the latest clicked profile may trigger a fallback');

const unmounted=fixture();const cancel=navigateToProfile(target,unmounted.navigation);cancel();unmounted.runTimers();
assert.deepEqual(unmounted.hardVisits,[],'leaving the link cancels its pending fallback');

const throws=fixture();throws.navigation.navigate=()=>{throw Error('Router unavailable');};navigateToProfile(target,throws.navigation);throws.runTimers();
assert.deepEqual(throws.hardVisits,[target],'a synchronous router failure immediately uses normal document navigation');

assert.equal(profileSearchHref('/werkstaetten?ort=fushe-kosove&leistung=diagnose-elektronik&problem=private&model=private&year=2018&radius=30',[]),'/werkstaetten?leistung=diagnose-elektronik&ort=fushe-kosove','only public search filters survive a full page load');
for(const unsafe of [null,'https://example.com/werkstaetten','//example.com/werkstaetten','/anmelden','/werkstaetten-hidden','/werkstaetten/../anmelden'])assert.equal(profileSearchHref(unsafe,[]),null);
console.log('Profile navigation: stalled, completed, superseded, cancelled, failed and safe-return scenarios passed');
