import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const run = args => execFileSync(process.execPath, args, {cwd: root, stdio: 'inherit', env: {...process.env, WRANGLER_SEND_METRICS: 'false'}});
run([join(root, 'scripts/backup-monitor-types.mjs'), '--check']);
run([join(root, 'node_modules/typescript/bin/tsc'), '--project', 'monitor/tsconfig.json']);
run([join(root, 'node_modules/wrangler/bin/wrangler.js'), 'deploy', '--dry-run', '--config', 'wrangler.backup-monitor.jsonc', '--outdir', 'outputs/backup-monitor-worker']);
