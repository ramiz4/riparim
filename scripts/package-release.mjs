import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { lstat, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { isDeepStrictEqual } from "node:util";
import { assertCloudflareDeployConfig } from "./cloudflare-deploy-policy.mjs";
import { assertSitesBuildConfig, releaseBuildTarget } from "./release-policy.mjs";

// Do not let archives follow links into credentials or other checkout files.
async function assertRegularTree(path) {
  const stat = await lstat(path);
  if (stat.isDirectory()) {
    for (const entry of await readdir(path)) await assertRegularTree(join(path, entry));
  } else if (!stat.isFile()) {
    throw new Error(`Build contains a symlink or special file: ${path}`);
  }
}

export async function packageRelease({ target = "cloudflare", projectRoot = process.cwd(), workflowCommit = process.env.GITHUB_SHA } = {}) {
  releaseBuildTarget(target);
  const commit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: projectRoot, encoding: "utf8" }).trim();
  if (workflowCommit && commit !== workflowCommit) throw new Error("Build checkout does not match the workflow commit.");
  if (execFileSync("git", ["status", "--porcelain", "--untracked-files=all"], { cwd: projectRoot, encoding: "utf8" }).trim()) {
    throw new Error("Release packaging requires clean committed source; local changes do not represent the release commit.");
  }
  const hosting = JSON.parse(await readFile(join(projectRoot, ".openai/hosting.json"), "utf8"));
  const builtHosting = JSON.parse(await readFile(join(projectRoot, "dist/.openai/hosting.json"), "utf8"));
  if (!isDeepStrictEqual(hosting, builtHosting)) throw new Error("Built Site identity and logical bindings do not match the source.");
  const generated = JSON.parse(await readFile(join(projectRoot, "dist/server/wrangler.json"), "utf8"));
  if (target === "sites") assertSitesBuildConfig(hosting, generated);
  else assertCloudflareDeployConfig(JSON.parse(await readFile(join(projectRoot, "wrangler.jsonc"), "utf8")), generated);
  for (const file of ["dist/server/index.js", "dist/client/.vite/manifest.json"]) {
    if (!(await lstat(join(projectRoot, file))).isFile()) throw new Error(`Missing build file: ${file}`);
  }
  await assertRegularTree(join(projectRoot, "dist"));
  const artifacts = join(projectRoot, "artifacts");
  await mkdir(artifacts, { recursive: true });
  const archive = join(artifacts, target === "sites" ? "riparim-sites.tar.gz" : "riparim-worker.tar.gz");
  const provenancePath = join(artifacts, target === "sites" ? "sites-provenance.json" : "provenance.json");
  execFileSync("tar", ["-C", projectRoot, "-czf", archive, "dist"], { stdio: "inherit" });
  const sha256 = createHash("sha256").update(await readFile(archive)).digest("hex");
  const provenance = { repository: "ramiz4/riparim", provider: target, commit, sha256, ...(target === "sites" ? { project_id: hosting.project_id } : {}) };
  await writeFile(provenancePath, `${JSON.stringify(provenance, null, 2)}\n`);
  console.log(`Packaged verified ${target} Worker for ${commit}`);
  return { archive, provenancePath, provenance };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv.length > 3) throw new Error("Usage: package-release.mjs [cloudflare|sites]");
  await packageRelease({ target: process.argv[2] });
}
