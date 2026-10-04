import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";

const policy = JSON.parse(await readFile(new URL("../.github/repository-policy.json", import.meta.url), "utf8"));
if (policy.repository !== "ramiz4/riparim") throw new Error("Unexpected repository policy target.");

function github(method, path, body) {
  const result = spawnSync("gh", ["api", "--method", method, path, ...(body ? ["--input", "-"] : [])], { input: body ? JSON.stringify(body) : undefined, encoding: "utf8" });
  if (result.status !== 0) throw new Error(result.stderr.trim() || "GitHub repository configuration failed.");
  return JSON.parse(result.stdout);
}

const path = `repos/${policy.repository}`;
if (process.argv.includes("--check")) {
  const repo = github("GET", path);
  for (const [key, expected] of Object.entries(policy.merge)) {
    if (repo[key] !== expected) throw new Error(`Repository setting ${key} does not match the policy.`);
  }
  const branch = github("GET", `${path}/branches/main/protection`);
  const contexts = branch.required_status_checks?.contexts ?? [];
  if (!branch.enforce_admins?.enabled || !branch.required_pull_request_reviews || !branch.required_status_checks?.strict || !branch.required_linear_history?.enabled || !policy.main.required_status_checks.contexts.every(context => contexts.includes(context))) {
    throw new Error("Main branch protection does not match the policy.");
  }
  console.log("Squash-only merges and required main checks match the repository policy.");
} else {
  github("PATCH", path, policy.merge);
  github("PUT", `${path}/branches/main/protection`, policy.main);
  console.log("Configured squash-only merges, Conventional PR titles and protected main.");
}
