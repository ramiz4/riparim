import {spawn} from 'node:child_process';
import {rm} from 'node:fs/promises';
import {basename} from 'node:path';
import {createInterface} from 'node:readline';
import {setTimeout as delay} from 'node:timers/promises';

export async function runSuites({cwd,runtime,contract,suites,concurrency=Number(process.env.TEST_CONCURRENCY??2)}){
 if(!Number.isInteger(concurrency)||concurrency<1||concurrency>4)throw Error('TEST_CONCURRENCY must be an integer from 1 to 4');
 if(process.platform==='win32')throw Error('The suite runner requires POSIX process groups (Linux or macOS)');
 const active=new Set(),started=performance.now();
 let next=0,exitCode=0;
 function signalGroup(child,signal){
  if(!child.pid)return false;
  try{process.kill(-child.pid,signal);return true;}catch(error){if(error.code==='ESRCH')return false;throw error;}
 }
 function cancel(code){
  if(!exitCode)exitCode=code;
  for(const child of active)child.stop();
 }
 const interrupted=()=>cancel(130),terminated=()=>cancel(143);
 process.on('SIGINT',interrupted);process.on('SIGTERM',terminated);
 async function run(suite){
  const label=basename(suite),started=performance.now();
  console.log(`[${label}] Running`);
  // Every suite owns its group, including Go, esbuild and workerd descendants.
  const child=spawn(process.execPath,[suite],{cwd,detached:true,stdio:['ignore','pipe','pipe']});
  let stopping;
  child.stop=()=>stopping??=Promise.resolve().then(async()=>{
   if(signalGroup(child,'SIGTERM')){await delay(500);signalGroup(child,'SIGKILL');}
  });
  active.add(child);
  for(const [stream,target] of [[child.stdout,process.stdout],[child.stderr,process.stderr]]){
   createInterface({input:stream}).on('line',line=>target.write(`[${label}] ${line}\n`));
  }
  const closed=new Promise(resolve=>child.on('close',resolve));
  const code=await new Promise(resolve=>{
   child.on('error',error=>{console.error(`[${label}] ${error.message}`);resolve(1);});
   child.on('exit',code=>resolve(code??1));
  });
  if(code)cancel(code);
  // An exited Node process can leave descendants alive or holding its pipes.
  await child.stop();await closed;active.delete(child);
  console.log(`[${label}] Finished with exit ${code} in ${(performance.now()-started).toFixed(0)}ms`);
 }
 try{
  await rm(runtime,{recursive:true,force:true});
  if(!exitCode)await run(contract);
  await Promise.all(Array.from({length:concurrency},async()=>{
   while(!exitCode&&next<suites.length)await run(suites[next++]);
  }));
  return exitCode;
 }finally{
  await Promise.all([...active].map(child=>child.stop()));
  await rm(runtime,{recursive:true,force:true});
  process.removeListener('SIGINT',interrupted);process.removeListener('SIGTERM',terminated);
  console.log(`Test suites finished with concurrency ${concurrency} and exit ${exitCode} in ${(performance.now()-started).toFixed(0)}ms`);
 }
}
