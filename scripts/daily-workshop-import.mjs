import {mkdir,readFile,writeFile,rename,rm} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {localizeHref} from './lib/locale.mjs';

// The common Git directory is shared by every task worktree on this host.
export async function acquireRun(lockPath,owner){
 await mkdir(lockPath);
 const run={token:randomUUID(),owner,startedAt:new Date().toISOString()};
 try{await writeFile(join(lockPath,'run.json'),JSON.stringify(run,null,2)+'\n',{flag:'wx',mode:0o600});}
 catch(error){await rm(lockPath,{recursive:true,force:true});throw error;}
 return run;
}
export async function releaseRun(lockPath,token){
 const run=JSON.parse(await readFile(join(lockPath,'run.json'),'utf8'));
 if(!token||run.token!==token)throw Error('Run lock owner does not match');
 const released=lockPath+'.released-'+randomUUID();
 await rename(lockPath,released);
 await rm(released,{recursive:true});
}
export async function checkLive({origin='https://riparim.com',profileIds=[],request=fetch}={}){
 const checks=[];
 const api=await request(origin+'/api/workshops',{signal:AbortSignal.timeout(30000)});
 if(!api.ok)throw Error(`Live catalogue HTTP ${api.status}`);
 const body=await api.json();
 if(!Array.isArray(body.workshops)||!body.workshops.length)throw Error('Live catalogue is empty or invalid');
 const ids=new Set();
 for(const w of body.workshops){
  if(typeof w.id!=='string'||ids.has(w.id)||w.status!=='published')throw Error('Live catalogue has duplicate IDs or non-public entries');
  ids.add(w.id);
 }
 const selected=profileIds.length?profileIds:body.workshops.slice(0,2).map(w=>w.id);
 for(const id of selected)if(!ids.has(id))throw Error(`Published profile missing: ${id}`);
 for(const locale of ['de','sq','en']){
  for(const path of ['/werkstaetten',...selected.map(id=>'/werkstatt/'+id)]){
   const localized=localizeHref(path,locale),response=await request(origin+localized,{signal:AbortSignal.timeout(30000)});
   const html=await response.text();
   const profileId=path.startsWith("/werkstatt/")?path.slice(11):null,profile=profileId?body.workshops.find(w=>w.id===profileId):null;
   const expectedName=profile&&typeof profile.name==="string"?profile.name.replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#x27;"):null;
   const check={path:localized,status:response.status,bytes:Buffer.byteLength(html),ray:response.headers.get('cf-ray'),error1102:/Error\s*1102|Worker exceeded resource limits/i.test(html),complete:/<\/html>\s*$/.test(html),locale:html.includes(`lang="${locale}"`),heading:/<h1(?:\s|>)/.test(html),shell:html.includes("data-public-profile-id="),profileIdentity:!profileId||(html.includes(`data-workshop-id="${profileId}"`)&&expectedName!==null&&html.includes(expectedName))};
   checks.push(check);
  }
 }
 return {checkedAt:new Date().toISOString(),published:ids.size,checks,healthy:checks.every(c=>c.status===200&&!c.error1102&&c.complete&&c.locale&&c.heading&&c.profileIdentity)};
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const [action,...args]=process.argv.slice(2);
 try{
  if(action==='health'){
   const result=await checkLive({profileIds:args});
   console.log(JSON.stringify(result,null,2));
   if(!result.healthy)process.exitCode=1;
  }else{
   const common=execFileSync('git',['rev-parse','--path-format=absolute','--git-common-dir'],{encoding:'utf8'}).trim();
   const lockPath=join(common,'daily-workshop-import.lock');
   if(action==='acquire'){
    if(args.length!==1||!args[0].trim())throw Error('acquire requires an owner chat/run ID');
    console.log(JSON.stringify(await acquireRun(lockPath,args[0]),null,2));
   }else if(action==='status'){
    try{console.log(await readFile(join(lockPath,'run.json'),'utf8'));}
    catch(error){if(error.code==='ENOENT')console.log(JSON.stringify({locked:false}));else throw error;}
   }else if(action==='release'){
    if(args.length!==1)throw Error('release requires the matching run token');
    await releaseRun(lockPath,args[0]);console.log(JSON.stringify({released:true}));
   }else throw Error('Usage: daily-workshop-import.mjs acquire <owner> | status | release <token> | health [profile IDs]');
  }
 }catch(error){console.error(error.message);process.exitCode=1;}
}
