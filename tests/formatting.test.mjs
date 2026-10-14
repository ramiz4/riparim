import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const runtime = path.join(root, ".test-runtime");
await mkdir(runtime, { recursive: true });
const directory = await mkdtemp(path.join(runtime, "formatting-"));
const manifest = JSON.parse(
  await readFile(path.join(root, "package.json"), "utf8"),
);
const env = { ...process.env, CI: "", HUSKY: "1", NODE_ENV: "development" };
const run = (command, args, cwd = directory, extra = {}) =>
  spawnSync(command, args, {
    cwd,
    env: { ...env, ...extra },
    encoding: "utf8",
    timeout: 60000,
  });
const succeeded = (result) =>
  assert.equal(result.status, 0, result.stdout + result.stderr);
async function copyConfiguration(target) {
  for (const name of [
    ".prettierrc.json",
    ".prettierignore",
    ".lintstagedrc.json",
    ".husky",
  ]) {
    try {
      await cp(path.join(root, name), path.join(target, name), {
        recursive: true,
        filter: (source) =>
          !source.includes(`${path.sep}_${path.sep}`) &&
          !source.endsWith(`${path.sep}_`),
      });
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
}

try {
  await writeFile(
    path.join(directory, "package.json"),
    JSON.stringify({
      private: true,
      type: "module",
      scripts: Object.fromEntries(
        Object.entries(manifest.scripts).filter(([name]) =>
          ["format", "format:check", "prepare"].includes(name),
        ),
      ),
    }),
  );
  await symlink(
    path.join(root, "node_modules"),
    path.join(directory, "node_modules"),
    "dir",
  );
  await copyConfiguration(directory);
  const unformatted = "export const value={label:'fixture',count:1}\n";
  const formatted = 'export const value = { label: "fixture", count: 1 };\n';
  await writeFile(path.join(directory, "fixture.ts"), unformatted);
  const check = run("npm", ["run", "format:check", "--", "fixture.ts"]);
  assert.notEqual(check.status, 0, "format:check must reject formatting drift");
  assert.equal(
    await readFile(path.join(directory, "fixture.ts"), "utf8"),
    unformatted,
    "format:check is read-only",
  );
  succeeded(run("npm", ["run", "format", "--", "fixture.ts"]));
  assert.equal(
    await readFile(path.join(directory, "fixture.ts"), "utf8"),
    formatted,
  );
  succeeded(run("npm", ["run", "format:check", "--", "fixture.ts"]));
  succeeded(run("npm", ["run", "format", "--", "fixture.ts"]));
  assert.equal(
    await readFile(path.join(directory, "fixture.ts"), "utf8"),
    formatted,
    "format is idempotent",
  );
  console.log(
    "Formatting commands reject drift, write consistently and stay idempotent",
  );
  const git = (args, cwd = directory, extra = {}) =>
    run("git", args, cwd, extra);
  succeeded(git(["init", "--quiet"]));
  succeeded(git(["config", "user.name", "Formatter Fixture"]));
  succeeded(git(["config", "user.email", "formatter@example.test"]));
  succeeded(git(["add", "fixture.ts", "package.json"]));
  succeeded(
    git(["commit", "--quiet", "-m", "test: initialize fixture"], directory, {
      HUSKY: "0",
    }),
  );
  succeeded(run("npm", ["run", "prepare"]));
  await writeFile(
    path.join(directory, "staged file.tsx"),
    "export const card=<div title='fixture'>Hello</div>\n",
  );
  succeeded(git(["add", "staged file.tsx"]));
  succeeded(git(["commit", "--quiet", "-m", "test: format staged file"]));
  assert.equal(
    git(["show", "HEAD:staged file.tsx"]).stdout,
    'export const card = <div title="fixture">Hello</div>;\n',
  );
  console.log("Real commits format staged TSX with spaces in its filename");
  const staged = "export const value={label:'staged',count:2}\n";
  const draft = "\n".repeat(12) + "export const privateDraft = 'unstaged';\n";
  await writeFile(path.join(directory, "fixture.ts"), staged);
  succeeded(git(["add", "fixture.ts"]));
  await writeFile(path.join(directory, "fixture.ts"), staged + draft);
  succeeded(git(["commit", "--quiet", "-m", "test: preserve partial staging"]));
  assert.equal(
    git(["show", "HEAD:fixture.ts"]).stdout,
    'export const value = { label: "staged", count: 2 };\n',
  );
  assert.equal(
    await readFile(path.join(directory, "fixture.ts"), "utf8"),
    'export const value = { label: "staged", count: 2 };\n' + draft,
  );
  assert.match(git(["diff", "--", "fixture.ts"]).stdout, /privateDraft/);
  console.log("Partial staging preserves unstaged content outside the commit");
  const invalid = "export const broken = {\n";
  await writeFile(path.join(directory, "broken.ts"), invalid);
  succeeded(git(["add", "broken.ts"]));
  const beforeHead = git(["rev-parse", "HEAD"]).stdout;
  const beforeIndex = git(["diff", "--cached"]).stdout;
  const beforeDraft = await readFile(
    path.join(directory, "fixture.ts"),
    "utf8",
  );
  const rejected = git([
    "commit",
    "--quiet",
    "-m",
    "test: reject invalid syntax",
  ]);
  assert.notEqual(rejected.status, 0);
  assert.match(rejected.stdout + rejected.stderr, /broken\.ts|SyntaxError/);
  assert.equal(git(["rev-parse", "HEAD"]).stdout, beforeHead);
  assert.equal(git(["diff", "--cached"]).stdout, beforeIndex);
  assert.equal(
    await readFile(path.join(directory, "broken.ts"), "utf8"),
    invalid,
  );
  assert.equal(
    await readFile(path.join(directory, "fixture.ts"), "utf8"),
    beforeDraft,
  );
  succeeded(git(["restore", "--staged", "broken.ts"]));
  console.log(
    "Formatter errors reject commits and preserve index and working edits",
  );
  await writeFile(path.join(directory, "opaque.bin"), Buffer.from([0, 255, 1]));
  succeeded(git(["add", "opaque.bin"]));
  succeeded(git(["commit", "--quiet", "-m", "test: allow unsupported file"]));
  assert.deepEqual(
    await readFile(path.join(directory, "opaque.bin")),
    Buffer.from([0, 255, 1]),
  );
  succeeded(
    git([
      "commit",
      "--allow-empty",
      "--quiet",
      "-m",
      "test: allow no staged files",
    ]),
  );
  const ignored = [
    "components/ui/fixture.ts",
    "hooks/use-mobile.ts",
    "vendor/fixture.css",
    "build/sites-vite-plugin.ts",
    "drizzle/meta/fixture.json",
    "cloudflare-env.d.ts",
    "monitor/worker-env.d.ts",
    "dist/fixture.ts",
  ];
  for (const name of ignored) {
    await mkdir(path.dirname(path.join(directory, name)), { recursive: true });
    await writeFile(
      path.join(directory, name),
      name.endsWith(".json") ? '{"fixture":true}' : unformatted,
    );
    succeeded(git(["add", "--force", name]));
  }
  succeeded(git(["commit", "--quiet", "-m", "test: preserve excluded files"]));
  for (const name of ignored)
    assert.equal(
      git(["show", `HEAD:${name}`]).stdout,
      name.endsWith(".json") ? '{"fixture":true}' : unformatted,
    );
  console.log(
    "Ignored and unsupported files and empty commits succeed unchanged",
  );
  succeeded(git(["config", "--local", "core.hooksPath", "existing-hooks"]));
  for (const number of [1, 2]) {
    const linked = path.join(directory, `linked-${number}`);
    succeeded(
      git([
        "worktree",
        "add",
        "--quiet",
        "-b",
        `fixture-${number}`,
        linked,
        "HEAD",
      ]),
    );
    await copyConfiguration(linked);
    await symlink(
      path.join(root, "node_modules"),
      path.join(linked, "node_modules"),
      "dir",
    );
    succeeded(run("npm", ["run", "prepare"], linked));
    assert.equal(
      git(["config", "--local", "--get", "core.hooksPath"]).stdout.trim(),
      "existing-hooks",
      "linked installs preserve common hooksPath",
    );
    assert.equal(
      git(
        ["config", "--worktree", "--get", "core.hooksPath"],
        linked,
      ).stdout.trim(),
      ".husky/_",
    );
    await writeFile(path.join(linked, "linked.ts"), unformatted);
    succeeded(git(["add", "linked.ts"], linked));
    succeeded(
      git(["commit", "--quiet", "-m", "test: format in worktree"], linked),
    );
    assert.equal(git(["show", "HEAD:linked.ts"], linked).stdout, formatted);
  }
  console.log(
    "Multiple worktrees use local hooks without replacing shared hooks",
  );
  const archive = path.join(directory, "source-archive");
  await mkdir(archive);
  await copyConfiguration(archive);
  await cp(
    path.join(directory, "package.json"),
    path.join(archive, "package.json"),
  );
  succeeded(run("npm", ["run", "prepare"], archive));
  succeeded(git(["init", "--quiet"], archive));
  for (const extra of [
    { CI: "true" },
    { NODE_ENV: "production" },
    { npm_config_omit: "dev" },
    { HUSKY: "0" },
    {},
  ]) {
    succeeded(run("npm", ["run", "prepare"], archive, extra));
    assert.notEqual(
      git(["config", "--get", "core.hooksPath"], archive).status,
      0,
    );
  }
  console.log(
    "Archives, CI, production and tool installs succeed without Husky",
  );
  const fresh = path.join(directory, "fresh-install");
  await mkdir(fresh);
  await copyConfiguration(fresh);
  const freshManifest = {
    name: "formatter-fixture",
    private: true,
    type: "module",
    scripts: { prepare: manifest.scripts.prepare },
    devDependencies: Object.fromEntries(
      ["prettier", "husky", "lint-staged"].map((name) => [
        name,
        manifest.devDependencies[name],
      ]),
    ),
  };
  await writeFile(
    path.join(fresh, "package.json"),
    JSON.stringify(freshManifest),
  );
  // Reuse integrity-pinned tarballs populated by install:ci, without registry
  // metadata or network access in the regular test suite.
  const lock = JSON.parse(
    await readFile(path.join(root, "package-lock.json"), "utf8"),
  );
  const packages = {
    "": {
      name: freshManifest.name,
      devDependencies: freshManifest.devDependencies,
      hasInstallScript: true,
    },
  };
  function include(name, from = "") {
    let candidate = from;
    let key;
    while (true) {
      key = path.posix.join(candidate, "node_modules", name);
      if (lock.packages[key]) break;
      assert(candidate, `Locked dependency ${name} is missing`);
      candidate = path.posix.dirname(candidate);
      if (candidate === ".") candidate = "";
    }
    if (packages[key]) return;
    packages[key] = lock.packages[key];
    for (const dependency of Object.keys(packages[key].dependencies ?? {}))
      include(dependency, key);
  }
  for (const name of Object.keys(freshManifest.devDependencies)) include(name);
  await writeFile(
    path.join(fresh, "package-lock.json"),
    JSON.stringify({
      name: freshManifest.name,
      lockfileVersion: 3,
      requires: true,
      packages,
    }),
  );
  succeeded(git(["init", "--quiet"], fresh));
  succeeded(git(["config", "user.name", "Formatter Fixture"], fresh));
  succeeded(git(["config", "user.email", "formatter@example.test"], fresh));
  succeeded(
    run(
      "npm",
      ["ci", "--offline", "--include=dev", "--no-audit", "--no-fund"],
      fresh,
    ),
  );
  assert.equal(
    git(["config", "--get", "core.hooksPath"], fresh).stdout.trim(),
    ".husky/_",
  );
  await writeFile(path.join(fresh, "fresh.ts"), unformatted);
  succeeded(git(["add", "fresh.ts"], fresh));
  succeeded(
    git(
      ["commit", "--quiet", "-m", "test: fresh install formats automatically"],
      fresh,
    ),
  );
  assert.equal(git(["show", "HEAD:fresh.ts"], fresh).stdout, formatted);
  console.log(
    "Fresh npm installation automatically enables the pinned local tools",
  );
} finally {
  await rm(directory, { recursive: true, force: true });
}
