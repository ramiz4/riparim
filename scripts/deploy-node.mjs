import { execFile, spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import {
  chmod,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  readlink,
  rename,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { createServer } from "node:net";
import { setTimeout as delay } from "node:timers/promises";
import { tmpdir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs, parseEnv, promisify } from "node:util";
import {
  assertNodeReleaseAssets,
  assertReleaseBuildProvenance,
} from "./release-policy.mjs";
import { assertSafeTarListing } from "./cloudflare-deploy-policy.mjs";

const execute = promisify(execFile),
  repository = "ramiz4/riparim",
  api = `https://api.github.com/repos/${repository}`;
const validTag = (tag) =>
  /^v(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/.test(tag ?? "");
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
function assertNodeVersion() {
  if (
    Number(process.versions.node.split(".")[0]) !== 24 ||
    Number(process.versions.node.split(".")[1]) < 10
  )
    throw Error(
      "Node deployment requires Node.js 24.10 or newer within version 24.",
    );
}
function childEnvironment() {
  return Object.fromEntries(
    ["PATH", "HOME", "TMPDIR"]
      .filter((name) => process.env[name])
      .map((name) => [name, process.env[name]]),
  );
}
async function run(command, args, cwd, env = childEnvironment()) {
  try {
    return (
      await execute(command, args, {
        cwd,
        env,
        timeout: 180000,
        maxBuffer: 8 * 1024 * 1024,
      })
    ).stdout;
  } catch {
    throw Error(
      "Node release preparation or runtime command failed; no code was activated.",
    );
  }
}
async function privateDirectory(path) {
  await mkdir(path, { recursive: true, mode: 0o700 });
  const stat = await lstat(path);
  if (!stat.isDirectory() || stat.isSymbolicLink() || stat.mode & 0o077)
    throw Error(
      "Node deployment directories must be private regular directories (0700).",
    );
}
async function hostLayout(root) {
  assertNodeVersion();
  if (!isAbsolute(root ?? ""))
    throw Error("Node deployment root must be an absolute path.");
  root = resolve(root);
  for (const path of [
    root,
    join(root, "releases"),
    join(root, "shared"),
    join(root, "shared/data"),
  ])
    await privateDirectory(path);
  return root;
}
async function locked(root, action) {
  const lock = join(root, ".deployment-lock");
  try {
    await mkdir(lock, { mode: 0o700 });
  } catch {
    throw Error(
      "Another Node deployment is running; inspect an abandoned lock before retrying.",
    );
  }
  try {
    return await action();
  } finally {
    await rm(lock, { recursive: true, force: true });
  }
}
async function github(
  path,
  { request = fetch, token = process.env.GITHUB_TOKEN, bytes = false } = {},
) {
  try {
    const response = await request(api + path, {
      headers: {
        Accept: bytes
          ? "application/octet-stream"
          : "application/vnd.github+json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) throw Error();
    return bytes
      ? Buffer.from(await response.arrayBuffer())
      : await response.json();
  } catch {
    throw Error(
      "Published GitHub release could not be verified or downloaded.",
    );
  }
}
async function* githubPages(path, collection, options) {
  for (let page = 1; page <= 5; page++) {
    const response = await github(`${path}&page=${page}`, options),
      items = response[collection];
    if (!Array.isArray(items))
      throw Error("GitHub verification listing is incomplete.");
    yield items;
    if (items.length < 100) return;
  }
  throw Error(
    "GitHub verification listing exceeds the bounded lookup; no release was approved.",
  );
}
export async function publishedNodeRelease(tag, options = {}) {
  if (!validTag(tag))
    throw Error("A stable published release tag is required.");
  const release = await github(`/releases/tags/${tag}`, options);
  assertNodeReleaseAssets(release, tag, "");
  if (
    typeof release.published_at !== "string" ||
    !Number.isFinite(Date.parse(release.published_at))
  )
    throw Error("Node installation requires a published release.");
  const ref = await github(`/git/ref/tags/${tag}`, options);
  let object = ref.object;
  if (object?.type === "tag")
    object = (await github(`/git/tags/${object.sha}`, options)).object;
  const commit = object?.sha;
  if (object?.type !== "commit" || !/^[a-f0-9]{40}$/.test(commit ?? ""))
    throw Error("Release tag has no verified commit.");
  const comparison = await github(`/compare/${commit}...main`, options);
  if (
    !["ahead", "identical"].includes(comparison.status) ||
    comparison.merge_base_commit?.sha !== commit
  )
    throw Error("Release commit is not part of main.");
  let checked = false;
  for await (const workflows of githubPages(
    `/actions/workflows/release.yml/runs?head_sha=${commit}&branch=main&event=push&per_page=100`,
    "workflow_runs",
    options,
  )) {
    for (const workflow of workflows) {
      if (
        workflow.head_sha !== commit ||
        workflow.head_branch !== "main" ||
        workflow.event !== "push" ||
        workflow.repository?.full_name !== repository
      )
        continue;
      // A deploy-only rerun must retain successful verification from an earlier attempt.
      for await (const jobs of githubPages(
        `/actions/runs/${workflow.id}/jobs?filter=all&per_page=100`,
        "jobs",
        options,
      )) {
        if (
          jobs.some(
            (job) =>
              job.head_sha === commit &&
              job.name ===
                "Verify merged main / Tests, types, lint and build" &&
              job.status === "completed" &&
              job.conclusion === "success",
          )
        ) {
          checked = true;
          break;
        }
      }
      if (checked) break;
    }
    if (checked) break;
  }
  if (!checked)
    throw Error(
      "No successful merged-main release verification exists for this commit.",
    );
  const asset = (name) => {
    const values = release.assets.filter(
      (item) =>
        item.name === name &&
        item.state === "uploaded" &&
        item.size > 0 &&
        Number.isSafeInteger(item.id),
    );
    if (values.length !== 1)
      throw Error("Release assets are missing or ambiguous.");
    return values[0];
  };
  const provenance = asset(`riparim-node-${tag}.json`);
  const expected = JSON.parse(
    (
      await github(`/releases/assets/${provenance.id}`, {
        ...options,
        bytes: true,
      })
    ).toString("utf8"),
  );
  assertReleaseBuildProvenance(expected, commit, expected.sha256, "node");
  return {
    tag,
    commit,
    archive: asset(`riparim-node-${tag}.tar.gz`),
    provenance,
    expected,
  };
}
async function verifyArchive(archive, provenance, commit) {
  const bytes = await readFile(archive);
  assertReleaseBuildProvenance(provenance, commit, hash(bytes), "node");
  const listing = await run("tar", ["-tzf", archive], tmpdir()),
    verbose = await run("tar", ["-tvzf", archive], tmpdir());
  assertSafeTarListing(listing, verbose, {
    directory: "node",
    required: [
      "node/release.json",
      "node/package.json",
      "node/package-lock.json",
      "node/next.config.mjs",
      "node/.next/BUILD_ID",
      "node/.next/required-server-files.json",
      "node/.node-runtime/server.mjs",
      "node/.node-runtime/command.mjs",
    ],
    assets: "node/.next/static/",
  });
  const names = listing.split("\n").filter(Boolean);
  if (
    names.some(
      (name) =>
        !/^node\/(?:\.next\/|\.node-runtime\/|public\/|drizzle\/|(?:release\.json|package(?:-lock)?\.json|next\.config\.mjs)$)/.test(
          name,
        ) && name !== "node/",
    )
  )
    throw Error("Node archive contains unexpected application files.");
  if (
    names.some((name) =>
      /(?:^|\/)\.env(?:\.|$)|(?:^|\/)(?:node_modules|cache|tests|\.git)(?:\/|$)|\.(?:sqlite|pem)$/.test(
        name,
      ),
    )
  )
    throw Error(
      "Node archive contains private data, dependencies or test material.",
    );
  const manifest = JSON.parse(
    await run("tar", ["-xOzf", archive, "node/release.json"], tmpdir()),
  );
  if (manifest.commit !== commit)
    throw Error("Node application commit differs from its published release.");
  return manifest;
}
async function verifyInstalled(path, manifest) {
  if (
    manifest.repository !== repository ||
    manifest.provider !== "node" ||
    manifest.format !== 1 ||
    !manifest.files ||
    typeof manifest.files !== "object"
  )
    throw Error("Invalid Node application manifest.");
  async function checkDirectory(directory, prefix = "") {
    for (const name of await readdir(directory)) {
      const relative = prefix + name,
        stat = await lstat(join(directory, name));
      if (stat.isSymbolicLink())
        throw Error("Unexpected symlink in prepared application.");
      if (stat.isDirectory()) {
        if (relative === "node_modules" || relative === ".next/cache") continue;
        await checkDirectory(join(directory, name), relative + "/");
      } else if (
        !stat.isFile() ||
        (relative !== "release.json" &&
          !Object.hasOwn(manifest.files, relative))
      )
        throw Error(
          "Unexpected file outside the published application inventory.",
        );
    }
  }
  await checkDirectory(path);
  for (const [name, digest] of Object.entries(manifest.files)) {
    if (
      !name ||
      name.split("/").some((part) => !part || part === "." || part === "..") ||
      name.includes("\\") ||
      !/^[a-f0-9]{64}$/.test(digest)
    )
      throw Error("Unsafe Node application manifest.");
    const stat = await lstat(join(path, name));
    if (
      !stat.isFile() ||
      stat.isSymbolicLink() ||
      hash(await readFile(join(path, name))) !== digest
    )
      throw Error(
        "Prepared application differs from the published Node archive.",
      );
  }
}
export async function prepareNodeRelease({ root, tag, ...options }) {
  root = await hostLayout(root);
  return locked(root, async () => {
    const published = await publishedNodeRelease(tag, options),
      destination = join(root, "releases", tag);
    try {
      const stat = await lstat(destination);
      if (!stat.isDirectory() || stat.isSymbolicLink())
        throw Error("Unsafe prepared release directory.");
      const provenance = JSON.parse(
        await readFile(join(destination, "provenance.json"), "utf8"),
      );
      assertReleaseBuildProvenance(
        published.expected,
        published.commit,
        hash(await readFile(join(destination, "archive.tar.gz"))),
        "node",
      );
      const manifest = await verifyArchive(
        join(destination, "archive.tar.gz"),
        provenance,
        published.commit,
      );
      await verifyInstalled(join(destination, "node"), manifest);
      return {
        tag,
        commit: published.commit,
        path: join(destination, "node"),
        reused: true,
      };
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    const stage = await mkdtemp(join(root, "releases", ".prepare-"));
    await chmod(stage, 0o700);
    try {
      const archive = await github(`/releases/assets/${published.archive.id}`, {
        ...options,
        bytes: true,
      });
      const provenance = published.expected;
      if (archive.length !== published.archive.size)
        throw Error(
          "Downloaded Node archive size differs from the published asset.",
        );
      await writeFile(join(stage, "archive.tar.gz"), archive, { mode: 0o600 });
      await writeFile(
        join(stage, "provenance.json"),
        JSON.stringify(provenance),
        { mode: 0o600 },
      );
      const manifest = await verifyArchive(
        join(stage, "archive.tar.gz"),
        provenance,
        published.commit,
      );
      if (manifest.commit !== published.commit)
        throw Error("Node application commit differs from its release.");
      await run(
        "tar",
        [
          "-xzf",
          join(stage, "archive.tar.gz"),
          "-C",
          stage,
          "--no-same-owner",
          "--no-same-permissions",
        ],
        stage,
      );
      const app = join(stage, "node");
      await verifyInstalled(app, manifest);
      await run(
        "npm",
        ["ci", "--omit=dev", "--ignore-scripts", "--no-audit", "--no-fund"],
        app,
      );
      await run(
        process.execPath,
        [
          "--input-type=module",
          "-e",
          "await import('next'); await import('nodemailer'); await import('node:sqlite');",
        ],
        app,
      );
      await rename(stage, destination);
      return {
        tag,
        commit: published.commit,
        path: join(destination, "node"),
        reused: false,
      };
    } finally {
      await rm(stage, { recursive: true, force: true });
    }
  });
}
const runtimeKeys = new Set([
  "SITE_ORIGIN",
  "REVIEW_MODERATOR_EMAIL",
  "GOOGLE_MAPS_BROWSER_API_KEY",
  "GOOGLE_PLACES_SERVER_API_KEY",
  "EMAIL_LOGIN_ACTIVATION_TIME",
  "EMAIL_LOGIN_ACTIVATION_PROJECT",
  "AUTH_TRUSTED_ORIGIN",
  "AUTH_TRUSTED_PROVIDER",
  "AUTH_ADMIN_KEY",
  "AUTH_ADMIN_KEY_ORIGIN",
  "AUTH_ADMIN_KEY_PROVIDER",
  "SUPABASE_SECRET_KEY_ORIGIN",
  "SUPABASE_SECRET_KEY",
  "RESEND_API_KEY",
  "TRANSACTIONAL_EMAIL_FROM",
  "EMAIL_TRANSPORT",
  "SMTP_URL",
  "SMTP_SECRET_ORIGIN",
  "MIGRATION_READ_ONLY",
  "MIGRATION_EXPORT_EXPIRES_AT",
  "MIGRATION_EXPORT_TOKEN_SHA256",
  "MIGRATION_SOURCE_COMMIT",
  "RIPARIM_TRUSTED_PROXIES",
  "RIPARIM_DATA_DIR",
  "PORT",
]);
async function runtimeEnvironment(root) {
  const path = join(root, "shared/runtime.env"),
    stat = await lstat(path);
  if (
    !stat.isFile() ||
    stat.isSymbolicLink() ||
    stat.nlink !== 1 ||
    stat.mode & 0o077
  )
    throw Error("Runtime configuration must be a private regular file (0600).");
  const config = parseEnv(await readFile(path, "utf8")),
    data = join(root, "shared/data");
  if (Object.keys(config).some((name) => !runtimeKeys.has(name)))
    throw Error("Runtime configuration contains unsupported keys.");
  if (config.RIPARIM_DATA_DIR && config.RIPARIM_DATA_DIR !== data)
    throw Error(
      "RIPARIM_DATA_DIR must name the external shared/data directory.",
    );
  if (!config.SITE_ORIGIN)
    throw Error("Runtime configuration needs SITE_ORIGIN.");
  return {
    ...childEnvironment(),
    ...config,
    RIPARIM_DATA_DIR: data,
    NEXT_TELEMETRY_DISABLED: "1",
  };
}
async function smokeRuntime(app, env) {
  const socket = createServer();
  await new Promise((resolve) => socket.listen(0, "127.0.0.1", resolve));
  const port = socket.address().port;
  await new Promise((resolve) => socket.close(resolve));
  const child = spawn(
    process.execPath,
    [".node-runtime/server.mjs", "--port", String(port)],
    { cwd: app, env, stdio: "ignore" },
  );
  const closed = new Promise((resolve) => {
    child.once("close", resolve);
    child.once("error", resolve);
  });
  let ready = false;
  try {
    for (let attempt = 0; attempt < 100; attempt++) {
      if (child.exitCode !== null) break;
      try {
        const response = await fetch(`http://127.0.0.1:${port}/api/session`, {
          signal: AbortSignal.timeout(500),
        });
        if (response.status === 200) {
          const session = await response.json();
          if (session.account === null && session.isAdmin === false) {
            ready = true;
            break;
          }
        }
        if (env.MIGRATION_READ_ONLY === "true" && response.status === 503) {
          ready = true;
          break;
        }
      } catch {}
      await delay(100);
    }
    if (!ready)
      throw Error(
        "Prepared Node server failed its HTTP check; current code remains active.",
      );
  } finally {
    child.kill("SIGTERM");
    const exited = await Promise.race([
      closed.then(() => true),
      delay(5000).then(() => false),
    ]);
    if (!exited) {
      child.kill("SIGKILL");
      await closed;
    }
  }
}
export async function activateNodeRelease({
  root,
  tag,
  stopped = false,
  rollback = false,
  schemaCompatible = false,
  ...options
}) {
  root = await hostLayout(root);
  if (!stopped)
    throw Error(
      "Stop the application service and notification timer before activation.",
    );
  if (rollback && !schemaCompatible)
    throw Error(
      "Code rollback requires explicit confirmation that the current schema is compatible.",
    );
  return locked(root, async () => {
    const published = await publishedNodeRelease(tag, options),
      release = join(root, "releases", tag),
      app = join(release, "node");
    const provenance = JSON.parse(
      await readFile(join(release, "provenance.json"), "utf8"),
    );
    assertReleaseBuildProvenance(
      published.expected,
      published.commit,
      hash(await readFile(join(release, "archive.tar.gz"))),
      "node",
    );
    const manifest = await verifyArchive(
      join(release, "archive.tar.gz"),
      provenance,
      published.commit,
    );
    await verifyInstalled(app, manifest);
    const current = join(root, "current");
    let previous;
    try {
      const stat = await lstat(current);
      if (!stat.isSymbolicLink())
        throw Error("Current release must be a managed symlink.");
      previous = await readlink(current);
      if (!/^releases\/v\d+\.\d+\.\d+\/node$/.test(previous))
        throw Error("Current symlink points outside managed releases.");
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    if (previous) {
      const before = previous.split("/")[1].slice(1).split(".").map(BigInt),
        after = tag.slice(1).split(".").map(BigInt);
      let order = 0;
      for (let index = 0; index < 3; index++)
        if (after[index] !== before[index]) {
          order = after[index] < before[index] ? -1 : 1;
          break;
        }
      if (order < 0 && !rollback)
        throw Error(
          "An older release requires explicit rollback and schema compatibility acknowledgment.",
        );
      if (order > 0 && rollback)
        throw Error(
          "A newer release must be activated with migrations, not as a code rollback.",
        );
    } else if (rollback)
      throw Error("A first installation cannot be a code rollback.");
    const env = await runtimeEnvironment(root);
    // Applied migrations are never reverted. Migration/HTTP failure retains current code.
    if (!rollback)
      await run(
        process.execPath,
        [".node-runtime/command.mjs", "migrate"],
        app,
        env,
      );
    await smokeRuntime(app, env);
    const temporary = join(root, ".current-" + randomUUID());
    try {
      await symlink(`releases/${tag}/node`, temporary);
      await rename(temporary, current);
    } finally {
      await rm(temporary, { force: true });
    }
    return { tag, commit: published.commit, previous, rollback };
  });
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  try {
    const { values, positionals } = parseArgs({
      allowPositionals: true,
      options: {
        root: { type: "string" },
        tag: { type: "string" },
        stopped: { type: "boolean" },
        "schema-compatible": { type: "boolean" },
      },
    });
    if (
      positionals.length !== 1 ||
      !["prepare", "activate", "rollback"].includes(positionals[0])
    )
      throw Error(
        "Usage: deploy-node.mjs prepare|activate|rollback --root /absolute/root --tag vX.Y.Z [--stopped] [--schema-compatible]",
      );
    const settings = {
      root: values.root,
      tag: values.tag,
      stopped: values.stopped,
      schemaCompatible: values["schema-compatible"],
      rollback: positionals[0] === "rollback",
    };
    const result =
      positionals[0] === "prepare"
        ? await prepareNodeRelease(settings)
        : await activateNodeRelease(settings);
    console.log(JSON.stringify(result));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
