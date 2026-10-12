import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdir,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';

const output='.test-runtime/node-evidence';await mkdir(output,{recursive:true});
const bundled=await build({stdin:{contents:`export {createNodeStorage} from './lib/runtime/node-storage';export {migrateNode} from './lib/runtime/node-migrations';export {deleteAccount} from './lib/auth/delete-account';export * as visits from './app/api/visits/route';export * as download from './app/api/evidence/[id]/route';export {requestWorkshopClaim} from './lib/business';export * as claimDownload from './app/api/business/evidence/[id]/route';`,resolveDir:process.cwd(),loader:'ts'},outfile:output+'/app.mjs',bundle:true,write:false,format:'esm',platform:'node',plugins:[{name:'synthetic-auth',setup(builder){
 builder.onResolve({filter:/^@\/lib\/runtime\/env$/},args=>({path:args.path,namespace:'fixture'}));
 builder.onResolve({filter:/^@\/app\/auth$/},args=>({path:args.path,namespace:'fixture'}));
 builder.onLoad({filter:/.*/,namespace:'fixture'},args=>({loader:'js',contents:args.path.endsWith('/env')?'export const env=new Proxy({}, {get:(_target,key)=>globalThis.fixtureEnv[key]});':`export async function getAppUser(){return globalThis.fixtureUser;}export async function getAdminUser(user){return user??globalThis.fixtureUser;}export function ownerPair(user){return [user.userId,user.userId];}export function ownsVisit(user,owner){return user.userId===owner;}export function providerAccountId(url,id){return 'supabase:'+new URL(url).hostname+':'+id;}`}));
}}]});await writeFile(output+'/app.mjs',bundled.outputFiles[0].contents);
const api=await import(new URL('../'+output+'/app.mjs',import.meta.url)),directory=await mkdtemp(join(tmpdir(),'riparim-node-evidence-'));
const origin='https://fixture.invalid',projectUrl='https://fixture.supabase.co',account='00000000-0000-4000-8000-000000000001',owner='supabase:fixture.supabase.co:'+account;
let storage;
try{
 api.migrateNode(directory);storage=api.createNodeStorage(directory);
 let paused,release;
 globalThis.fixtureEnv={DB:storage.db,BUCKET:{...storage.bucket,async put(key,value,options){if(options?.onlyIf&&paused){const started=paused;paused=null;started();await new Promise(resolve=>release=resolve);}return storage.bucket.put(key,value,options);}},SITE_ORIGIN:origin};
 globalThis.fixtureUser={userId:owner,ownerKeys:[owner],displayName:'Fixture Member',email:'fixture@fixture.invalid',isModerator:false};
 // Isolated synthetic public profile; the catalogue source stays unchanged.
 const canonical=JSON.parse(await readFile('data/workshops.json','utf8'));
 const marker='workshop-source:'+createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
 await storage.db.prepare('INSERT INTO catalog_state VALUES (?,?)').bind(marker,'fixture').run();
 const publicId='fixture-public';
 await storage.db.prepare("INSERT INTO workshops (id,name,city,address,phone,brands,services,specialty,description,sources,checked_at,status,updated_at) VALUES (?, 'Fictional workshop','Prishtina','Synthetic road 1','+38344123456','[]','[\"Inspektion & Wartung\"]','Synthetic','Fictional workshop for isolated integration','[]','2026-10-01','published','2026-10-01T00:00:00Z')").bind(publicId).run();
 const body=()=>{const form=new FormData();for(const [key,value] of Object.entries({id:crypto.randomUUID(),workshop:publicId,date:'2026-10-01',vehicle:'Fixture car',service:'Inspektion & Wartung',evidenceType:'Rechnung',rating:'5',review:'',consent:'true'}))form.set(key,value);form.set('file',new File(['%PDF-1.7 fictional private file'],'fixture.pdf',{type:'application/pdf'}));return form;};
 const response=await api.visits.POST(new Request(origin+'/api/visits',{method:'POST',headers:{Origin:origin},body:body()}));
 assert.equal(response.status,201);const id=(await response.json()).id;
 assert.equal((await storage.db.prepare('SELECT review FROM visits WHERE id=?').bind(id).first()).review,'','rating-only reviews use the current shared submission contract');
 const download=await api.download.GET(new Request(origin+'/api/evidence/'+id),{params:Promise.resolve({id})});
 assert.equal(download.status,200);assert.equal(download.headers.get('cache-control'),'private, no-store');assert.equal(await download.text(),'%PDF-1.7 fictional private file');
 globalThis.fixtureUser={...globalThis.fixtureUser,userId:'other'};
 assert.equal((await api.download.GET(new Request(origin+'/api/evidence/'+id),{params:Promise.resolve({id})})).status,404);
 globalThis.fixtureUser={...globalThis.fixtureUser,userId:owner};
 const started=new Promise(resolve=>paused=resolve),upload=api.visits.POST(new Request(origin+'/api/visits',{method:'POST',headers:{Origin:origin},body:body()}));
 await started;
 const auth={projectUrl,provider:"supabase",client:{async deleteUser(){return {error:null};}}};
 await api.deleteAccount(auth,account);release();
 assert.equal((await upload).status,401);
 assert.equal((await storage.bucket.list({prefix:'evidence/'+owner+'/'})).objects.length,0);
 assert.equal((await storage.db.prepare('SELECT COUNT(*) AS count FROM evidence_uploads WHERE owner=?').bind(owner).first()).count,0);
 assert.equal((await storage.db.prepare('SELECT COUNT(*) AS count FROM visits WHERE owner=?').bind(owner).first()).count,0);
 console.log('Real Node storage: private download ownership, upload inventory and account deletion fencing passed');
}finally{storage?.close();await rm(directory,{recursive:true,force:true});}
