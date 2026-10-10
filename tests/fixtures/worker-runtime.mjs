import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {withWorkerRuntime,settleWorkerRequests} from '../helpers/worker-runtime.mjs';

const mode=process.argv[2],responses=[];
const assets=await mkdtemp(join(tmpdir(),'riparim-worker-assets-'));
try{
 await writeFile(join(assets,'asset.bin'),randomBytes(2*1024*1024));
 try{
  await withWorkerRuntime({modules:true,script:`export default {async fetch(request,env){const path=new URL(request.url).pathname;if(path==='/asset.bin'){await new Promise(resolve=>setTimeout(resolve,300));return env.ASSETS.fetch(request);}return new Response('x'.repeat(512*1024),{status:path==='/missing'?404:200,headers:{'X-Fixture':'isolated'}});}};`,compatibilityDate:'2026-05-15',assets:{directory:assets,binding:'ASSETS',routerConfig:{has_user_worker:true,invoke_user_worker_ahead_of_assets:true}},outboundService:()=>new Response('Live provider access forbidden',{status:502})},async(runtime,dispatchFetch)=>{
   if(mode==='dispose-failure'){
    const dispose=runtime.dispose.bind(runtime);
    runtime.dispose=async()=>{await dispose();throw new Error('intentional fixture dispose failure');};
   }
   if(mode==='cleanup-failure'){
    // Inject a real errored Node response body at the fetch boundary.
    const dispatch=runtime.dispatchFetch;
    runtime.dispatchFetch=(input,...args)=>new URL(input).pathname==='/broken'?Promise.resolve(new Response(new ReadableStream({start(controller){controller.error(new Error('intentional fixture body failure'));}}))):dispatch(input,...args);
   }
   await settleWorkerRequests(['/missing',mode==='cleanup-failure'?'/broken':'/api','/asset.bin'].map(async path=>{
    const response=await dispatchFetch('https://fixture.test'+path);
    responses.push({path,response});
    assert.equal(response.status,path==='/missing'?404:200);
    if(path!=='/asset.bin'&&path!=='/broken')assert.equal(response.headers.get('X-Fixture'),'isolated');
    if(mode==='concurrent-failure'&&path==='/missing'){
     assert(!responses.some(entry=>entry.path==='/asset.bin'),'failure must happen while the asset sibling is unfinished');
     console.log('Assertions finished');
     assert.fail('intentional lifecycle assertion failure');
    }
   }));
   console.log('Assertions finished');
   if(mode!=='success')assert.fail('intentional lifecycle assertion failure');
  });
 }catch(error){
  const failures=error instanceof AggregateError?error.errors:[error];
  assert(failures.some(failure=>failure instanceof assert.AssertionError&&failure.message==='intentional lifecycle assertion failure'),'cleanup must retain the original assertion error');
  console.log('Original assertion retained');
  if(mode==='cleanup-failure'){
   assert(failures.length>1,'body cleanup failure must also be reported');
   console.log('Body cleanup failure retained');
  }
  if(mode==='dispose-failure'){
   assert(failures.some(failure=>failure.message==='intentional fixture dispose failure'),'dispose failure must also be reported');
   console.log('Dispose failure retained');
  }
  throw error;
 }finally{
  assert.equal(responses.length,3,'every concurrent response must finish before runtime cleanup');
  assert(responses.every(entry=>entry.response.bodyUsed),'all returned response bodies must be consumed before cleanup finishes, including assertion failures');
  console.log('Bodies consumed');
 }
 console.log('Cleanup finished');
}finally{await rm(assets,{recursive:true,force:true});}
