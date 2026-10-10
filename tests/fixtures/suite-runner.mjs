import {readFile} from 'node:fs/promises';
import {runSuites} from '../helpers/suite-runner.mjs';

const options=JSON.parse(await readFile(process.argv[2],'utf8'));
// Test-only platform contract simulation; this is not native Windows execution.
if(options.platform)Object.defineProperty(process,'platform',{value:options.platform});
process.exitCode=await runSuites(options);
