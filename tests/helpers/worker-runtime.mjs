import {Miniflare} from 'miniflare';

// Miniflare also serves assets through Node. Unread responses keep its loopback
// connections open even after workerd stops, delaying dispose() until timeout.
export async function withWorkerRuntime(options,run){
 const runtime=new Miniflare(options),responses=new Set(),failures=[];
 const dispatchFetch=async(...args)=>{
  const response=await runtime.dispatchFetch(...args);
  responses.add(response);
  return response;
 };
 let value;
 try{value=await run(runtime,dispatchFetch);}
 catch(error){failures.push(error);}
 const started=performance.now();
 try{
  const results=await Promise.allSettled([...responses].filter(response=>!response.bodyUsed).map(response=>response.arrayBuffer()));
  failures.push(...results.filter(result=>result.status==='rejected').map(result=>result.reason));
 }catch(error){failures.push(error);}
 finally{
  responses.clear();
  try{await runtime.dispose();console.log(`Worker resources disposed in ${(performance.now()-started).toFixed(0)}ms`);}
  catch(error){failures.push(error);}
 }
 if(failures.length===1)throw failures[0];
 if(failures.length>1)throw new AggregateError(failures,'Worker assertions or cleanup failed',{cause:failures[0]});
 return value;
}

// A failing locale must not trigger disposal while a sibling still uses workerd.
export async function settleWorkerRequests(requests){
 const results=await Promise.allSettled(requests);
 const failure=results.find(result=>result.status==='rejected');
 if(failure)throw failure.reason;
}
