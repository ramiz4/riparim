import assert from 'node:assert/strict';
import {mkdir,readFile,readdir,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {DatabaseSync} from 'node:sqlite';
const {build}=createRequire(new URL('../package.json',import.meta.url))('esbuild');
const out='.test-runtime/notifications';await mkdir(out,{recursive:true});
const bundle=await build({entryPoints:{visits:'app/api/visits/route.ts',queue:'app/api/notifications/route.ts',outbox:'lib/notifications/outbox.ts',email:'lib/notifications/email.ts',background:'lib/notifications/background.ts'},outdir:out,bundle:true,write:false,format:'esm',platform:'node',plugins:[{name:'notification-boundaries',setup(b){
 b.onResolve({filter:/^(cloudflare:workers|@\/app\/auth|@\/lib\/auth\/admin|@\/lib\/notifications\/background|@\/db\/directory)$/},args=>({path:args.path,namespace:'fixture'}));
 b.onLoad({filter:/.*/,namespace:'fixture'},args=>({loader:'js',contents:
 args.path==='cloudflare:workers'?'export const env=globalThis.fixtureEnv;':
 args.path==='@/app/auth'?"export async function getAppUser(){return globalThis.fixtureUser;} export async function getAdminUser(){return globalThis.fixtureAdmin;} export function providerAccountId(url,id){return 'supabase:'+new URL(url).hostname+':'+id;} export function ownerPair(user){return [user.ownerKeys[0],user.ownerKeys[1]??user.ownerKeys[0]];} export function ownsVisit(user,owner){return user.ownerKeys.includes(owner);}":
 args.path==='@/lib/auth/admin'?'export async function getAuthAdmin(){return globalThis.fixtureAuthAdmin;}':
 args.path==='@/lib/notifications/background'?'export async function triggerNotifications(options){globalThis.fixtureTriggers.push(options);}':
 'export async function publishedWorkshop(){return {id:"fixture-workshop"};}'
 }));
}}]});
for(const file of bundle.outputFiles)await writeFile(file.path.replace(/\.js$/,'.mjs'),file.contents);
const db=new DatabaseSync(':memory:');for(const file of (await readdir('drizzle')).filter(file=>file.endsWith('.sql')).sort())db.exec(await readFile('drizzle/'+file,'utf8'));
let beforeRun=null,batchTail=Promise.resolve(),failSuccessCommit=false;
const d1={prepare(sql){const statement=db.prepare(sql);const adapter=(values=[])=>({bind:(...next)=>adapter(next),first:async()=>statement.get(...values)??null,all:async()=>({results:statement.all(...values)}),run:async()=>{if(beforeRun)beforeRun(sql,values);if(failSuccessCommit&&sql.includes("state='sent'")){failSuccessCommit=false;throw Error('Fixture accepted-send acknowledgement lost');}return {meta:statement.run(...values)};}});return adapter();},batch(statements){const result=batchTail.then(async()=>{db.exec('BEGIN');try{const results=[];for(const statement of statements)results.push(await statement.run());db.exec('COMMIT');return results;}catch(e){db.exec('ROLLBACK');throw e;}});batchTail=result.catch(()=>{});return result;}};
const origin='https://riparim.example.test',projectUrl='https://fixture-project.supabase.co';
const userId='00000000-0000-4000-8000-000000000001',otherId='00000000-0000-4000-8000-000000000002';
const accountId=id=>`supabase:fixture-project.supabase.co:${id}`;
const member={userId:accountId(userId),email:'member@example.test',displayName:'Fixture Member',provider:'E-Mail',ownerKeys:[accountId(userId)],isModerator:false};
const admin={...member,userId:accountId('00000000-0000-4000-8000-000000000009'),email:'admin@example.test',isModerator:true,ownerKeys:[accountId('00000000-0000-4000-8000-000000000009')]};
let confirmedEmail='member@example.test',emailConfirmed=true,providerBlocked=false,lookupFailure=false;
const users={getUserById:async id=>({data:{user:{id,email:id===userId?confirmedEmail:'other@example.test',email_confirmed_at:emailConfirmed?'2026-10-04':null,banned_until:providerBlocked?'2099-01-01':null}},error:lookupFailure?{status:503}:null})};
globalThis.fixtureAuthAdmin={projectUrl,client:{auth:{admin:users}}};
globalThis.fixtureEnv={DB:d1,BUCKET:{head:async()=>({key:'fixture'}),delete:async()=>{},list:async()=>({objects:[],truncated:false})},SITE_ORIGIN:origin,REVIEW_MODERATOR_EMAIL:admin.email,RESEND_API_KEY:'re_fixture_secret',TRANSACTIONAL_EMAIL_FROM:'Riparim <no-reply@auth.example.test>'};
globalThis.fixtureUser=member;globalThis.fixtureAdmin=admin;globalThis.fixtureTriggers=[];
db.prepare("INSERT INTO auth_settings VALUES ('main',?,?,1,1,'2026-10-04')").run(projectUrl,'sb_publishable_fixture_key_12345678901234567890');
const [visits,queue,outbox,email,background]=await Promise.all(['visits','queue','outbox','email','background'].map(file=>import(new URL(`../${out}/${file}.mjs`,import.meta.url))));
const request=(method,body,path='/api/visits',headers={})=>new Request(origin+path,{method,headers:{Origin:origin,'Content-Type':'application/json',...headers},...(body?{body:JSON.stringify(body)}:{})});
const moderate=(id,revision=0,status='published',extra={})=>visits.PATCH(request('PATCH',{action:'moderate',id,revision,status,note:'PRIVATE moderator detail never belongs in an email.',...extra}));
const record=id=>db.prepare('SELECT * FROM visits WHERE id=?').get(id);
const event=id=>db.prepare('SELECT * FROM review_notifications WHERE visit_id=? ORDER BY revision DESC').get(id);
const fixtureVisit=(owner=member.userId)=>{const id=crypto.randomUUID();db.prepare('INSERT INTO visits (id,owner,workshop,date,vehicle,service,evidence_type,evidence_note,display_name,rating,review,status,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)').run(id,owner,'fixture-workshop','2026-10-04','PRIVATE vehicle information','Repair','Anderer Nachweis','PRIVATE confidential proof with more than forty characters for verification.','PRIVATE display name',5,'A sufficiently detailed fictional review that must not be mailed.','pending','2026-10-04T10:00:00Z');return id;};
db.prepare("INSERT INTO workshops (id,name,city,address,phone,brands,services,specialty,description,sources,checked_at,status,updated_at) VALUES ('fixture-workshop','Fiktive Werkstatt','Prishtina','Fixture Road 10','+38344123456','[]','[]','Repair','Fixture profile','[]','2026-10-04','published','2026-10-04')").run();
const sent=new Map(),attempts=[];let deliveryMode='success',pause=null,release=null;
const nativeFetch=globalThis.fetch;
globalThis.fetch=async(url,options)=>{
 assert.equal(String(url),'https://api.resend.com/emails','Email fixtures never make live provider requests');assert.equal(options.method,'POST');assert(options.headers.Authorization.startsWith('Bearer re_'));
 const key=options.headers['Idempotency-Key'],payload=JSON.parse(options.body);attempts.push({key,payload});
 if(deliveryMode==='pending'){pause?.();await new Promise(resolve=>release=resolve);}
 if(deliveryMode==='rate')return Response.json({name:'rate_limit_exceeded'},{status:429});
 if(deliveryMode==='outage')return Response.json({name:'application_error'},{status:503});
 if(deliveryMode==='rejected')return Response.json({name:'validation_error'},{status:422});
 if(deliveryMode==='conflict')return Response.json({name:'concurrent_idempotent_requests'},{status:409});
 if(sent.has(key)){assert.deepEqual(payload,sent.get(key).payload,'Retries reuse the exact immutable payload');return Response.json({id:sent.get(key).id});}
 const result={id:'fixture-provider-'+(sent.size+1),payload};sent.set(key,result);
 if(deliveryMode==='uncertain'){deliveryMode='success';throw Error('Fixture provider accepted before network failure');}
 return Response.json({id:result.id});
};
let passed=0;const check=(condition,label)=>{assert(condition,label);passed++;};
try{
 let id=fixtureVisit();let response=await moderate(id,0,'published',{to:'foreign@example.test',from:'forged@example.test'});
 check(response.ok&&record(id).status==='published'&&event(id).state==='pending','Moderation durably commits its status and a separate notification event');
 check(event(id).owner===member.userId&&event(id).revision===1&&event(id).decision==='published','The event takes owner, decision and revision exclusively from server data');
 check(!JSON.stringify(event(id)).includes('PRIVATE'),'The outbox event never copies private proof, review, display name or moderator details');
 check(globalThis.fixtureTriggers.at(-1).id===event(id).id,'Committed moderation requests separate background processing');
 check((await moderate(id)).status===409&&db.prepare('SELECT COUNT(*) AS n FROM review_notifications WHERE visit_id=?').get(id).n===1,'A repeated stale moderation request cannot create a second event');
 await outbox.processNotifications({id:event(id).id});
 check(event(id).state==='sent'&&sent.size===1&&event(id).provider_id,'Provider acceptance is persisted separately from the review decision');
 check(attempts.at(-1).payload.to[0]===confirmedEmail&&!JSON.stringify(attempts.at(-1).payload).includes('PRIVATE'),'The confirmed account receives only generic status and a safe link, ignoring recipient overrides');
 check(event(id).payload===null,'Accepted messages discard their frozen address/content payload');
 const url=new URL(attempts.at(-1).payload.text.match(/https:\/\/[^\s]+/)[0]);
 check(url.origin===origin&&url.pathname==='/anmelden'&&url.searchParams.get('weiter')===`/?besuche=1&einreichung=${id}`,'The email links to authentication and the precise owned submission without an access token');
 assert.throws(()=>email.notificationLink('unsafe-target'),/INVALID_VISIT_ID/);passed++;
 check(attempts.at(-1).payload.html.includes('lang="de"')&&attempts.at(-1).payload.html.includes('<title>')&&attempts.at(-1).payload.text,'The template has explicit language, a title, readable link text and a plain-text alternative');
 await outbox.processNotifications({id:event(id).id,force:true});check(sent.size===1&&attempts.length===1,'Completed events cannot be sent again');
 response=await visits.GET(new Request(origin+'/api/visits?id='+id));check(response.ok&&(await response.json()).visits.length===1,'The authenticated notification link selects its own single submission');
 globalThis.fixtureUser={...member,userId:accountId(otherId),ownerKeys:[accountId(otherId)]};check((await visits.GET(new Request(origin+'/api/visits?id='+id))).status===404,'A foreign account cannot use the notification link to read the submission');globalThis.fixtureUser=member;
 check((await visits.GET(new Request(origin+'/api/visits?id=invalid'))).status===400,'Malformed submission deep links are rejected');
 const failed=fixtureVisit();beforeRun=sql=>{if(sql.startsWith('UPDATE visits SET status=')){beforeRun=null;throw Error('Fixture moderation status unavailable');}};
 response=await moderate(failed);check(response.status===503&&record(failed).status==='pending'&&!event(failed),'A database failure rolls back both moderation and its reserved outbox event');
 const unauthorized=fixtureVisit(),delegated={...admin,email:'delegated@example.test'};globalThis.fixtureAdmin=delegated;db.prepare("INSERT INTO auth_account_roles VALUES (?,'admin','2026-10-04','fixture-admin')").run(delegated.userId);
 beforeRun=sql=>{if(sql.startsWith('INSERT OR IGNORE INTO review_notifications')){beforeRun=null;db.prepare('DELETE FROM auth_account_roles WHERE account_id=?').run(delegated.userId);}};
 check((await moderate(unauthorized)).status===409&&record(unauthorized).status==='pending'&&!event(unauthorized),'Revocation between authorization and the transaction prevents both the decision and its email');globalThis.fixtureAdmin=admin;
 const concurrent=fixtureVisit();const decisions=await Promise.all([moderate(concurrent),moderate(concurrent)]);
 check(decisions.filter(r=>r.ok).length===1&&db.prepare('SELECT COUNT(*) AS n FROM review_notifications WHERE visit_id=?').get(concurrent).n===1,'Concurrent decisions produce exactly one committed event');
 id=fixtureVisit();await moderate(id,0,'needs_more');const acceptedBefore=sent.size;deliveryMode='uncertain';
 await outbox.processNotifications({id:event(id).id});check(event(id).state==='pending'&&event(id).attempts===1&&sent.size===acceptedBefore+1,'An uncertain provider response retains a retryable frozen request');
 const firstPayload=event(id).payload,firstKey=event(id).id;
 await outbox.processNotifications({id:firstKey,force:true});check(event(id).state==='sent'&&sent.size===acceptedBefore+1,'Retry of a network acknowledgement loss returns the same accepted email');
 assert.deepEqual(attempts.at(-1).payload,JSON.parse(firstPayload));passed++;
 id=fixtureVisit();await moderate(id);failSuccessCommit=true;const beforeCommitLoss=sent.size;
 await outbox.processNotifications({id:event(id).id});check(event(id).state==='pending'&&sent.size===beforeCommitLoss+1,'A lost local success commit remains retryable without discarding the accepted payload');
 await outbox.processNotifications({id:event(id).id,force:true});check(event(id).state==='sent'&&sent.size===beforeCommitLoss+1,'A local acknowledgement-loss retry does not send a duplicate');
 id=fixtureVisit();await moderate(id);deliveryMode='pending';const started=new Promise(resolve=>pause=resolve),job=outbox.processNotifications({id:event(id).id});await started;
 const beforeParallel=attempts.length;await outbox.processNotifications({id:event(id).id,force:true});check(attempts.length===beforeParallel,'A fresh processing lease prevents concurrent retries from posting twice');
 release();await job;deliveryMode='success';pause=null;
 id=fixtureVisit();await moderate(id);delete globalThis.fixtureEnv.RESEND_API_KEY;const beforeMissing=attempts.length;
 await outbox.processNotifications({id:event(id).id});check(event(id).state==='blocked'&&event(id).last_error==='configuration_missing'&&attempts.length===beforeMissing,'Missing sending credentials are explicitly blocked without pretending delivery');globalThis.fixtureEnv.RESEND_API_KEY='re_fixture_secret';
 await outbox.processNotifications({id:event(id).id,force:true});check(event(id).state==='sent','Configured blocked events can be explicitly rechecked');
 id=fixtureVisit('legacy-member');db.prepare("INSERT INTO auth_links (account_id,legacy_owner,created_at) VALUES (?,'legacy-member','2026-10-04')").run(member.userId);await moderate(id);
 await outbox.processNotifications({id:event(id).id});check(event(id).state==='sent'&&attempts.at(-1).payload.to[0]===confirmedEmail,'Confirmed legacy ownership links resolve the current verified Supabase contact');
 id=fixtureVisit('unlinked-native-member');await moderate(id);const beforeNative=attempts.length;await outbox.processNotifications({id:event(id).id});
 check(event(id).state==='blocked'&&event(id).last_error==='no_verified_contact'&&attempts.length===beforeNative,'Unlinked native accounts are explicitly handled without trusting an unverified email');
 id=fixtureVisit();await moderate(id);emailConfirmed=false;await outbox.processNotifications({id:event(id).id});check(event(id).state==='blocked'&&event(id).last_error==='no_verified_contact','Unconfirmed provider contact addresses cannot receive notifications');emailConfirmed=true;
 id=fixtureVisit();await moderate(id);providerBlocked=true;const beforeBlocked=attempts.length;await outbox.processNotifications({id:event(id).id});check(event(id).state==='blocked'&&attempts.length===beforeBlocked,'Blocked provider accounts cannot receive notifications');providerBlocked=false;
 id=fixtureVisit();await moderate(id);deliveryMode='outage';await outbox.processNotifications({id:event(id).id});
 check(event(id).state==='pending'&&event(id).next_attempt_at>Date.now(),'Temporary errors schedule a future controlled retry');
 const beforeBackoff=attempts.length;await outbox.processNotifications({id:event(id).id});check(attempts.length===beforeBackoff,'Automatic processing respects its persisted backoff');
 deliveryMode='success';await outbox.processNotifications({id:event(id).id,force:true});check(event(id).state==='sent','An explicit retry can safely bypass backoff within the provider window');
 id=fixtureVisit();await moderate(id);deliveryMode='rate';await outbox.processNotifications({id:event(id).id});check(event(id).last_error==='rate_limited'&&event(id).state==='pending','Provider rate limits retain the event for controlled retry');
 deliveryMode='rejected';await outbox.processNotifications({id:event(id).id,force:true});check(event(id).state==='blocked'&&event(id).last_error==='provider_rejected','Permanent provider rejection is visible and never reported as success');deliveryMode='success';
 id=fixtureVisit();await moderate(id);deliveryMode='outage';await outbox.processNotifications({id:event(id).id});
 db.prepare('UPDATE review_notifications SET first_attempt_at=? WHERE id=?').run(Date.now()-24*3600000,event(id).id);
 const beforeExpired=attempts.length;await outbox.processNotifications({id:event(id).id,force:true});
 check(event(id).state==='unknown'&&event(id).last_error==='idempotency_window_expired'&&attempts.length===beforeExpired,'Expired deduplication windows require reconciliation and never blindly send again');deliveryMode='success';
 id=fixtureVisit();await moderate(id);deliveryMode='outage';await outbox.processNotifications({id:event(id).id});deliveryMode='success';confirmedEmail='changed@example.test';const beforeChanged=attempts.length;
 await outbox.processNotifications({id:event(id).id,force:true});check(event(id).state==='blocked'&&event(id).last_error==='recipient_changed'&&attempts.length===beforeChanged,'A changed verified address cannot receive a mutable retry under an earlier idempotency key');confirmedEmail='member@example.test';
 id=fixtureVisit();await moderate(id);deliveryMode='outage';await outbox.processNotifications({id:event(id).id});deliveryMode='success';globalThis.fixtureEnv.RESEND_API_KEY='re_different_credential';const beforeKeyChange=attempts.length;
 await outbox.processNotifications({id:event(id).id,force:true});check(event(id).last_error==='credential_changed'&&attempts.length===beforeKeyChange,'Changed credential scope cannot accidentally duplicate a previous provider request');globalThis.fixtureEnv.RESEND_API_KEY='re_fixture_secret';
 id=fixtureVisit();await moderate(id);db.prepare("UPDATE visits SET status='pending',revision=revision+1 WHERE id=?").run(id);const beforeSuperseded=attempts.length;
 await outbox.processNotifications({id:event(id).id});check(event(id).state==='suppressed'&&attempts.length===beforeSuperseded,'A superseded decision cannot send an obsolete status');
 id=fixtureVisit();await moderate(id);globalThis.fixtureAdmin=null;check((await queue.GET(request('GET',null,'/api/notifications'))).status===401,'Anonymous users cannot inspect private delivery state');
 globalThis.fixtureAdmin=member;check((await queue.GET(request('GET',null,'/api/notifications'))).status===403&&(await queue.POST(request('POST',{action:'retry',id:event(id).id},'/api/notifications'))).status===403,'Customers cannot inspect or retry another account’s events');globalThis.fixtureAdmin=admin;
 const view=await queue.GET(request('GET',null,'/api/notifications')).then(r=>r.json());
 check(view.notifications.length>0&&!JSON.stringify(view).includes('re_fixture_secret')&&!JSON.stringify(view).includes('member@example.test')&&!JSON.stringify(view).includes('payload'),'The admin queue returns useful status without secrets or recipient/content payloads');
 check((await queue.POST(request('POST',{action:'retry',id:event(id).id,to:'other@example.test'},'/api/notifications'))).status===400,'Retry actions cannot override recipient or message content');
 check((await queue.POST(request('POST',{action:'retry',id:event(id).id},'/api/notifications',{Origin:'https://other.example.test'}))).status===403,'Retry actions reject cross-origin requests');
 id=fixtureVisit();await moderate(id);const queued=event(id).id;let backgroundTask;
 await background.withNotificationContext({waitUntil:task=>backgroundTask=task},()=>background.triggerNotifications({id:queued,limit:1}));
 check(backgroundTask instanceof Promise,'Background sends are tied to the Worker execution-context lifetime');await backgroundTask;check(event(id).state==='sent','Attached background work completes the durable event');
 check((await visits.DELETE(request('DELETE',{id}))).ok&&!event(id),'Deleting a submission removes its private notification records');
 console.log(JSON.stringify({notificationChecksPassed:passed,providerMessagesAccepted:sent.size,realEmailsSent:false,productionTouched:false}));
}finally{globalThis.fetch=nativeFetch;}
