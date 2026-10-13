import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {build} from 'esbuild';
import {prepareOpeningHoursImport,validateOpeningHoursImport,openingHoursImportQuery} from './lib/opening-hours-import.mjs';
import {statementSql} from './catalogue-release-plan.mjs';

const args=process.argv.slice(2),allowed=['--csv','--prepare','--output','--release','--local-db'];
const options={};let write=false;
for(let i=0;i<args.length;i++){if(args[i]==='--write'){write=true;continue;}if(!allowed.includes(args[i])||!args[i+1]||options[args[i]])throw Error('Use --csv FILE --prepare FILE, or [--output FILE] [--local-db FILE --write], or --release TAG --write');options[args[i]]=args[++i];}
await mkdir('.sites-runtime/hours-import',{recursive:true});
const bundle='.sites-runtime/hours-import/contract.mjs';
await build({entryPoints:['lib/opening-hours.ts'],outfile:bundle,bundle:true,format:'esm',platform:'node',packages:'external'});
const {openingHoursSchema}=await import(pathToFileURL(resolve(bundle)));
const catalogue=JSON.parse(await readFile('data/workshops.json','utf8'));
let manifest=options['--csv']?prepareOpeningHoursImport(await readFile(options['--csv'],'utf8'),catalogue,v=>openingHoursSchema.parse(v)):JSON.parse(await readFile('data/opening-hours-import.json','utf8'));
validateOpeningHoursImport(manifest,catalogue,v=>openingHoursSchema.parse(v));
if(options['--prepare']){if(write)throw Error('Prepare and apply cannot be combined');await writeFile(options['--prepare'],JSON.stringify(manifest,null,2)+'\n');}
const query=openingHoursImportQuery(manifest,new Date().toISOString());
if(options['--output'])await writeFile(options['--output'],JSON.stringify(query)+'\n',{mode:0o600});
if(write){
 if(options['--prepare']||options['--csv'])throw Error('Apply only the checked manifest');
 if(options['--local-db']){
  const {DatabaseSync}=await import('node:sqlite'),db=new DatabaseSync(options['--local-db']);
  console.log({changes:db.prepare(query.sql).run(...query.params).changes});db.close();
 }else{
  const tag=options['--release'];if(!/^v\d+\.\d+\.\d+$/.test(tag??''))throw Error('Production requires a published main release');
  const run=(command,args)=>{const r=spawnSync(command,args,{encoding:'utf8'});if(r.status!==0)throw Error(`${command} failed`);return r.stdout.trim();};
  const head=run('git',['rev-parse','HEAD']);
  if(head!==run('git',['rev-parse',`${tag}^{commit}`]))throw Error('Checkout must match the release');
  const release=JSON.parse(run('gh',['release','view',tag,'--json','isDraft,isPrerelease,assets']));
  if(release.isDraft||release.isPrerelease||release.assets.length<6)throw Error('Release is not complete');
  if(run('git',['show','HEAD:data/opening-hours-import.json'])!==(await readFile('data/opening-hours-import.json','utf8')).trim())throw Error('Manifest differs from the release');
  const file='.sites-runtime/hours-import/apply.sql';await writeFile(file,statementSql(query),{mode:0o600});
  run(process.execPath,['node_modules/wrangler/bin/wrangler.js','d1','execute','DB','--remote','--config','wrangler.jsonc','--file',file,'--yes']);
 }
}
console.log(JSON.stringify({mode:write?'write':'preview',revision:manifest.revision,total:manifest.records.length,assumed:manifest.records.filter(r=>r.metadata.kind==='assumed').length,researched:manifest.records.filter(r=>r.metadata.kind==='researched').length,excluded:manifest.excluded}));
