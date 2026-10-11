import {build} from 'esbuild';
import {spawnSync} from 'node:child_process';
import {mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';

await mkdir('.node-runtime',{recursive:true});
await build({entryPoints:['scripts/node-command.ts'],outfile:'.node-runtime/command.mjs',bundle:true,format:'esm',platform:'node',packages:'external',alias:{'@/lib/runtime/env':resolve('lib/runtime/node-env.ts'),'next/headers':'next/headers.js','next/navigation':'next/navigation.js'}});
const built=spawnSync(process.execPath,['node_modules/next/dist/bin/next','build','--webpack'],{stdio:'inherit',env:{...process.env,NEXT_TELEMETRY_DISABLED:'1'}});
process.exitCode=built.status??1;
