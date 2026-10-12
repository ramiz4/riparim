import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const directory = await mkdtemp(join(tmpdir(), "riparim-release-retry-"));
const root = join(directory, "source"), remote = join(directory, "remote.git");
const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
const tag = "v1.2.3";
const publication = { tag_name: tag, draft: false, prerelease: false, assets: [
  `riparim-${tag}.tar.gz`, `riparim-${tag}.json`, `riparim-sites-${tag}.tar.gz`, `riparim-sites-${tag}.json`,
].map(name => ({ name, state: "uploaded", size: 123 })) };
try {
  await mkdir(root);
  git("init", "--initial-branch=main");
  git("config", "user.email", "fixture@example.test"); git("config", "user.name", "Release fixture");
  await writeFile(join(root, "fixture"), "verified fixture\n");
  git("add", "fixture"); git("commit", "-m", "fix: verified fixture");
  const commit = git("rev-parse", "HEAD");
  execFileSync("git", ["init", "--bare", remote], { stdio: "ignore" });
  git("remote", "add", "origin", remote); git("push", "origin", "main");
  await mkdir(join(root, "scripts")); await mkdir(join(root, "artifacts"));
  for (const name of ["release.mjs", "release-policy.mjs"]) await copyFile(resolve("scripts", name), join(root, "scripts", name));
  await writeFile(join(root, "release.config.mjs"), "export default {};\n");
  await mkdir(join(root, "node_modules/semantic-release"), { recursive: true });
  await writeFile(join(root, "node_modules/semantic-release/package.json"), JSON.stringify({ type: "module", exports: "./index.mjs" }));
  await writeFile(join(root, "node_modules/semantic-release/index.mjs"), `import {writeFile} from 'node:fs/promises';
export default async()=>{await writeFile('semantic-called','yes');return {nextRelease:{version:'1.2.4',gitTag:'v1.2.4',gitHead:process.env.GITHUB_SHA}};};`);
  for (const [provider, archive, provenance] of [["cloudflare", "riparim-worker.tar.gz", "provenance.json"], ["sites", "riparim-sites.tar.gz", "sites-provenance.json"], ["node", "riparim-node.tar.gz", "node-provenance.json"]]) {
    const bytes = Buffer.from(`${provider} verified fixture bytes`);
    await writeFile(join(root, "artifacts", archive), bytes);
    await writeFile(join(root, "artifacts", provenance), JSON.stringify({ repository: "ramiz4/riparim", commit, provider, sha256: createHash("sha256").update(bytes).digest("hex"), ...(provider === "node" ? { format: 1 } : {}), ...(provider === "sites" ? { project_id: "appgprj_6abfd028b7e48191822a15d44cbbda8d" } : {}) }));
  }
  const preload = join(root, "fixture-preload.mjs");
  await writeFile(preload, `import childProcess from 'node:child_process';import {syncBuiltinESMExports} from 'node:module';
import {appendFile} from 'node:fs/promises';
const exec=childProcess.execFileSync;
childProcess.execFileSync=(command,args,options)=>{
 if(command==='git'&&args[0]==='ls-remote'){
  if(process.env.FIXTURE_REMOTE==='fail')throw Error('fixture remote lookup failed');
  if(process.env.FIXTURE_REMOTE==='malformed')return 'invalid refs/heads/main';
  if(process.env.FIXTURE_REMOTE==='wrong-ref')return process.env.GITHUB_SHA+' refs/heads/feature';
  if(process.env.FIXTURE_REMOTE==='empty')return '';
 }
 return exec(command,args,options);
};syncBuiltinESMExports();
globalThis.fetch=async(url)=>{
 if(url!=='https://api.github.com/repos/ramiz4/riparim/releases/tags/v1.2.3')throw Error('unexpected provider request');
 await appendFile('fetch-called','lookup\\n');
 if(process.env.FIXTURE_HTTP==='network')throw Error('fixture publication lookup failed');
 return {ok:process.env.FIXTURE_HTTP!=='404',status:404,json:async()=>JSON.parse(process.env.FIXTURE_PUBLICATION)};
};`);
  const output = join(root, "outputs");
  const run = async (extra = {}) => {
    for (const file of ["outputs", "semantic-called", "fetch-called"]) await rm(join(root, file), { force: true });
    const result = spawnSync(process.execPath, ["--import", preload, "scripts/release.mjs"], { cwd: root, encoding: "utf8", env: {
      ...process.env, GITHUB_ACTIONS: "true", GITHUB_EVENT_NAME: "push", GITHUB_REF: "refs/heads/main", GITHUB_REPOSITORY: "ramiz4/riparim", GITHUB_SHA: commit,
      GITHUB_OUTPUT: output, GITHUB_TOKEN: "isolated-fixture-token", FIXTURE_PUBLICATION: JSON.stringify(publication), ...extra,
    } });
    return { ...result, outputs: await readFile(output, "utf8").catch(error => { if (error.code === "ENOENT") return ""; throw error; }), published: await readFile(join(root, "semantic-called"), "utf8").then(() => true, error => { if (error.code === "ENOENT") return false; throw error; }) };
  };
  git("tag", tag);
  for (const message of ["docs: newer maintenance", "chore: newer tooling"]) {
    git("checkout", "main"); await writeFile(join(root, "fixture"), message); git("add", "fixture"); git("commit", "-m", message); git("push", "origin", "main"); git("checkout", "--detach", commit);
    const retry = await run();
    assert.equal(retry.status, 0, retry.stderr);
    assert.equal(retry.outputs, `released=true\nversion=1.2.3\ntag=${tag}\ncommit=${commit}\ndeployment_target=cloudflare\n`, "a full workflow retry must retain a published release after newer docs/chore main");
    assert.equal(retry.published, false, "retries must reuse the tag without invoking semantic publication");
  }
  for (const extra of [{ FIXTURE_HTTP: "404" }, { FIXTURE_HTTP: "network" }, { FIXTURE_PUBLICATION: JSON.stringify({ ...publication, draft: true }) }, { FIXTURE_PUBLICATION: JSON.stringify({ ...publication, assets: publication.assets.slice(0, 3) }) }, { FIXTURE_PUBLICATION: JSON.stringify({ ...publication, body: "<!-- riparim-release: node-v1 -->" }) }]) {
    const incomplete = await run(extra); assert.notEqual(incomplete.status, 0); assert.equal(incomplete.outputs, ""); assert.equal(incomplete.published, false);
  }
  const partialNode = await run({ FIXTURE_PUBLICATION: JSON.stringify({ ...publication, assets: [...publication.assets, { name: `riparim-node-${tag}.tar.gz`, state: "uploaded", size: 123 }] }) }); assert.notEqual(partialNode.status, 0); assert.equal(partialNode.outputs, "");
  const completeNode = await run({ FIXTURE_PUBLICATION: JSON.stringify({ ...publication, body: "<!-- riparim-release: node-v1 -->", assets: [...publication.assets, { name: `riparim-node-${tag}.tar.gz`, state: "uploaded", size: 123 }, { name: `riparim-node-${tag}.json`, state: "uploaded", size: 123 }] }) }); assert.equal(completeNode.status, 0, completeNode.stderr);
  // The checked source configuration defines publication completeness even if
  // a failed/manual publication omitted both its marker and all Node assets.
  await copyFile(resolve("release.config.mjs"), join(root, "release.config.mjs"));
  for (const target of ["cloudflare", "node"]) {
    const incompleteCurrent = await run({ DEPLOYMENT_TARGET: target });
    assert.notEqual(incompleteCurrent.status, 0, "current Node release configuration must reject four remote assets without a marker");
    assert.equal(incompleteCurrent.outputs, ""); assert.equal(incompleteCurrent.published, false);
    assert.match(incompleteCurrent.stderr, /complete Node archive and provenance/);
    const completeCurrent = await run({ DEPLOYMENT_TARGET: target, FIXTURE_PUBLICATION: JSON.stringify({ ...publication, assets: [...publication.assets, { name: `riparim-node-${tag}.tar.gz`, state: "uploaded", size: 123 }, { name: `riparim-node-${tag}.json`, state: "uploaded", size: 123 }] }) });
    assert.equal(completeCurrent.status, 0, completeCurrent.stderr); assert.equal(completeCurrent.published, false);
    assert.match(completeCurrent.outputs, /released=true/); assert(completeCurrent.outputs.includes(`deployment_target=${target}`));
  }
  await writeFile(join(root, "release.config.mjs"), "export default {};\n");
  const historical = await run(); assert.equal(historical.status, 0, historical.stderr); assert.match(historical.outputs, /released=true/); assert.equal(historical.published, false);
  const provenancePath = join(root, "artifacts/provenance.json"), verifiedProvenance = await readFile(provenancePath, "utf8");
  await writeFile(provenancePath, JSON.stringify({ ...JSON.parse(verifiedProvenance), commit: "f".repeat(40) }));
  const wrongBuild = await run(); assert.notEqual(wrongBuild.status, 0); assert.equal(wrongBuild.outputs, ""); assert.equal(wrongBuild.published, false);
  await assert.rejects(readFile(join(root, "fetch-called")), error => error.code === "ENOENT", "invalid build provenance must stop before a publication lookup");
  await writeFile(provenancePath, verifiedProvenance);
  git("tag", "v1.2.4"); const ambiguous = await run(); assert.notEqual(ambiguous.status, 0); assert.match(ambiguous.stderr, /Multiple version tags/); git("tag", "-d", "v1.2.4");
  git("tag", "-d", tag);
  const stale = await run(); assert.equal(stale.status, 0, stale.stderr); assert.equal(stale.outputs, "released=false\n"); assert.equal(stale.published, false);
  for (const mode of ["fail", "malformed", "empty", "wrong-ref"]) {
    const failure = await run({ FIXTURE_REMOTE: mode }); assert.notEqual(failure.status, 0, `remote ${mode} must fail rather than appear superseded`); assert.equal(failure.outputs, ""); assert.equal(failure.published, false);
  }
  execFileSync("git", ["--git-dir", remote, "update-ref", "refs/heads/main", commit]); // Only the owned, temporary local bare fixture.
  const invalidTarget = await run({ DEPLOYMENT_TARGET: "unknown-host" }); assert.notEqual(invalidTarget.status, 0); assert.equal(invalidTarget.published, false); assert.equal(invalidTarget.outputs, "");
  const nodeTarget = await run({ DEPLOYMENT_TARGET: "node", CLOUDFLARE_API_TOKEN: "", CLOUDFLARE_WORKER_SECRETS: "" }); assert.equal(nodeTarget.status, 0, nodeTarget.stderr); assert.match(nodeTarget.outputs, /deployment_target=node\n/); assert.equal(nodeTarget.published, true);
  const current = await run(); assert.equal(current.status, 0, current.stderr); assert.equal(current.published, true); assert.equal(current.outputs, `released=true\nversion=1.2.4\ntag=v1.2.4\ncommit=${commit}\ndeployment_target=cloudflare\n`);
  git("push", "origin", "main"); // Simulate another merge before the next publication decision.
  const supersededAgain = await run(); assert.equal(supersededAgain.status, 0, supersededAgain.stderr); assert.equal(supersededAgain.outputs, "released=false\n"); assert.equal(supersededAgain.published, false);
  console.log("Release CLI: exact published retries survive docs/chore main; obsolete untagged sources, incomplete publications and remote errors are handled safely; no provider operations executed.");
} finally { await rm(directory, { recursive: true, force: true }); }
