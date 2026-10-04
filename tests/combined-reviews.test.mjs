import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {DatabaseSync} from 'node:sqlite';
const {build}=createRequire(new URL('../package.json',import.meta.url))('esbuild');
const output='.test-runtime/combined-reviews';
const result=await build({entryPoints:['app/api/visits/route.ts','app/api/reviews/route.ts','app/api/evidence/[id]/route.ts','db/directory.ts'],outdir:output,bundle:true,write:false,format:'esm',platform:'node',plugins:[{name:'fixture-boundaries',setup(b){b.onResolve({filter:/^(cloudflare:workers|@\/app\/auth)$/},a=>({path:a.path,namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},a=>({loader:'js',contents:a.path==='cloudflare:workers'?'export const env=globalThis.fixtureEnv;':`export async function getAppUser(){return globalThis.fixtureUser;} export async function getAdminUser(u){return u??globalThis.fixtureUser;} export function ownsVisit(u,o){return u.ownerKeys.includes(o);} export function ownerPair(u){return [u.ownerKeys[0],u.ownerKeys[1]??u.ownerKeys[0]];}`}));}}]});
for(const f of result.outputFiles){await mkdir(f.path.slice(0,f.path.lastIndexOf('/')),{recursive:true});await writeFile(f.path.replace(/\.js$/,'.mjs'),f.contents);}
const sqlite=new DatabaseSync(':memory:');for(const f of (await readdir('drizzle')).filter(f=>f.endsWith('.sql')).sort())sqlite.exec(await readFile('drizzle/'+f,'utf8'));
const d1={prepare(sql){const statement=sqlite.prepare(sql);const adapter=(values=[])=>({bind:(...v)=>adapter(v),first:async()=>statement.get(...values)??null,all:async()=>({results:statement.all(...values)}),run:async()=>({meta:statement.run(...values)})});return adapter();},async batch(statements){return Promise.all(statements.map(s=>s.run()));}};
const objects=new Map();let blockedKey=null,releaseDelete,deleteStarted;
let failDeleteKey=null,pausePutPrefix=null,putStarted,releasePut;const listCalls=[];
const bucket={
 async put(key,bytes,options){if(pausePutPrefix&&key.startsWith(pausePutPrefix)){pausePutPrefix=null;putStarted(key);await new Promise(resolve=>releasePut=resolve);}objects.set(key,{bytes,options});},
 async head(key){return objects.has(key)?{key}:null;},
 async get(key){const v=objects.get(key);return v?{body:v.bytes,httpMetadata:v.options.httpMetadata}:null;},
 async delete(keys){for(const key of Array.isArray(keys)?keys:[keys]){if(key===failDeleteKey){failDeleteKey=null;throw Error('Fixture R2 deletion failure');}if(key===blockedKey){deleteStarted?.();await new Promise(r=>releaseDelete=r);blockedKey=null;}objects.delete(key);}},
 async list({prefix,limit=100,cursor}){listCalls.push({prefix,cursor});const after=cursor?atob(cursor):'',keys=[...objects.keys()].filter(key=>key.startsWith(prefix)&&key>after).sort(),page=keys.slice(0,limit),truncated=keys.length>page.length;return {objects:page.map(key=>({key})),truncated,cursor:truncated?btoa(page.at(-1)):undefined};}
};
globalThis.fixtureEnv={DB:d1,BUCKET:bucket,SITE_ORIGIN:'https://fixture.example',REVIEW_MODERATOR_EMAIL:'admin@example.test'};
const roles={guest:null,a:{userId:'a',ownerKeys:['a'],email:'a@example.test',displayName:'Fixture A',provider:'Fixture',isModerator:false},b:{userId:'b',ownerKeys:['b'],email:'b@example.test',displayName:'Fixture B',provider:'Fixture',isModerator:false},admin:{userId:'admin',ownerKeys:['admin'],email:'admin@example.test',displayName:'Fixture Admin',provider:'Fixture',isModerator:true}};
const load=f=>import(new URL(output+'/'+f,'file://'+process.cwd()+'/').href);
const visits=await load('app/api/visits/route.mjs'),reviews=await load('app/api/reviews/route.mjs'),evidence=await load('app/api/evidence/[id]/route.mjs'),directory=await load('db/directory.mjs');
const workshop=(await directory.listWorkshops())[0].id;let passed=0;
function check(v,label){assert(v,label);passed++;}
async function expect(r,status,label){assert.equal(r.status,status,label+': '+await r.clone().text());passed++;return r;}
function form(id,{file=false,review=true,proof=true,consent=true,revision=0,keep=false,text='The work was completed carefully and clearly explained to me.'}={}){const f=new FormData();for(const [k,v] of Object.entries({id,workshop,date:'2026-10-02',vehicle:'Fixture Car 2020',service:'Inspektion & Wartung',evidenceType:file?'Rechnung':'Anderer Nachweis',evidenceNote:proof?'Dated repair photographs and the written repair record show the workshop, visit date and completed work.':'',name:'Fixture Reviewer',rating:'4',revision:String(revision),keepEvidence:String(keep)}))f.set(k,v);if(review)f.set('review',text);if(consent)f.set('consent','true');if(file&&proof)f.set('file',new File([new Uint8Array([137,80,78,71,13,10,26,10])],'fixture.png',{type:'image/png'}));return f;}
async function call(method,role='a',body,path='/api/visits',origin='https://fixture.example'){globalThis.fixtureUser=roles[role];return visits[method](new Request('https://fixture.example'+path,{method,headers:{Origin:origin,...(body&&!(body instanceof FormData)?{'Content-Type':'application/json'}:{})},body:body instanceof FormData?body:body?JSON.stringify(body):undefined}));}
const publicReviews=async()=>((await reviews.GET(new Request('https://fixture.example/api/reviews?workshop='+workshop))).json());
const aggregate=async()=>(await directory.listWorkshops()).find(w=>w.id===workshop);
let id=crypto.randomUUID();
await expect(await call('POST','guest',form(id)),401,'guest cannot submit');
await expect(await call('POST','a',form(id,{proof:false})),400,'review without proof rejected');
await expect(await call('POST','a',form(id,{review:false})),400,'proof without review rejected');
await expect(await call('POST','a',form(id,{consent:false})),400,'consent required by server');
await expect(await call('POST','a',form(id)),201,'combined bundle submitted');
check(sqlite.prepare('SELECT status,review,rating FROM visits WHERE id=?').get(id).status==='pending','bundle pending');
check((await publicReviews()).reviews.length===0&&(await aggregate()).count===0,'pending review excluded from public list and aggregate');
const others=await (await call('GET','b',undefined,'/api/visits')).json();check(!others.visits.some(v=>v.id===id),'other owner cannot read private bundle');
await expect(await call('PATCH','a',{action:'review',id,name:'Fixture Reviewer',rating:4,review:'An attempted direct publication must never bypass administrator review.'}),409,'legacy direct publish blocked');
const moderate=(id,status,revision,role='admin')=>call('PATCH',role,{action:'moderate',id,status,revision,note:'The review and the visit evidence were checked together.'});
await expect(await moderate(id,'published',0,'a'),403,'ordinary user cannot publish');
await expect(await moderate(id,'published',0),200,'admin publishes complete bundle');
let pub=(await publicReviews()).reviews;check(pub.length===1&&!('file_key' in pub[0])&&!('evidence_note' in pub[0])&&(await aggregate()).count===1,'published review public, evidence private');
await expect(await moderate(id,'needs_more',0),409,'stale moderation rejected');
await expect(await call('PUT','b',form(id,{revision:1})),409,'other owner cannot replace');
await expect(await call('PUT','a',form(id,{revision:1,text:'Updated review after considering the completed repair and communication.'})),200,'owner edits published bundle');
check((await publicReviews()).reviews.length===0&&(await aggregate()).count===0,'editing immediately removes public review and rating');
await expect(await moderate(id,'published',2),200,'edited bundle needs and receives fresh admin publication');
await expect(await moderate(id,'needs_more',3),200,'admin can unpublish and request revision');
await expect(await call('DELETE','a',{id}),200,'owner deletes entire bundle');
const legacy=crypto.randomUUID();await expect(await call('POST','a',form(legacy)),201,'legacy fixture starts from valid evidence');sqlite.prepare("UPDATE visits SET status='approved',review=NULL,rating=NULL,display_name=NULL WHERE id=?").run(legacy);
await expect(await moderate(legacy,'published',0),400,'incomplete legacy record cannot publish');
await expect(await call('PUT','a',form(legacy)),200,'legacy review completed through combined form');await expect(await moderate(legacy,'published',1),200,'legacy bundle published only by admin');await expect(await call('DELETE','a',{id:legacy}),200,'legacy fixture removed');
const fid=crypto.randomUUID();await expect(await call('POST','a',form(fid,{file:true})),201,'file and review submitted together');let row=sqlite.prepare('SELECT * FROM visits WHERE id=?').get(fid);
globalThis.fixtureUser=roles.b;await expect(await evidence.GET(new Request('https://fixture.example/api/evidence/'+fid),{params:Promise.resolve({id:fid})}),404,'other owner denied file');
objects.delete(row.file_key);await expect(await moderate(fid,'published',0),409,'missing stored file blocks publication');await expect(await call('PUT','a',form(fid,{proof:false,keep:true})),400,'missing retained file requires upload');
await expect(await call('PUT','a',form(fid,{file:true})),200,'owner supplies replacement file');await expect(await moderate(fid,'published',1),200,'admin can publish replacement bundle');await expect(await call('DELETE','a',{id:fid}),200,'file fixture deleted');check(objects.size===0,'all private file fixture objects removed');
const race=crypto.randomUUID();await expect(await call('POST','a',form(race,{file:true})),201,'concurrency fixture submitted');const original=sqlite.prepare('SELECT file_key FROM visits WHERE id=?').get(race).file_key;blockedKey=original;const started=new Promise(r=>deleteStarted=r);const first=call('PUT','a',form(race,{file:true,revision:0}));await started;await expect(await call('PUT','a',form(race,{file:true,revision:1})),200,'newer revision commits during old cleanup');releaseDelete();await expect(await first,200,'older cleanup completes');row=sqlite.prepare('SELECT * FROM visits WHERE id=?').get(race);check(objects.has(row.file_key)&&row.revision===2,'older cleanup preserves newest referenced evidence');await expect(await call('DELETE','a',{id:race}),200,'race fixture and full namespace removed');
const failed=crypto.randomUUID();await expect(await call('POST','a',form(failed,{file:true})),201,'retry fixture submitted');await expect(await moderate(failed,'published',0),200,'retry fixture published');
const failedKey=sqlite.prepare('SELECT file_key FROM visits WHERE id=?').get(failed).file_key,staleKey=`evidence/a/${failed}/!stale`;objects.set(staleKey,objects.get(failedKey));failDeleteKey=failedKey;
await expect(await call('DELETE','a',{id:failed}),503,'partial R2 deletion is retryable');
check(!objects.has(staleKey)&&objects.has(failedKey)&&sqlite.prepare('SELECT status FROM visits WHERE id=?').get(failed).status==='deleting','partial cleanup retains a deleting row for retry');
check((await publicReviews()).reviews.length===0&&(await aggregate()).count===0,'deletion immediately removes public review and aggregate even if storage fails');
globalThis.fixtureUser=roles.a;await expect(await evidence.GET(new Request('https://fixture.example/api/evidence/'+failed),{params:Promise.resolve({id:failed})}),404,'deleting evidence cannot be downloaded');
await expect(await call('DELETE','b',{id:failed}),404,'another owner cannot retry deletion');await expect(await call('DELETE','a',{id:failed}),200,'owner retries full cleanup');
check(!sqlite.prepare('SELECT id FROM visits WHERE id=?').get(failed)&&![...objects.keys()].some(key=>key.startsWith(`evidence/a/${failed}/`)),'retry removes row and entire evidence namespace');

const paged=crypto.randomUUID(),neighborA=crypto.randomUUID(),neighborB=crypto.randomUUID();
await expect(await call('POST','a',form(paged,{file:true})),201,'paginated fixture submitted');await expect(await call('POST','a',form(neighborA,{file:true})),201,'same-owner neighboring receipt submitted');await expect(await call('POST','b',form(neighborB,{file:true})),201,'other-owner neighboring receipt submitted');
const pagedObject=objects.get(sqlite.prepare('SELECT file_key FROM visits WHERE id=?').get(paged).file_key),neighborKeys=[neighborA,neighborB].map(id=>sqlite.prepare('SELECT file_key FROM visits WHERE id=?').get(id).file_key);
for(let i=0;i<204;i++)objects.set(`evidence/a/${paged}/stale-${String(i).padStart(3,'0')}`,pagedObject);
const beforePages=listCalls.length;await expect(await call('DELETE','a',{id:paged}),200,'all pages of old evidence are deleted');const pages=listCalls.slice(beforePages);
check(pages.length===3&&pages[1].cursor&&pages[2].cursor&&![...objects.keys()].some(key=>key.startsWith(`evidence/a/${paged}/`)),'cleanup traverses three deletion-safe R2 pages without skipping objects');
check(neighborKeys.every(key=>objects.has(key))&&[neighborA,neighborB].every(id=>sqlite.prepare('SELECT id FROM visits WHERE id=?').get(id)),'cleanup preserves other visits and owners');
await expect(await call('DELETE','a',{id:neighborA}),200,'same-owner neighbor removed');await expect(await call('DELETE','b',{id:neighborB}),200,'other-owner neighbor removed');

const deletingRace=crypto.randomUUID();await expect(await call('POST','a',form(deletingRace,{file:true})),201,'late-upload fixture submitted');pausePutPrefix=`evidence/a/${deletingRace}/`;const reachedPut=new Promise(resolve=>putStarted=resolve);
const lateEdit=call('PUT','a',form(deletingRace,{file:true,revision:0})),lateKey=await reachedPut;
await expect(await call('DELETE','a',{id:deletingRace}),200,'deletion finishes before replacement upload');releasePut();await expect(await lateEdit,409,'stale edit cannot recreate a deleted visit');
check(!objects.has(lateKey)&&!sqlite.prepare('SELECT id FROM visits WHERE id=?').get(deletingRace),'late upload is cleaned and the deleted row stays absent');

const hidden=crypto.randomUUID();await expect(await call('POST','a',form(hidden)),201,'hidden-workshop fixture submitted');sqlite.prepare("UPDATE workshops SET status='draft' WHERE id=?").run(workshop);await expect(await moderate(hidden,'published',0),409,'hidden workshop cannot publish review');await expect(await call('DELETE','a',{id:hidden}),200,'hidden fixture removed');
check(sqlite.prepare('SELECT COUNT(*) AS n FROM visits').get().n===0&&objects.size===0,'all ephemeral review and evidence data removed');
console.log(JSON.stringify({checksPassed:passed,storage:'isolated in-memory SQLite and R2 fixture',realEmailsSent:false,productionTouched:false}));
