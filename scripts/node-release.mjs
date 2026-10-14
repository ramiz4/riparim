import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  cp,
  lstat,
  mkdir,
  readdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { join, resolve } from "node:path";

// Bind the compiled output to the complete tracked input, including the lock.
export async function nodeSourceDigest(root = process.cwd()) {
  const files = execFileSync("git", ["ls-files", "-z"], {
    cwd: root,
    encoding: "utf8",
  })
    .split("\0")
    .filter(Boolean)
    .sort();
  const hash = createHash("sha256");
  for (const file of files) {
    hash.update(file + "\0");
    hash.update(
      createHash("sha256")
        .update(await readFile(join(root, file)))
        .digest("hex"),
    );
    hash.update("\0");
  }
  return hash.digest("hex");
}
const excludedNext = new Set([
  "cache",
  "types",
  "diagnostics",
  "trace",
  "trace-build",
]);
function privatePath(name) {
  return /(?:^|\/)\.env(?:\.|$)|(?:^|\/)(?:tests|\.git)(?:\/|$)|\.(?:sqlite|pem)$/.test(
    name,
  );
}
async function filesBelow(root, prefix, files = []) {
  for (const name of await readdir(join(root, prefix))) {
    const path = prefix + "/" + name,
      stat = await lstat(join(root, path));
    if (stat.isDirectory()) await filesBelow(root, path, files);
    else if (stat.isFile()) files.push(path);
    else throw Error("Unexpected link or special file in Node input.");
  }
  return files;
}
export async function assertNodeInputs(root = process.cwd()) {
  const tracked = new Set(
    execFileSync("git", ["ls-files", "-z"], {
      cwd: root,
      encoding: "utf8",
    }).split("\0"),
  );
  for (const prefix of ["public", "drizzle"])
    for (const file of await filesBelow(root, prefix))
      if (!tracked.has(file) || privatePath(file))
        throw Error("Unexpected untracked or private Node package input.");
  if (
    (await readdir(root)).some(
      (name) => /^\.env(?:\.|$)/.test(name) && name !== ".env.example",
    )
  )
    throw Error(
      "Private dotenv files must be absent during the Node release build.",
    );
}
export async function nodeOutputDigest(root = process.cwd()) {
  for (const name of [".next", ".node-runtime"])
    if (!(await lstat(join(root, name))).isDirectory())
      throw Error("Node build roots must be regular directories.");
  const files = [];
  for (const name of await readdir(join(root, ".next"))) {
    if (excludedNext.has(name)) continue;
    const path = ".next/" + name,
      stat = await lstat(join(root, path));
    if (stat.isDirectory()) await filesBelow(root, path, files);
    else if (stat.isFile()) files.push(path);
    else throw Error("Unexpected Node build file.");
  }
  files.push(
    ".node-runtime/server.mjs",
    ".node-runtime/command.mjs",
    ".node-runtime/install.mjs",
  );
  const hash = createHash("sha256");
  for (const file of files.sort()) {
    if (!(await lstat(join(root, file))).isFile())
      throw Error("Node build contains a link or special file.");
    if (privatePath(file)) throw Error("Private material in Node build.");
    hash.update(file + "\0");
    hash.update(
      createHash("sha256")
        .update(await readFile(join(root, file)))
        .digest("hex"),
    );
    hash.update("\0");
  }
  return hash.digest("hex");
}
async function regularTree(path) {
  const stat = await lstat(path);
  if (stat.isDirectory())
    for (const name of await readdir(path)) await regularTree(join(path, name));
  else if (!stat.isFile())
    throw Error("Node build contains a link or special file.");
}
export async function validateNodeBuild(root = process.cwd()) {
  await assertNodeInputs(root);
  if (!(await lstat(join(root, ".node-runtime/build.json"))).isFile())
    throw Error("Node build receipt must be a regular file.");
  const receipt = JSON.parse(
    await readFile(join(root, ".node-runtime/build.json"), "utf8"),
  );
  if (receipt.outputDigest !== (await nodeOutputDigest(root)))
    throw Error("Node build output changed after compilation.");
  if (receipt.sourceDigest !== (await nodeSourceDigest(root)))
    throw Error(
      "Node build does not match the committed source. Rebuild before packaging.",
    );
  return receipt;
}
export async function copyNodeBuild(source, target) {
  if (resolve(source) === resolve(target))
    throw Error("Node build copy requires different source and target roots.");
  const receipt = await validateNodeBuild(source);
  await assertNodeInputs(target);
  if (receipt.sourceDigest !== (await nodeSourceDigest(target)))
    throw Error("Node build does not match the target fixture source.");
  for (const name of [".next", ".node-runtime"])
    await rm(join(target, name), { recursive: true, force: true });
  await mkdir(join(target, ".next"));
  for (const name of await readdir(join(source, ".next"))) {
    if (excludedNext.has(name)) continue;
    await cp(join(source, ".next", name), join(target, ".next", name), {
      recursive: true,
    });
  }
  await mkdir(join(target, ".node-runtime"));
  for (const name of ["server.mjs", "command.mjs", "install.mjs", "build.json"])
    await cp(
      join(source, ".node-runtime", name),
      join(target, ".node-runtime", name),
    );
  await validateNodeBuild(source);
  return validateNodeBuild(target);
}
export async function packageNodeRelease(root, commit) {
  const receipt = await validateNodeBuild(root);
  const artifacts = join(root, "artifacts"),
    stage = join(root, ".sites-runtime/node-package"),
    node = join(stage, "node");
  await rm(stage, { recursive: true, force: true });
  await mkdir(node, { recursive: true });
  try {
    for (const name of [".next", ".node-runtime", "public", "drizzle"])
      await regularTree(join(root, name));
    await mkdir(join(node, ".next"));
    for (const name of await readdir(join(root, ".next"))) {
      if (excludedNext.has(name)) continue;
      await cp(join(root, ".next", name), join(node, ".next", name), {
        recursive: true,
      });
    }
    await mkdir(join(node, ".node-runtime"));
    for (const name of ["server.mjs", "command.mjs", "install.mjs"])
      await cp(
        join(root, ".node-runtime", name),
        join(node, ".node-runtime", name),
      );
    await cp(join(root, "public"), join(node, "public"), { recursive: true });
    await mkdir(join(node, "drizzle"));
    for (const name of await readdir(join(root, "drizzle")))
      if (/^\d+_.+\.sql$/.test(name))
        await cp(join(root, "drizzle", name), join(node, "drizzle", name));
    const original = JSON.parse(
      await readFile(join(root, "package.json"), "utf8"),
    );
    const manifest = {
      name: original.name,
      version: original.version,
      private: true,
      type: "module",
      engines: { node: ">=24.10.0 <25" },
      dependencies: original.dependencies,
    };
    const lock = JSON.parse(
      await readFile(join(root, "package-lock.json"), "utf8"),
    );
    lock.packages[""] = { ...lock.packages[""], ...manifest };
    delete lock.packages[""].devDependencies;
    await writeFile(
      join(node, "package.json"),
      JSON.stringify(manifest, null, 2) + "\n",
    );
    await writeFile(
      join(node, "package-lock.json"),
      JSON.stringify(lock, null, 2) + "\n",
    );
    // The Webpack function is build-only. Next must never transpile a TS config or
    // install TypeScript on a release host, but the request-normalization flag stays.
    const config = JSON.parse(
      await readFile(join(root, ".next/required-server-files.json"), "utf8"),
    ).config;
    await writeFile(
      join(node, "next.config.mjs"),
      `export default ${JSON.stringify({ skipProxyUrlNormalize: config.skipProxyUrlNormalize })};\n`,
    );
    const files = {};
    async function inventory(directory, prefix = "") {
      for (const name of await readdir(directory)) {
        const relative = prefix + name,
          path = join(directory, name);
        if ((await lstat(path)).isDirectory())
          await inventory(path, relative + "/");
        else
          files[relative] = createHash("sha256")
            .update(await readFile(path))
            .digest("hex");
      }
    }
    await inventory(node);
    await writeFile(
      join(node, "release.json"),
      JSON.stringify({
        repository: "ramiz4/riparim",
        provider: "node",
        format: 1,
        commit,
        sourceDigest: receipt.sourceDigest,
        files,
      }) + "\n",
    );
    for (const path of [
      ".next/BUILD_ID",
      ".next/required-server-files.json",
      ".node-runtime/server.mjs",
      ".node-runtime/command.mjs",
    ])
      if (!(await lstat(join(node, path))).isFile())
        throw Error("Incomplete Node build.");
    await mkdir(artifacts, { recursive: true });
    const archive = join(artifacts, "riparim-node.tar.gz"),
      provenancePath = join(artifacts, "node-provenance.json");
    execFileSync("tar", ["-C", stage, "-czf", archive, "node"]);
    const provenance = {
      repository: "ramiz4/riparim",
      provider: "node",
      format: 1,
      commit,
      sha256: createHash("sha256")
        .update(await readFile(archive))
        .digest("hex"),
    };
    await writeFile(provenancePath, JSON.stringify(provenance, null, 2) + "\n");
    console.log(`Packaged verified Node application for ${commit}`);
    return { archive, provenancePath, provenance };
  } finally {
    await rm(stage, { recursive: true, force: true });
  }
}
