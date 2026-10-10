import {readFile} from 'node:fs/promises';
import {runSuites} from '../helpers/suite-runner.mjs';

const options=JSON.parse(await readFile(process.argv[2],'utf8'));
process.exitCode=await runSuites(options);
