import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { build } from "esbuild";
import { mkdir, writeFile } from "node:fs/promises";

const output = ".test-runtime/node-storage/adapter.mjs";
await mkdir(".test-runtime/node-storage", { recursive: true });
const bundle = await build({
  stdin: {
    contents: `export {createNodeStorage} from './lib/runtime/node-storage';export {migrateNode} from './lib/runtime/node-migrations';`,
    resolveDir: process.cwd(),
    loader: "ts",
  },
  outfile: output,
  bundle: true,
  write: false,
  format: "esm",
  platform: "node",
});
await writeFile(output, bundle.outputFiles[0].contents);
const { createNodeStorage, migrateNode } = await import(
  new URL("../" + output, import.meta.url)
);
const directory = await mkdtemp(join(tmpdir(), "riparim-storage-"));
let storage;
try {
  storage = createNodeStorage(directory);
  await storage.db
    .prepare("CREATE TABLE fixture (id TEXT PRIMARY KEY, value TEXT NOT NULL)")
    .run();
  await storage.db.batch([
    storage.db.prepare("INSERT INTO fixture VALUES (?,?)").bind("first", "one"),
    storage.db
      .prepare("INSERT INTO fixture VALUES (?,?)")
      .bind("second", "two"),
  ]);
  assert.deepEqual(
    (
      await storage.db.prepare("SELECT value FROM fixture ORDER BY id").all()
    ).results.map((row) => row.value),
    ["one", "two"],
  );
  await assert.rejects(
    storage.db.batch([
      storage.db
        .prepare("UPDATE fixture SET value=? WHERE id=?")
        .bind("changed", "first"),
      storage.db
        .prepare("INSERT INTO fixture VALUES (?,?)")
        .bind("second", "duplicate"),
    ]),
  );
  assert.equal(
    (
      await storage.db
        .prepare("SELECT value FROM fixture WHERE id=?")
        .bind("first")
        .first()
    ).value,
    "one",
    "failed batches roll back earlier writes",
  );
  storage.close();
  storage = createNodeStorage(directory);
  assert.equal(
    (await storage.db.prepare("SELECT COUNT(*) AS count FROM fixture").first())
      .count,
    2,
    "data survives reopening",
  );
  const bucket = storage.bucket;
  const reservation = await bucket.put("evidence/fixture/first", null, {
    customMetadata: { kind: "upload-reservation" },
  });
  assert(reservation.etag);
  await bucket.put(
    "evidence/fixture/first",
    new TextEncoder().encode("fictional private evidence"),
    {
      onlyIf: { etagMatches: reservation.etag },
      httpMetadata: { contentType: "application/pdf" },
    },
  );
  assert.equal(
    await (await bucket.get("evidence/fixture/first")).text(),
    "fictional private evidence",
  );
  const late = await bucket.put("evidence/fixture/late", null);
  // The deleting process may use another connection to the same local store.
  const deleting = createNodeStorage(directory);
  await deleting.bucket.delete("evidence/fixture/late");
  deleting.close();
  assert.equal(
    await bucket.put("evidence/fixture/late", "late private content", {
      onlyIf: { etagMatches: late.etag },
    }),
    null,
  );
  assert.equal(await bucket.head("evidence/fixture/late"), null);
  const replaced = await bucket.put("evidence/fixture/replaced", null);
  await bucket.put("evidence/fixture/replaced", "new reservation");
  assert.equal(
    await bucket.put("evidence/fixture/replaced", "old payload", {
      onlyIf: { etagMatches: replaced.etag },
    }),
    null,
  );
  for (const key of [
    "../outside",
    "/absolute",
    "evidence/../outside",
    "evidence\\outside",
    "evidence//outside",
  ])
    await assert.rejects(
      bucket.put(key, "private"),
      /Invalid private object key/,
    );
  const page = await bucket.list({ prefix: "evidence/fixture/", limit: 1 });
  assert.equal(page.objects.length, 1);
  assert.equal(page.truncated, true);
  assert.equal(
    (
      await bucket.list({
        prefix: "evidence/fixture/",
        limit: 1,
        cursor: page.cursor,
      })
    ).objects[0].key,
    "evidence/fixture/replaced",
  );
  storage.close();
  storage = createNodeStorage(directory);
  const persisted = await storage.bucket.get("evidence/fixture/first");
  assert.equal(persisted.httpMetadata.contentType, "application/pdf");
  assert.equal(await persisted.text(), "fictional private evidence");
  migrateNode(directory);
  migrateNode(directory);
  assert.equal(
    (
      await storage.db
        .prepare(
          "SELECT COUNT(*) AS count FROM sqlite_master WHERE type='table' AND name IN ('visits','auth_account_status','workshop_claims')",
        )
        .first()
    ).count,
    3,
  );
  console.log(
    "Node SQLite and private-file persistence, atomic batch, path validation and upload fencing passed",
  );
} finally {
  storage?.close();
  await rm(directory, { recursive: true, force: true });
}
