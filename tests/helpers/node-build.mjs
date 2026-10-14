import { execFile } from "node:child_process";
import { cp, mkdir, symlink } from "node:fs/promises";
import { isAbsolute, join } from "node:path";
import { promisify } from "node:util";
import {
  copyNodeBuild,
  nodeSourceDigest,
  validateNodeBuild,
} from "../../scripts/node-release.mjs";

const run = promisify(execFile);

export function logNodePhase(phase, started) {
  console.log(
    "[ci-phase] " +
      JSON.stringify({
        phase: "node:" + phase,
        durationMs: performance.now() - started,
      }),
  );
}

export async function nodePhase(name, action) {
  const started = performance.now();
  try {
    return await action();
  } finally {
    logNodePhase(name, started);
  }
}

export async function prepareNodeTestBuild({
  root,
  source,
  environment = process.env,
}) {
  await mkdir(source);
  const tracked = (await run("git", ["ls-files", "-z"], { cwd: root })).stdout
    .split("\0")
    .filter(Boolean);
  for (const path of tracked) {
    await mkdir(join(source, path, ".."), { recursive: true });
    await cp(join(root, path), join(source, path));
  }
  const git = async (...args) => run("git", args, { cwd: source });
  await git("init", "--initial-branch=main");
  await git("config", "user.email", "fixture@example.test");
  await git("config", "user.name", "Release fixture");
  // Recreate the tracked inventory, including checked-in synthetic TLS fixtures
  // that match ignore rules in a fresh repository.
  await git("add", "--force", "--", ...tracked);
  await git("commit", "-m", "feat: isolated release fixture");
  await symlink(join(root, "node_modules"), join(source, "node_modules"));
  if (Object.hasOwn(environment, "RIPARIM_NODE_PREBUILT")) {
    if (
      typeof environment.RIPARIM_NODE_PREBUILT !== "string" ||
      !isAbsolute(environment.RIPARIM_NODE_PREBUILT)
    )
      throw Error("RIPARIM_NODE_PREBUILT must be an absolute checkout root.");
    await nodePhase("reuse validated build", () =>
      copyNodeBuild(environment.RIPARIM_NODE_PREBUILT, source),
    );
  } else {
    await nodePhase("standalone build", () =>
      run(process.execPath, ["scripts/build-node.mjs"], {
        cwd: source,
        timeout: 180000,
        maxBuffer: 4 * 1024 * 1024,
        env: { ...environment, NEXT_TELEMETRY_DISABLED: "1" },
      }),
    );
    await validateNodeBuild(source);
  }
  return (await git("rev-parse", "HEAD")).stdout.trim();
}

export async function prepareVerificationNodeBuild(
  root,
  environment = process.env,
) {
  const prebuilt = environment.RIPARIM_NODE_PREBUILT;
  if (typeof prebuilt !== "string" || !isAbsolute(prebuilt))
    throw Error("RIPARIM_NODE_PREBUILT must be an absolute checkout root.");
  const receipt = await validateNodeBuild(prebuilt);
  if (receipt.sourceDigest !== (await nodeSourceDigest(root)))
    throw Error("Node build does not match this verification source.");
  return prebuilt;
}
