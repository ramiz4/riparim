import {
  nodeMigrationSchema,
  privateObjectsSchema,
} from "../lib/runtime/node-schema.mjs";
import { createHash, randomUUID } from "node:crypto";
import {
  mkdir,
  open,
  readFile,
  lstat,
  rename,
  rm,
  realpath,
} from "node:fs/promises";
import { isAbsolute, join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import {
  loadVerifiedSourceBackup,
  destinationFingerprint,
} from "./import-d1.mjs";
import {
  loadMigrationSet,
  restoreSnapshot,
  snapshotDatabase,
} from "./data-transfer.mjs";

const fail = (message) => {
  throw new Error(message);
};
const hash = (value) => createHash("sha256").update(value).digest("hex");
async function privateEntry(path, directory = false) {
  const info = await lstat(path);
  if (
    !(directory ? info.isDirectory() : info.isFile()) ||
    (info.mode & 0o077) !== 0
  )
    fail("Restore entries must be private regular files and directories.");
}
async function protectedWrite(path, content) {
  const file = await open(path, "wx", 0o600);
  try {
    await file.writeFile(content);
    await file.sync();
  } finally {
    await file.close();
  }
}
async function syncDirectory(path) {
  const file = await open(path, "r");
  try {
    await file.sync();
  } finally {
    await file.close();
  }
}
function state(directory) {
  const metadata = {
    projectId: "node-restore",
    sourceCommit: "0".repeat(40),
    exportedAt: "2026-10-11T00:00:00Z",
  };
  const app = new DatabaseSync(join(directory, "app.sqlite"), {
      readOnly: true,
    }),
    files = new DatabaseSync(join(directory, "files.sqlite"), {
      readOnly: true,
    });
  try {
    return {
      app: destinationFingerprint(snapshotDatabase(app, metadata)),
      files: destinationFingerprint(snapshotDatabase(files, metadata)),
    };
  } finally {
    app.close();
    files.close();
  }
}

/** Offline, all-or-nothing restore to a NEW directory. A retry can only verify
 * the unchanged complete result; it never inserts into a used destination. */
export async function restoreNodeBackup({
  sourceDirectory,
  expectedProjectId,
  expectedCommit,
  directory,
} = {}) {
  if (
    !isAbsolute(directory ?? "") ||
    resolve(directory) === resolve(sourceDirectory ?? "")
  )
    fail("A separate absolute new Node data directory is required.");
  const parent = dirname(directory);
  await privateEntry(parent, true);
  if ((await realpath(parent)) !== parent)
    fail("Restore parent must have a canonical private path.");
  const source = await loadVerifiedSourceBackup({
    directory: sourceDirectory,
    expectedProjectId,
    expectedCommit,
  });
  const migrations = await loadMigrationSet();
  const identity = {
    snapshotSha256: source.report.snapshotSha256,
    manifestSha256: source.report.manifestSha256,
  };
  const lock = directory + ".restore-lock";
  try {
    await mkdir(lock, { mode: 0o700 });
  } catch {
    fail("Another restore is active; keep target processes stopped.");
  }
  let stage;
  try {
    const existing = await lstat(directory).catch((error) => {
      if (error.code === "ENOENT") return null;
      throw error;
    });
    if (existing) {
      await privateEntry(directory, true);
      for (const name of ["app.sqlite", "files.sqlite", ".restore.json"])
        await privateEntry(join(directory, name));
      let receipt;
      try {
        receipt = JSON.parse(
          await readFile(join(directory, ".restore.json"), "utf8"),
        );
      } catch {
        fail("Existing destination has no completed restore proof.");
      }
      if (
        receipt.format !== 1 ||
        receipt.complete !== true ||
        receipt.snapshotSha256 !== identity.snapshotSha256 ||
        receipt.manifestSha256 !== identity.manifestSha256 ||
        JSON.stringify(receipt.state) !== JSON.stringify(state(directory))
      )
        fail(
          "Destination changed or is active; old backups cannot be replayed. Take a fresh consistent backup.",
        );
      return {
        restored: false,
        unchanged: true,
        objects: source.manifest.objects.length,
      };
    }
    // The checked-in SQL alone constructs the application schema. Source SQL
    // remains data and its migration history remains in the protected backup.
    const restored = restoreSnapshot(source.snapshot, migrations);
    stage = join(parent, ".riparim-restore-" + randomUUID());
    await mkdir(stage, { mode: 0o700 });
    try {
      for (const migration of migrations.slice(restored.proof.count))
        restored.database.exec(migration.sql);
      restored.database.exec(nodeMigrationSchema);
      const now = new Date().toISOString();
      for (const migration of migrations)
        restored.database
          .prepare("INSERT INTO riparim_node_migrations VALUES (?,?,?)")
          .run(migration.name, migration.sha256, now);
      if (restored.database.prepare("PRAGMA foreign_key_check").all().length)
        fail("Restored application references failed verification.");
      // VACUUM executes against our constructed database, with a bound new path.
      restored.database.prepare("VACUUM INTO ?").run(join(stage, "app.sqlite"));
    } finally {
      restored.database.close();
    }
    const appFile = await open(join(stage, "app.sqlite"), "r+");
    try {
      await appFile.chmod(0o600);
      await appFile.sync();
    } finally {
      await appFile.close();
    }
    await protectedWrite(join(stage, "files.sqlite"), "");
    const files = new DatabaseSync(join(stage, "files.sqlite"));
    try {
      files.exec(privateObjectsSchema);
      files.exec("BEGIN");
      const put = files.prepare(
        "INSERT INTO private_objects VALUES (?,?,?,?,?,?)",
      );
      for (const object of source.manifest.objects) {
        if (
          object.key.length > 1024 ||
          /[\\\x00-\x1f\x7f]/.test(object.key) ||
          object.key
            .split("/")
            .some((part) => !part || part === "." || part === "..") ||
          typeof object.etag !== "string" ||
          !object.etag ||
          /[\x00-\x1f\x7f]/.test(object.etag) ||
          !Number.isFinite(Date.parse(object.uploaded))
        )
          fail(
            "Private object metadata cannot be restored by the Node file contract.",
          );
        await privateEntry(join(sourceDirectory, object.file));
        const bytes = await readFile(join(sourceDirectory, object.file));
        if (bytes.length !== object.size || hash(bytes) !== object.sha256)
          fail("Private object checksum changed during restore.");
        // Preserve actual conditional-upload reservations: bucket.put would assign
        // new ETags and times even to identical bytes, invalidating their contract.
        put.run(
          object.key,
          object.etag,
          bytes,
          Date.parse(object.uploaded),
          JSON.stringify(object.httpMetadata),
          JSON.stringify(object.customMetadata),
        );
      }
      files.exec("COMMIT");
    } finally {
      files.close();
    }
    const file = await open(join(stage, "files.sqlite"), "r+");
    try {
      await file.sync();
    } finally {
      await file.close();
    }
    await protectedWrite(
      join(stage, ".restore.json"),
      JSON.stringify({
        format: 1,
        complete: true,
        ...identity,
        state: state(stage),
      }),
    );
    await syncDirectory(stage);
    if (
      await lstat(directory).catch((error) => {
        if (error.code === "ENOENT") return null;
        throw error;
      })
    )
      fail(
        "Destination appeared during restore; no existing data was replaced.",
      );
    await rename(stage, directory);
    stage = undefined;
    await syncDirectory(parent);
    return {
      restored: true,
      unchanged: false,
      objects: source.manifest.objects.length,
    };
  } finally {
    if (stage) await rm(stage, { recursive: true, force: true });
    await rm(lock, { recursive: true, force: true });
  }
}
async function runCli() {
  let input = "";
  for await (const chunk of process.stdin) {
    input += chunk;
    if (Buffer.byteLength(input) > 16384)
      fail("Protected restore input is too large.");
  }
  const options = JSON.parse(input),
    allowed = [
      "sourceDirectory",
      "expectedProjectId",
      "expectedCommit",
      "directory",
    ];
  if (
    !options ||
    typeof options !== "object" ||
    Array.isArray(options) ||
    Object.keys(options).some((key) => !allowed.includes(key))
  )
    fail("Restore options are required as JSON on stdin.");
  console.log(JSON.stringify(await restoreNodeBackup(options)));
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    await runCli();
  } catch {
    console.error(
      "Node restore stopped. Keep both systems paused and verify protected backup and destination state.",
    );
    process.exitCode = 1;
  }
}
