import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { lstat, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

// Do not let archives follow links into credentials or other checkout files.
async function assertRegularTree(path) {
  const stat = await lstat(path);
  if (stat.isDirectory()) {
    for (const entry of await readdir(path)) await assertRegularTree(join(path, entry));
  } else if (!stat.isFile()) {
    throw new Error(`Build contains a symlink or special file: ${path}`);
  }
}

const commit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
if (process.env.GITHUB_SHA && commit !== process.env.GITHUB_SHA) throw new Error("Build checkout does not match the workflow commit.");
const hosting = JSON.parse(await readFile(".openai/hosting.json", "utf8"));
const builtHosting = JSON.parse(await readFile("dist/.openai/hosting.json", "utf8"));
if (hosting.project_id !== builtHosting.project_id) throw new Error("Built Site identity does not match the source.");
for (const file of ["dist/server/index.js", "dist/client/.vite/manifest.json"]) {
  if (!(await lstat(file)).isFile()) throw new Error(`Missing build file: ${file}`);
}
await assertRegularTree("dist");
await mkdir("artifacts", { recursive: true });
execFileSync("tar", ["-czf", "artifacts/riparim-worker.tar.gz", "dist"], { stdio: "inherit" });
const sha256 = createHash("sha256").update(await readFile("artifacts/riparim-worker.tar.gz")).digest("hex");
await writeFile("artifacts/provenance.json", `${JSON.stringify({ repository: "ramiz4/riparim", commit, sha256 }, null, 2)}\n`);
console.log(`Packaged verified Worker for ${commit}`);
