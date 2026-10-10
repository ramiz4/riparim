import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {copyFile,mkdtemp,mkdir,readFile,rm,stat,writeFile} from 'node:fs/promises';
import {rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {setTimeout as delay} from 'node:timers/promises';

const root=await mkdtemp(join(tmpdir(),'riparim-suite-runner-'));
const fixture=fileURLToPath(new URL('./fixtures/suite-runner.mjs',import.meta.url));
const processFixture=new URL('./fixtures/suite-process.mjs',import.meta.url);
let sequence=0;
const fixtures=new Set();
function killFixture(child){
 // Nested runner fixtures own further groups; keep the regression itself safe
 // when the real npm-test runner cancels it halfway through an assertion.
 const table=spawnSync('ps',['-eo','pid=,ppid=,pgid='],{encoding:'utf8'});
 if(table.error)throw table.error;
 const rows=table.stdout.trim().split('\n').map(line=>line.trim().split(/\s+/).map(Number));
 const descendants=new Set([child.pid]);
 for(let changed=true;changed;){changed=false;for(const [pid,parent] of rows)if(descendants.has(parent)&&!descendants.has(pid)){descendants.add(pid);changed=true;}}
 const groups=new Set(rows.filter(([pid])=>descendants.has(pid)).map(([, ,group])=>group));
 for(const group of groups)try{process.kill(-group,'SIGKILL');}catch(error){if(error.code!=='ESRCH')throw error;}
}
const abort=code=>{for(const child of fixtures)killFixture(child);rmSync(root,{recursive:true,force:true});process.exit(code);};
const interrupted=()=>abort(130),terminated=()=>abort(143);
process.on('SIGINT',interrupted);process.on('SIGTERM',terminated);
async function setup({concurrency=2,count=4,contractFails=false,fail=false,hang=false,hangContract=false,orphan=false}={}){
 const cwd=join(root,String(++sequence)),runtime=join(cwd,'.test-runtime'),events=join(cwd,'events.jsonl');
 await mkdir(cwd);await mkdir(runtime);await writeFile(join(runtime,'stale'),'stale');
 const contract=join(cwd,'contract.mjs');await copyFile(processFixture,contract);
 await copyFile(processFixture,join(cwd,'grandchild.mjs'));
 const suites=[];
 for(let i=0;i<count;i++){const suite=join(cwd,`suite-${i}.mjs`);suites.push(suite);await copyFile(processFixture,suite);}
 const config=join(cwd,'config.json');await writeFile(config,JSON.stringify({cwd,runtime,events,contract,suites,concurrency,contractFails,fail,hang,hangContract,orphan}));
 return {cwd,runtime,events,config};
}
function launch(config){
 const child=spawn(process.execPath,[fixture,config],{detached:true,stdio:['ignore','pipe','pipe']});
 fixtures.add(child);
 let stdout='',stderr='';child.stdout.on('data',chunk=>{stdout+=chunk;});child.stderr.on('data',chunk=>{stderr+=chunk;});
 const result=new Promise((resolve,reject)=>{child.on('error',reject);child.on('close',(code,signal)=>resolve({code,signal,stdout,stderr}));});
 const timeout=setTimeout(()=>killFixture(child),10000);result.finally(()=>{clearTimeout(timeout);fixtures.delete(child);});
 return {child,result};
}
const records=async events=>(await readFile(events,'utf8')).trim().split('\n').map(line=>JSON.parse(line));
async function cleaned(state){await delay(50);await assert.rejects(stat(state.runtime),{code:'ENOENT'});}
async function stopped(events){
 for(const pid of new Set(events.filter(e=>e.type!=='contract').map(e=>e.pid))){
  const state=spawnSync('ps',['-o','stat=','-p',String(pid)],{encoding:'utf8'});
  if(state.error)throw state.error;
  const alive=state.stdout.trim()&&!state.stdout.trim().startsWith('Z');
  if(alive){process.kill(pid,'SIGKILL');assert.fail(`Runner left live descendant ${pid}`);}
 }
}
try{
 for(const concurrency of [2,1,4]){
  const state=await setup({concurrency}),result=await launch(state.config).result;
  assert.equal(result.code,0,result.stdout+result.stderr);const events=await records(state.events);
  assert.equal(events[0].type,'contract','i18n gate finishes before any suite starts');
  let active=0,peak=0;for(const event of events){if(event.type==='start'){active++;peak=Math.max(peak,active);}if(event.type==='end')active--;assert(active<=concurrency,'bounded suite processes');}
  assert.equal(peak,concurrency,'independent suites overlap up to the configured limit');assert.equal(active,0);
  assert.deepEqual(events.filter(e=>e.type==='start').map(e=>e.suite).sort(),[0,1,2,3]);
  if(concurrency===1)assert.deepEqual(events.filter(e=>e.type==='start').map(e=>e.suite),[0,1,2,3],'serial queue order retained');
  assert.equal(events.filter(e=>e.type==='end').length,4,'every suite executed');
  assert.match(result.stdout,/\[suite-0\.mjs\] stdout fixture/);assert.match(result.stderr,/\[suite-0\.mjs\] stderr fixture/);
  await cleaned(state);
 }
 const gated=await setup({contractFails:true}),gateResult=await launch(gated.config).result;
 assert.equal(gateResult.code,9);assert.deepEqual((await records(gated.events)).map(e=>e.type),['contract']);await cleaned(gated);
 const failed=await setup({fail:true}),failure=await launch(failed.config).result;
 await stopped(await records(failed.events));
 assert.equal(failure.code,7,failure.stdout+failure.stderr);
 assert.deepEqual((await records(failed.events)).filter(e=>e.type==='start').map(e=>e.suite).sort(),[0,1],'failure cancels siblings and queued suites');
 await cleaned(failed);
 const orphan=await setup({count:1,orphan:true}),orphanResult=await launch(orphan.config).result;
 assert.equal(orphanResult.code,0,orphanResult.stdout+orphanResult.stderr);
 await stopped(await records(orphan.events));await cleaned(orphan);
 const gateAbort=await setup({hangContract:true}),gateRunning=launch(gateAbort.config);
 for(let attempt=0;attempt<100;attempt++){
  try{if((await records(gateAbort.events)).length)break;}catch(error){if(error.code!=='ENOENT')throw error;}
  await delay(20);
 }
 gateRunning.child.kill('SIGTERM');assert.equal((await gateRunning.result).code,143);
 assert.deepEqual((await records(gateAbort.events)).map(e=>e.type),['contract']);await cleaned(gateAbort);
 for(const [signal,code] of [['SIGINT',130],['SIGTERM',143]]){
  const state=await setup({hang:true}),running=launch(state.config);
  for(let attempt=0;attempt<100;attempt++){
   try{if((await records(state.events)).filter(e=>e.type==='grandchild').length===2)break;}catch(error){if(error.code!=='ENOENT')throw error;}
   await delay(20);
  }
  assert.equal((await records(state.events)).filter(e=>e.type==='grandchild').length,2);
  running.child.kill(signal);const result=await running.result;
  await stopped(await records(state.events));assert.equal(result.code,code,result.stdout+result.stderr);await cleaned(state);
 }
 console.log('Suite runner: bounded parallelism, serial diagnostics, gate, attributed logs and cleanup passed');
}finally{
 for(const child of fixtures)killFixture(child);
 process.removeListener('SIGINT',interrupted);process.removeListener('SIGTERM',terminated);
 await rm(root,{recursive:true,force:true});
}
