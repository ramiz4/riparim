import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import releaseConfig from '../release.config.mjs';

// Offline smoke for separately installed job trees; never publish or query providers.
const tool=process.argv[2];
if(tool==='title'){
 const cases=[['fix: correct search',true],['feat(catalogue): add filters',true],['feat(api)!: replace response',true],['fix: change API\n\nBREAKING CHANGE: remove old response',true],['Update search',false],['unknown: change search',false],['Fix: change search',false],['fix:',false],['fix: Change Search',false],['fix: add search.',false],['fix: '+'x'.repeat(101),false],['fix: update search\nbody without blank separator',true]];
 for(const [message,valid] of cases){
  const result=spawnSync(process.execPath,['node_modules/@commitlint/cli/cli.js','--config','commitlint.config.mjs'],{input:message,encoding:'utf8'});
  assert.equal(result.status===0,valid,JSON.stringify(message)+' '+result.stdout+result.stderr);
  if(message.includes('body without blank separator'))assert.match(result.stdout,/body-leading-blank/);
 }
}else if(tool==='release'){
 for(const [plugin] of releaseConfig.plugins)assert(await import(plugin));
 assert(await import('semantic-release'));
 const {analyzeCommits}=await import('@semantic-release/commit-analyzer');
 const {generateNotes}=await import('@semantic-release/release-notes-generator');
 const context={cwd:process.cwd(),logger:{log(){}},options:releaseConfig};
 for(const [message,expected] of [['fix: repair search','patch'],['perf: accelerate CI','patch'],['feat: add filters','minor'],['feat!: replace API','major'],['docs: update guide',null]])assert.equal(await analyzeCommits(releaseConfig.plugins[0][1],{...context,commits:[{message,hash:'a'.repeat(40)}]}),expected);
 const notes=await generateNotes(releaseConfig.plugins[1][1],{...context,commits:[{message:'feat!: replace API\n\nBREAKING CHANGE: migrate clients',hash:'a'.repeat(40)}],lastRelease:{gitTag:'v1.0.0'},nextRelease:{version:'2.0.0',gitTag:'v2.0.0'}});
 assert.match(notes,/BREAKING CHANGES/);assert.match(notes,/migrate clients/);
}else if(tool==='deploy'){
 const root=JSON.parse(await readFile('package.json','utf8'));
 for(const name of ['wrangler','esbuild'])assert.equal(JSON.parse(await readFile(`node_modules/${name}/package.json`,'utf8')).version,root.devDependencies[name]);
 const cli=spawnSync(process.execPath,['node_modules/wrangler/bin/wrangler.js','--version'],{encoding:'utf8',env:{...process.env,CI:'true',WRANGLER_SEND_METRICS:'false',WRANGLER_WRITE_LOGS:'false'}});
 assert.equal(cli.status,0,cli.stdout+cli.stderr);assert(cli.stdout.includes(root.devDependencies.wrangler));
 const {catalogueReleasePlan}=await import('./catalogue-release-plan.mjs');
 const catalogue=JSON.parse(await readFile('data/workshops.json','utf8'));
 const plan=await catalogueReleasePlan(catalogue,'a'.repeat(40));
 assert.equal(plan.commit,'a'.repeat(40));assert(plan.statements.length>=catalogue.workshops.length);
}else throw Error('Choose title, release or deploy.');
console.log(`${tool}: offline installed-tool smoke passed.`);
