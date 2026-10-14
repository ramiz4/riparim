import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';
import {catalogueReleasePlan,statementSql} from './catalogue-release-plan.mjs';
import {validateOpeningHoursImport} from './lib/opening-hours-import.mjs';

export async function localOpeningHoursSeedSql(root=process.cwd()){
 const catalogue=JSON.parse(await readFile(resolve(root,'data/workshops.json'),'utf8'));
 const hours=JSON.parse(await readFile(resolve(root,'data/opening-hours-import.json'),'utf8'));
 const output=resolve(root,'.sites-runtime/local-dev/hours-contract.mjs');await mkdir(resolve(root,'.sites-runtime/local-dev'),{recursive:true});
 await build({absWorkingDir:root,entryPoints:['lib/opening-hours.ts'],outfile:output,bundle:true,format:'esm',platform:'node',packages:'external'});
 const {openingHoursSchema}=await import(pathToFileURL(output));validateOpeningHoursImport(hours,catalogue,value=>openingHoursSchema.parse(value));
 const plan=await catalogueReleasePlan(catalogue,'local-development',root);
 const statements=[...plan.statements,{sql:plan.completionSql,params:[plan.key,'local-development']}];
 // Defaults fill missing imported hours only. Owner-confirmed hours, suppressed
 // imports and locally edited identities retain their existing behavior.
 for(const record of hours.records)statements.push({sql:`INSERT OR IGNORE INTO workshop_opening_hours_imports(workshop_id,opening_hours,source_metadata,import_revision,imported_at,suppressed)
 SELECT id,?,?,?,?,0 FROM workshops WHERE id=? AND name=? AND city=? AND address=? AND phone=? AND status='published'`,params:[JSON.stringify(record.hours),JSON.stringify(record.metadata),hours.revision,new Date().toISOString(),record.id,record.expected.name,record.expected.city,record.expected.address,record.expected.phone]});
 return statements.map(statementSql).join('\n');
}

export async function seedLocalOpeningHours(root=process.cwd()){
 const runtime=resolve(root,'.sites-runtime/local-dev');await mkdir(runtime,{recursive:true});
 const config=resolve(runtime,'wrangler.json'),file=resolve(runtime,'opening-hours.sql');
 await writeFile(config,JSON.stringify({name:'riparim-local-seed',compatibility_date:'2026-05-15',d1_databases:[{binding:'DB',database_name:'site-creator-d1',database_id:'00000000-0000-4000-8000-000000000000',remote:false}]}));
 await writeFile(file,await localOpeningHoursSeedSql(root));
 const result=spawnSync(process.execPath,['--import',resolve(root,'scripts/sites-env.mjs'),resolve(root,'node_modules/wrangler/bin/wrangler.js'),'d1','execute','DB','--local','--config',config,'--persist-to',resolve(root,'.wrangler/state'),'--file',file],{cwd:root,encoding:'utf8'});
 await writeFile(resolve(runtime,'seed.log'),`${result.stdout??''}\n${result.stderr??''}`);
 if(result.error||result.status!==0)throw Error('Local D1 seed failed. Prepare the local database as described in README.md; see .sites-runtime/local-dev/seed.log.');
 console.log('Local development: catalogue and default opening hours prepared.');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)await seedLocalOpeningHours();
