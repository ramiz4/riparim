import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {chmod,copyFile,mkdir,readFile,rm,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

// Exercise the actual CLI against a local gh fixture; never alter GitHub rules.
const runtime=new URL('../.test-runtime/repository-policy/',import.meta.url);
const policy=JSON.parse(await readFile(new URL('../.github/repository-policy.json',import.meta.url),'utf8'));
const fixturePolicy=structuredClone(policy);
const base='repos/ramiz4/riparim',responses=new URL('responses.json',runtime),calls=new URL('calls.jsonl',runtime);
const branch={enforce_admins:{enabled:true},required_pull_request_reviews:{required_approving_review_count:0},required_status_checks:{strict:false,contexts:['Tests, types, lint and build','Conventional PR title']},required_linear_history:{enabled:true}};
const fixtures={
 [base]:policy.merge,
 [base+'/branches/main/protection']:branch,
 [base+'/environments/production']:{deployment_branch_policy:{custom_branch_policies:true,protected_branches:false}},
 [base+'/environments/production/deployment-branch-policies']:{branch_policies:[{name:'main',type:'branch'}]},
};
await mkdir(new URL('bin/',runtime),{recursive:true});
await mkdir(new URL('scripts/',runtime),{recursive:true});
await mkdir(new URL('.github/',runtime),{recursive:true});
await writeFile(new URL('package.json',runtime),'{"type":"commonjs"}');
await writeFile(new URL('.github/repository-policy.json',runtime),JSON.stringify(fixturePolicy));
await copyFile(new URL('../scripts/configure-repository.mjs',import.meta.url),new URL('scripts/configure-repository.mjs',runtime));
const gh=new URL('bin/gh',runtime);
await writeFile(gh,`#!${process.execPath}
const fs=require('node:fs');
const args=process.argv.slice(2),method=args[2],path=args[3];
if(args[0]!=='api'||args[1]!=='--method')throw Error('Unexpected fixture command');
const body=args.includes('--input')?JSON.parse(fs.readFileSync(0,'utf8')):undefined;
fs.appendFileSync(process.env.RIPARIM_POLICY_CALLS,JSON.stringify({method,path,body})+'\\n');
const values=JSON.parse(fs.readFileSync(process.env.RIPARIM_POLICY_RESPONSES,'utf8'));
if(method==='GET'&&!Object.hasOwn(values,path))throw Error('Unknown fixture endpoint');
process.stdout.write(JSON.stringify(method==='GET'?values[path]:{}));
`);
await chmod(gh,0o700);
const env={...process.env,PATH:fileURLToPath(new URL('bin/',runtime))+':'+process.env.PATH,RIPARIM_POLICY_RESPONSES:fileURLToPath(responses),RIPARIM_POLICY_CALLS:fileURLToPath(calls)};
function run(check=true){return spawnSync(process.execPath,['scripts/configure-repository.mjs',...(check?['--check']:[])],{cwd:fileURLToPath(runtime),env,encoding:'utf8'});}
async function setFixtures(value){await writeFile(responses,JSON.stringify(value));}
function rejected(result){assert.notEqual(result.status,0);assert.match(result.stderr,/does not match the policy|must be restricted to the main branch/);}
try{
 await setFixtures(fixtures);
 const relaxed=run();assert.equal(relaxed.status,0,relaxed.stdout+relaxed.stderr);
 for(const strict of [true,undefined]){
  const changed=structuredClone(fixtures);changed[base+'/branches/main/protection'].required_status_checks.strict=strict;await setFixtures(changed);rejected(run());
 }
 const missingCheck=structuredClone(fixtures);missingCheck[base+'/branches/main/protection'].required_status_checks.contexts=['Conventional PR title'];await setFixtures(missingCheck);rejected(run());
 const extraBranch=structuredClone(fixtures);extraBranch[base+'/environments/production/deployment-branch-policies'].branch_policies.push({name:'codex/fixture',type:'branch'});await setFixtures(extraBranch);rejected(run());
 await setFixtures(fixtures);await writeFile(calls,'');
 const configured=run(false);assert.equal(configured.status,0,configured.stdout+configured.stderr);
 const requests=(await readFile(calls,'utf8')).trim().split('\n').map(line=>JSON.parse(line));
 const protection=requests.find(request=>request.method==='PUT'&&request.path===base+'/branches/main/protection');
 assert.equal(protection.body.required_status_checks.strict,false);
 assert.deepEqual(protection.body.required_status_checks.contexts,['Tests, types, lint and build','Conventional PR title']);
 assert.equal(protection.body.enforce_admins,true);assert.equal(protection.body.allow_force_pushes,false);assert.equal(protection.body.allow_deletions,false);
 process.stdout.write('Repository policy: relaxed branch currency accepted, drift and missing checks rejected; fixture writer preserves required protections\n');
}finally{await rm(runtime,{recursive:true,force:true});}
