import {spawnSync} from 'node:child_process';
import {rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
const runtime=new URL('../.test-runtime/',import.meta.url);
const suites=['combined-reviews.test.mjs','auth-ownership.test.mjs','google-auth.test.mjs','catalogue-filters.test.mjs','workshop-import.test.mjs'];

try{
 await rm(runtime,{recursive:true,force:true});
 for(const suite of suites){
  console.log(`\nRunning ${suite}`);
  const result=spawnSync(process.execPath,[fileURLToPath(new URL(suite,import.meta.url))],{cwd:root,stdio:'inherit'});
  if(result.error)throw result.error;
  if(result.status!==0){process.exitCode=result.status??1;break;}
 }
}finally{
 await rm(runtime,{recursive:true,force:true});
}
