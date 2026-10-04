import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { appendFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { assertCloudflareDeployConfig, assertCloudflareDeployContext, assertCloudflareProvenance, assertSafeTarListing, cloudflareProduction, isNewerPublishedRelease, parseWorkerSecrets } from "./cloudflare-deploy-policy.mjs";

function runCommand(command, args, options) {
  const result = spawnSync(command, args, { ...options, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 16 * 1024 * 1024 });
  // Provider diagnostics can contain configuration or secret values. Keep them
  // out of Actions logs and expose only the failed operation to the caller.
  if (result.error || result.status !== 0) throw new Error(`${basename(command)} failed (exit ${result.status ?? "unavailable"}).`);
  return result.stdout;
}

export async function deployCloudflare({ env = process.env, root = fileURLToPath(new URL("../", import.meta.url)), run = runCommand, request = fetch } = {}) {
  const options = { cwd: root, env: { ...env, CI: "true", WRANGLER_SEND_METRICS: "false", WRANGLER_WRITE_LOGS: "false" } };
  delete options.env.CLOUDFLARE_WORKER_SECRETS;
  delete options.env.GITHUB_TOKEN;
  delete options.env.GH_TOKEN;
  const commit = run("git", ["rev-parse", "HEAD"], options).trim();
  // Validate context before using the release tag in any command argument.
  assertCloudflareDeployContext(env, commit, commit);
  const tagCommit = run("git", ["rev-parse", "--verify", `refs/tags/${env.RELEASE_TAG}^{commit}`], options).trim();
  assertCloudflareDeployContext(env, commit, tagCommit);
  const newerPublishedRelease = async () => {
    if (!env.GITHUB_TOKEN) throw new Error("A read-only GitHub token is required to verify release ordering.");
    let release;
    try {
      const response = await request("https://api.github.com/repos/ramiz4/riparim/releases/latest", {
        headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${env.GITHUB_TOKEN}` },
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) throw new Error("The GitHub release lookup failed.");
      release = await response.json();
    } catch {
      throw new Error("The latest published GitHub release could not be verified.");
    }
    return isNewerPublishedRelease(release, env.RELEASE_TAG);
  };
  // Main may have advanced with docs/chore commits that create no release. Only
  // a newer complete publication supersedes these already verified build bytes.
  if (await newerPublishedRelease()) {
    console.log("A newer published release exists; this deployment is superseded.");
    return { deployed: false, reason: "superseded" };
  }

  const apiToken = env.CLOUDFLARE_API_TOKEN || env.CF_API_TOKEN;
  if (!apiToken) throw new Error("A Cloudflare API token is required for production deployment.");
  options.env.CLOUDFLARE_API_TOKEN = apiToken;
  options.env.CLOUDFLARE_ACCOUNT_ID = cloudflareProduction.account;
  const expectedVersion = JSON.parse(await readFile(join(root, "package.json"), "utf8")).devDependencies?.wrangler;
  const version = JSON.parse(await readFile(join(root, "node_modules/wrangler/package.json"), "utf8")).version;
  if (typeof expectedVersion !== "string" || !/^\d+\.\d+\.\d+$/.test(expectedVersion) || version !== expectedVersion) throw new Error("Production deployment requires the exact Wrangler version pinned in package.json.");
  const cli = join(root, "node_modules/wrangler/bin/wrangler.js");
  const archive = join(root, "artifacts/riparim-worker.tar.gz");
  const sha256 = createHash("sha256").update(await readFile(archive)).digest("hex");
  const provenance = JSON.parse(await readFile(join(root, "artifacts/provenance.json"), "utf8"));
  assertCloudflareProvenance(provenance, commit, sha256);
  assertSafeTarListing(run("tar", ["-tzf", archive], options), run("tar", ["-tvzf", archive], options));
  const secrets = parseWorkerSecrets(env.CLOUDFLARE_WORKER_SECRETS);
  const directory = join(root, ".sites-runtime/release-deploy");
  await mkdir(directory, { recursive: true });
  const extracted = await mkdtemp(join(directory, "release-"));
  let secretDirectory;
  try {
    run("tar", ["-xzf", archive, "-C", extracted, "--no-same-owner", "--no-same-permissions"], options);
    const sourceConfig = join(root, "wrangler.jsonc");
    const generatedConfig = join(extracted, "dist/server/wrangler.json");
    assertCloudflareDeployConfig(JSON.parse(await readFile(sourceConfig, "utf8")), JSON.parse(await readFile(generatedConfig, "utf8")));
    // Bindings are already provisioned and validated; skip Wrangler's first-run
    // resource lookup so deployment does not need private R2 API access.
    const deployArgs = [cli, "deploy", "--config", generatedConfig, "--experimental-provision=false", "--no-bundle", "--keep-vars", "--tag", env.RELEASE_TAG, "--message", `${env.RELEASE_TAG} (${commit})`];
    if (secrets) {
      secretDirectory = await mkdtemp(join(tmpdir(), "riparim-worker-secrets-"));
      const secretFile = join(secretDirectory, "secrets.json");
      await writeFile(secretFile, JSON.stringify(secrets), { mode: 0o600, flag: "wx" });
      deployArgs.push("--secrets-file", secretFile);
    }
    if (await newerPublishedRelease()) return { deployed: false, reason: "superseded" };
    try { run(process.execPath, [cli, "d1", "migrations", "apply", "DB", "--remote", "--config", sourceConfig], options); }
    catch { throw new Error("Cloudflare D1 migrations failed; the Worker was not deployed."); }
    if (await newerPublishedRelease()) return { deployed: false, reason: "superseded" };
    try { run(process.execPath, deployArgs, options); }
    catch { throw new Error("Cloudflare Worker deployment failed. Retry the same published release."); }
    if (env.GITHUB_OUTPUT) await appendFile(env.GITHUB_OUTPUT, `deployed=true\ntag=${env.RELEASE_TAG}\ncommit=${commit}\n`);
    console.log(`Published ${cloudflareProduction.worker} from release ${env.RELEASE_TAG} (${commit}).`);
    return { deployed: true, tag: env.RELEASE_TAG, commit };
  } finally {
    if (secretDirectory) await rm(secretDirectory, { recursive: true, force: true });
    await rm(extracted, { recursive: true, force: true });
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { await deployCloudflare(); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
