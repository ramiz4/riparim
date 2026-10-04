import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { appendFile, readFile } from "node:fs/promises";
import semanticRelease from "semantic-release";
import releaseConfig from "../release.config.mjs";
import { assertBuildProvenance, assertReleaseContext, existingReleaseMetadata } from "./release-policy.mjs";

const commit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
assertReleaseContext(process.env, commit);
const archiveHash = createHash("sha256").update(await readFile("artifacts/riparim-worker.tar.gz")).digest("hex");
assertBuildProvenance(JSON.parse(await readFile("artifacts/provenance.json", "utf8")), commit, archiveHash);
const latestMain = execFileSync("git", ["ls-remote", "origin", "refs/heads/main"], { encoding: "utf8" }).trim().split(/\s+/)[0];

let release;
if (latestMain !== commit) {
  console.log("A newer main commit exists; its queued workflow will create the release.");
} else {
  const tags = execFileSync("git", ["tag", "--points-at", "HEAD"], { encoding: "utf8" }).trim().split("\n").filter(tag => /^v\d+\.\d+\.\d+$/.test(tag));
  if (tags.length > 1) throw new Error("Multiple version tags point at this commit; select the intended release before retrying.");
  if (tags.length) {
    const response = await fetch(`https://api.github.com/repos/ramiz4/riparim/releases/tags/${tags[0]}`, { headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } });
    if (!response.ok) throw new Error(`The existing ${tags[0]} tag has no readable GitHub release (HTTP ${response.status}). Complete its publication before retrying.`);
    release = existingReleaseMetadata(await response.json(), tags[0], commit);
    console.log(`Reusing published release ${release.gitTag} for the exact workflow commit.`);
  } else {
    const result = await semanticRelease(releaseConfig);
    release = result?.nextRelease;
  }
}

if (release) {
  if (release.gitHead !== commit) throw new Error("Semantic release selected an unexpected commit.");
  if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `released=true\nversion=${release.version}\ntag=${release.gitTag}\ncommit=${commit}\n`);
} else {
  if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, "released=false\n");
  console.log("No new semantic release created.");
}
