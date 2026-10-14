import { mkdir, writeFile } from "node:fs/promises";
import { isAbsolute, join } from "node:path";

// Deployment installs deliberately retain only PATH/HOME/TMPDIR. Pin the cache
// at the npm process boundary so those real target installs remain isolated too.
export async function createNpmCacheWrapper({
  directory,
  cache,
  cli,
  log,
  targetCli = cli,
  targetPackage = null,
  rootVersion = null,
}) {
  if (
    ![directory, cache, cli, log, targetCli].every(isAbsolute) ||
    (targetPackage && !isAbsolute(targetPackage))
  )
    throw Error("Benchmark npm wrapper paths must be absolute.");
  await mkdir(directory, { recursive: true });
  const wrapper = join(directory, "npm");
  await writeFile(
    wrapper,
    `#!${process.execPath}
import { spawnSync } from 'node:child_process';
import { appendFileSync, readFileSync } from 'node:fs';
const args = process.argv.slice(2), cache = ${JSON.stringify(cache)};
if (args.some((arg) => arg === '--cache' || arg.startsWith('--cache=')))
  throw Error('Benchmark commands cannot override the isolated npm cache.');
const inheritedCache = process.env.NPM_CONFIG_CACHE ?? process.env.npm_config_cache ?? null;
const targetInstall = args[0] === 'ci' && inheritedCache === null;
const cli = targetInstall ? ${JSON.stringify(targetCli)} : ${JSON.stringify(cli)};
const targetPackage = ${JSON.stringify(targetPackage)};
const version = targetInstall && targetPackage ? JSON.parse(readFileSync(targetPackage,'utf8')).version : ${JSON.stringify(rootVersion)};
appendFileSync(${JSON.stringify(log)}, JSON.stringify({
  command: args[0], cache, inheritedCache, cli, version,
}) + '\\n');
const result = spawnSync(process.execPath, [cli, '--cache', cache, ...args], {
  stdio: 'inherit', env: {...process.env, NPM_CONFIG_CACHE: cache, npm_config_cache: cache},
});
if (result.error) throw result.error;
process.exit(result.status ?? 1);
`,
    { mode: 0o700 },
  );
  return wrapper;
}
