import {lstat, readFile, symlink} from 'node:fs/promises';
import {resolve, relative} from 'node:path';
import {isDeepStrictEqual} from 'node:util';
import {runNpmInstall} from './npm-install.mjs';

const tool=process.argv[2];
if(!['title','release','deploy'].includes(tool))throw Error('Choose title, release or deploy.');
if(!process.env.npm_execpath)throw Error('Run this installer with npm run install:tool.');
const root=process.cwd(),target=resolve(root,'.github/tools',tool),modules=resolve(root,'node_modules');
try {await lstat(modules);throw Error('Root node_modules already exists; use a clean tool-job checkout.');}
catch(error){if(error.code!=='ENOENT')throw error;}
const readJson=async path=>JSON.parse(await readFile(path,'utf8'));
const app=await readJson(resolve(root,'package.json'));
const manifest=await readJson(resolve(target,'package.json'));
for(const [name,version] of Object.entries(manifest.dependencies)) {
 if(!/^\d+\.\d+\.\d+$/.test(version)||app.devDependencies[name]!==version)throw Error(`${name} must match its exact root pin.`);
}
if(!isDeepStrictEqual(manifest.overrides??{},tool==='deploy'?app.overrides:{}))throw Error('Tool overrides must match the root dependency policy.');
const lock=await readJson(resolve(target,'package-lock.json'));
if(lock.lockfileVersion!==3||!isDeepStrictEqual(lock.packages?.['']?.dependencies,manifest.dependencies))throw Error('Tool lock does not match its manifest.');
for(const [name,version] of Object.entries(manifest.dependencies)) {
 if(lock.packages?.[`node_modules/${name}`]?.version!==version)throw Error(`${name} lock must match its exact root pin.`);
}
// Preserve the portable app installer's native-binary policy for Wrangler's sharp.
if(!['SHARP_IGNORE_GLOBAL_LIBVIPS','SHARP_FORCE_GLOBAL_LIBVIPS','npm_config_build_from_source','NPM_CONFIG_BUILD_FROM_SOURCE'].some(key=>key in process.env))process.env.SHARP_IGNORE_GLOBAL_LIBVIPS='1';
const installed=await runNpmInstall([process.execPath,process.env.npm_execpath,'ci','--prefix',target,'--workspaces=false','--include=dev','--include=optional','--prefer-offline','--no-audit','--no-fund']);
if(installed.signal)process.kill(process.pid,installed.signal);
if(installed.code!==0||installed.signal)process.exit(installed.code||1);
// Existing root ESM configs and deployment CLI paths resolve the selected tree.
await symlink(process.platform==='win32'?resolve(target,'node_modules'):relative(root,resolve(target,'node_modules')),modules,process.platform==='win32'?'junction':'dir');
