import {
  prepareNodeTestBuild,
  prepareVerificationNodeBuild,
} from "./helpers/node-build.mjs";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  mkdir,
  mkdtemp,
  readFile,
  rename,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  copyNodeBuild,
  nodeOutputDigest,
  nodeSourceDigest,
  validateNodeBuild,
} from "../scripts/node-release.mjs";

const root = await mkdtemp(join(tmpdir(), "riparim-node-build-reuse-"));
try {
  for (const directory of ["public", "drizzle", ".next", ".node-runtime"])
    await mkdir(join(root, directory));
  await writeFile(join(root, "source.mjs"), "synthetic source\n");
  await writeFile(join(root, "public/fixture.txt"), "synthetic public fixture");
  await writeFile(
    join(root, "drizzle/0000_fixture.sql"),
    "-- synthetic migration",
  );
  await mkdir(join(root, "tests"));
  await writeFile(join(root, ".gitignore"), "*.pem\n");
  await writeFile(join(root, "tests/key.pem"), "synthetic TLS fixture");
  execFileSync("git", ["init", "--initial-branch=main"], {
    cwd: root,
    stdio: "ignore",
  });
  execFileSync(
    "git",
    [
      "add",
      "--force",
      "source.mjs",
      ".gitignore",
      "public/fixture.txt",
      "drizzle/0000_fixture.sql",
      "tests/key.pem",
    ],
    { cwd: root },
  );
  await writeFile(join(root, ".next/BUILD_ID"), "synthetic-build");
  for (const file of ["server", "command", "install"])
    await writeFile(
      join(root, `.node-runtime/${file}.mjs`),
      "synthetic output\n",
    );
  const receipt = {
    sourceDigest: await nodeSourceDigest(root),
    outputDigest: await nodeOutputDigest(root),
  };
  await writeFile(
    join(root, ".node-runtime/build.json"),
    JSON.stringify(receipt),
  );
  assert.deepEqual(await validateNodeBuild(root), receipt);
  const prebuiltEnvironment = { RIPARIM_NODE_PREBUILT: root };
  assert.equal(
    await prepareVerificationNodeBuild(root, prebuiltEnvironment),
    root,
  );
  const integration = join(root, "integration");
  const syntheticCommit = await prepareNodeTestBuild({
    root,
    source: integration,
    environment: prebuiltEnvironment,
  });
  assert.match(syntheticCommit, /^[0-9a-f]{40}$/);
  assert.deepEqual(
    await validateNodeBuild(integration),
    receipt,
    "tracked ignored TLS fixture is retained identically in synthetic source inventory",
  );
  assert.equal(
    await readFile(join(integration, "tests/key.pem"), "utf8"),
    "synthetic TLS fixture",
  );
  for (const prebuilt of ["", "relative-root", join(root, "missing")])
    await assert.rejects(
      prepareVerificationNodeBuild(root, { RIPARIM_NODE_PREBUILT: prebuilt }),
      /absolute|ENOENT/,
      "explicit invalid build fails without falling back to compilation",
    );
  const target = join(root, "isolated");
  for (const path of [target, join(target, "public"), join(target, "drizzle")])
    await mkdir(path);
  for (const path of [
    "source.mjs",
    ".gitignore",
    "public/fixture.txt",
    "drizzle/0000_fixture.sql",
    "tests/key.pem",
  ]) {
    await mkdir(join(target, path, ".."), { recursive: true });
    await writeFile(join(target, path), await readFile(join(root, path)));
  }
  execFileSync("git", ["init", "--initial-branch=main"], {
    cwd: target,
    stdio: "ignore",
  });
  execFileSync(
    "git",
    [
      "add",
      "--force",
      "source.mjs",
      ".gitignore",
      "public/fixture.txt",
      "drizzle/0000_fixture.sql",
      "tests/key.pem",
    ],
    { cwd: target },
  );
  await mkdir(join(root, ".next/cache"));
  await writeFile(
    join(root, ".next/cache/unused"),
    "cache is not release output",
  );
  await copyNodeBuild(root, target);
  assert.equal(
    await readFile(join(target, ".next/BUILD_ID"), "utf8").catch(() => null),
    "synthetic-build",
    "identical source fixture receives compiled output without rebuilding",
  );
  assert.deepEqual(await validateNodeBuild(target), receipt);
  await assert.rejects(readFile(join(target, ".next/cache/unused")), {
    code: "ENOENT",
  });
  await writeFile(join(target, "source.mjs"), "different target source\n");
  await assert.rejects(
    copyNodeBuild(root, target),
    /source/,
    "copy cannot bless a fixture with different tracked source",
  );
  await assert.rejects(
    copyNodeBuild(root, root),
    /different/,
    "copy cannot overwrite its build source",
  );
  await rm(join(root, ".node-runtime/build.json"));
  await assert.rejects(
    validateNodeBuild(root),
    { code: "ENOENT" },
    "missing receipt is refused",
  );
  await writeFile(
    join(root, ".node-runtime/build.json"),
    JSON.stringify(receipt),
  );
  await writeFile(join(root, "source.mjs"), "changed source\n");
  await assert.rejects(
    validateNodeBuild(root),
    /source/,
    "stale source is refused",
  );
  await writeFile(join(root, "source.mjs"), "synthetic source\n");
  await writeFile(join(root, ".next/BUILD_ID"), "tampered build");
  await assert.rejects(
    validateNodeBuild(root),
    /output/,
    "tampered output is refused",
  );
  await writeFile(join(root, ".next/BUILD_ID"), "synthetic-build");
  for (const name of [".next", ".node-runtime"]) {
    const saved = join(root, name + "-saved");
    await rename(join(root, name), saved);
    await symlink(saved, join(root, name));
    await assert.rejects(
      validateNodeBuild(root),
      /regular director/,
      "identical output through a root directory symlink is refused",
    );
    await rm(join(root, name));
    await rename(saved, join(root, name));
  }
  const output = join(root, ".node-runtime/server.mjs");
  await rm(output);
  await symlink(join(root, ".node-runtime/command.mjs"), output);
  await assert.rejects(
    validateNodeBuild(root),
    /link|special|regular/,
    "matching bytes through a symlink cannot be reused as build outputs",
  );
} finally {
  await rm(root, { recursive: true, force: true });
}
