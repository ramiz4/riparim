import {appendFileSync,existsSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {spawn} from 'node:child_process';
import {basename,join} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';

const config=JSON.parse(readFileSync('config.json','utf8'));
const record=(type,extra={})=>appendFileSync(config.events,JSON.stringify({type,pid:process.pid,...extra})+'\n');
const name=basename(process.argv[1]);
if(name==='contract.mjs'){
 if(existsSync(join(config.runtime,'stale')))throw Error('stale runtime');
 record('contract');process.exitCode=config.contractFails?9:0;
 if(config.hangContract)setInterval(()=>{},1000);
}else if(name==='grandchild.mjs'){
 process.on('SIGTERM',()=>{});record('grandchild');
 setInterval(()=>writeFileSync(join(config.runtime,'heartbeat'),'alive'),20);
}else{
 const suite=Number(name.match(/suite-(\d+)/)[1]);
 mkdirSync(config.runtime,{recursive:true});record('start',{suite});
 console.log('stdout fixture');console.error('stderr fixture');
 if(config.hang||config.fail&&!config.simpleFailure&&suite===1||config.orphan){
  spawn(process.execPath,['grandchild.mjs'],{stdio:'inherit'}).unref();
 }
 if(config.hang||config.fail&&!config.simpleFailure&&suite===1){
  process.on('SIGTERM',()=>{});setInterval(()=>{},1000);
 }else{
  const limit=config.concurrency;
  if(!config.fail&&!config.orphan&&suite<limit){
   // A handshake, rather than timing assumptions, proves the first batch overlaps.
   for(let attempt=0;attempt<250;attempt++){
    const started=readFileSync(config.events,'utf8').trim().split('\n').map(line=>JSON.parse(line)).filter(e=>e.type==='start').length;
    if(started>=Math.min(limit,config.suites.length))break;
    if(attempt===249)throw Error('first batch did not overlap');
    await delay(20);
   }
  }
  await delay(config.fail&&suite===0?200:100);record('end',{suite});
  process.exitCode=config.fail&&suite===0?7:0;
 }
}
