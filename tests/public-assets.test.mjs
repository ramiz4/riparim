import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';

const manifest=JSON.parse(await readFile('dist/client/.vite/manifest.json','utf8'));
for(const entry of ['app/finder.tsx','app/[locale]/werkstaetten/catalogue.tsx']){
 const dependencies=new Set();
 function visit(key){
  if(dependencies.has(key))return;
  assert(manifest[key],`Missing production entry ${key}`);
  dependencies.add(key);
  for(const dependency of manifest[key].imports??[])visit(dependency);
 }
 visit(entry);
 assert(!dependencies.has('app/journeys.tsx'),`${entry} must not load the private review journeys`);
 for(const dependency of dependencies)assert(!/review-form|alert-dialog|evidence/.test(manifest[dependency].file),`${entry} must not load review submission/deletion dependencies`);
}
for(const name of ['workshop','diagnostics']){
 const original=(await stat(`public/${name}.jpg`)).size;
 for(const width of [640,1024,1536]){
  const asset=`${name}-${width}.webp`,data=await readFile(`dist/client/${asset}`);
  assert.equal(data.subarray(0,4).toString(),'RIFF');
  assert.equal(data.subarray(8,12).toString(),'WEBP');
  assert(data.length<original/2,`${asset} must save at least half the original photo bytes`);
 }
}
console.log('Production public assets: review code stays outside public search dependencies and compact photo variants ship in the build.');
