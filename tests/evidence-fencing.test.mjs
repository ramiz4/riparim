import assert from 'node:assert/strict';
import {Miniflare} from 'miniflare';

// Verify the conditional-write contract against the project's actual local R2
// runtime in addition to the application-route fixtures.
const runtime=new Miniflare({modules:true,script:'export default {fetch(){return new Response("isolated evidence fixture");}}',compatibilityDate:'2026-05-15',r2Buckets:['EVIDENCE']});
let passed=0;
try{
 const bucket=await runtime.getR2Bucket('EVIDENCE'),payload=new TextEncoder().encode('fictional private evidence');
 const first=await bucket.put('evidence/fixture/first',null);
 assert(first.etag);passed++;
 const stored=await bucket.put('evidence/fixture/first',payload,{onlyIf:{etagMatches:first.etag}});
 assert(stored);passed++;
 assert.equal(await (await bucket.get('evidence/fixture/first')).text(),'fictional private evidence');passed++;
 const late=await bucket.put('evidence/fixture/late',null);
 await bucket.delete('evidence/fixture/late');
 assert.equal(await bucket.put('evidence/fixture/late',payload,{onlyIf:{etagMatches:late.etag}}),null);passed++;
 assert.equal(await bucket.head('evidence/fixture/late'),null);passed++;
 // A changed reservation is equally unable to accept a stale write.
 const replaced=await bucket.put('evidence/fixture/replaced',null);
 await bucket.put('evidence/fixture/replaced','different reservation');
 assert.equal(await bucket.put('evidence/fixture/replaced',payload,{onlyIf:{etagMatches:replaced.etag}}),null);passed++;
 console.log(JSON.stringify({localR2FencingChecksPassed:passed,productionTouched:false}));
}finally{await runtime.dispose();}
