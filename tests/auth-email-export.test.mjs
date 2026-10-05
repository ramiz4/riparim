import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtemp,readFile,stat,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

const temporary=await mkdtemp(join(tmpdir(),'riparim-mail-export-')),origin='https://riparim.example.test';
const run=(site,directory)=>spawnSync(process.execPath,['scripts/auth-email-templates.mjs','--site-origin',origin,'--provider-site-url',site,'--output-dir',directory],{encoding:'utf8'});
let passed=0;
try{
 for(const value of [origin+'/',origin+'/path','https://other.example.test']){
  const directory=join(temporary,'rejected-'+encodeURIComponent(value)),result=run(value,directory);
  assert.notEqual(result.status,0);assert.match(result.stderr,/AUTH_EMAIL_ORIGIN/);await assert.rejects(stat(directory),{code:'ENOENT'});
  passed+=3;
 }
 const directory=join(temporary,'accepted'),result=run(origin,directory);assert.equal(result.status,0,result.stderr);passed++;
 const metadata=JSON.parse(await readFile(join(directory,'manifest.json'),'utf8'));
 assert.equal(metadata.siteOrigin,origin);assert.equal(metadata.providerSiteURL,origin);assert.equal(metadata.actualGoHtmlTemplate,true);assert.equal(metadata.productionChanged,false);
 passed+=4;
 for(const kind of ['confirmation','recovery'])for(const locale of ['de','sq','en']){
  const preview=await readFile(join(directory,`${kind}-${locale}.html`),'utf8');assert(preview.includes(`<html lang="${locale}" dir="ltr">`));
  assert(metadata.previews.some(item=>item.kind===kind&&item.locale===locale&&item.renderedLocale===locale));
  passed+=2;
 }
 console.log(JSON.stringify({authEmailExportChecksPassed:passed,productionTouched:false,realEmailsSent:false}));
}finally{await rm(temporary,{recursive:true,force:true});}
