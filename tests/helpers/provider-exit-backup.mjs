import { build } from "esbuild";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { exportSource } from "../../scripts/export-source.mjs";
import { loadMigrationSet } from "../../scripts/data-transfer.mjs";
import { Miniflare } from "miniflare";

export async function backupFixture(
  parent,
  seed = async () => {},
  { cloudflare = false } = {},
) {
  const output = join(parent, "fixture-storage");
  await mkdir(output, { recursive: true });
  const bundled = await build({
    stdin: {
      contents:
        "export {createNodeStorage} from './lib/runtime/node-storage';export {migrateNode} from './lib/runtime/node-migrations';export {handleMigrationRequest} from './lib/migration-export';export {linkAccountIdentity} from './lib/auth/identities';",
      resolveDir: process.cwd(),
      loader: "ts",
    },
    outfile: join(output, "storage.mjs"),
    bundle: true,
    write: false,
    format: "esm",
    platform: "node",
    plugins: [
      {
        name: "offline-identity-mapping",
        setup(b) {
          b.onResolve({ filter: /^@\/lib\/runtime\/env$/ }, () => ({
            path: "env",
            namespace: "fixture",
          }));
          b.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({
            loader: "js",
            contents:
              "export const env=new Proxy({}, {get:(_target,key)=>globalThis.providerExitEnv?.[key]});",
          }));
        },
      },
    ],
  });
  await writeFile(join(output, "storage.mjs"), bundled.outputFiles[0].contents);
  const api = await import("file://" + join(output, "storage.mjs"));
  const sourceDirectory = join(parent, "source"),
    token = "a".repeat(64),
    commit = "b".repeat(40),
    bindings = {
      MIGRATION_READ_ONLY: "true",
      MIGRATION_SOURCE_COMMIT: commit,
      MIGRATION_EXPORT_TOKEN_SHA256: createHash("sha256")
        .update(token)
        .digest("hex"),
      MIGRATION_EXPORT_EXPIRES_AT: new Date(Date.now() + 3600000).toISOString(),
    };
  let storage, runtime;
  if (cloudflare) {
    const worker = await build({
      stdin: {
        contents:
          "import {handleMigrationRequest} from './lib/migration-export';export default {fetch(request,env){return handleMigrationRequest(request,env);}};",
        resolveDir: process.cwd(),
        loader: "ts",
      },
      bundle: true,
      write: false,
      format: "esm",
      platform: "neutral",
      define: { __RIPARIM_RELEASE_COMMIT__: JSON.stringify(commit) },
    });
    runtime = new Miniflare({
      modules: true,
      script: worker.outputFiles[0].text,
      compatibilityDate: "2026-05-15",
      compatibilityFlags: ["nodejs_compat"],
      d1Databases: ["DB"],
      r2Buckets: ["BUCKET"],
      bindings,
    });
    const db = await runtime.getD1Database("DB"),
      bucket = await runtime.getR2Bucket("BUCKET");
    await db
      .prepare(
        "CREATE TABLE d1_migrations (id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT UNIQUE,applied_at TEXT NOT NULL)",
      )
      .run();
    for (const migration of await loadMigrationSet()) {
      for (const sql of migration.sql
        .split("--> statement-breakpoint")
        .map((sql) => sql.trim())
        .filter(Boolean))
        await db.prepare(sql).run();
      await db
        .prepare("INSERT INTO d1_migrations (name,applied_at) VALUES (?,?)")
        .bind(migration.name, new Date().toISOString())
        .run();
    }
    storage = { db, bucket };
  } else {
    api.migrateNode(sourceDirectory);
    storage = api.createNodeStorage(sourceDirectory);
  }
  const env = { DB: storage.db, BUCKET: storage.bucket, ...bindings };
  try {
    await storage.bucket.put(
      "unreferenced/private.bin",
      new Uint8Array([0, 1, 255]),
      {
        httpMetadata: {
          contentType: "application/x-synthetic",
          cacheControl: "private, no-store",
          contentDisposition: "attachment",
          contentLanguage: "en",
          cacheExpiry: new Date("2026-10-12T00:00:00Z"),
        },
        customMetadata: { purpose: "fixture" },
      },
    );
    await seed(storage);
    const origin = "https://source.fixture.invalid",
      request = (url, options) =>
        cloudflare
          ? runtime.dispatchFetch(url, options)
          : api.handleMigrationRequest(new Request(url, options), env);
    const schema = await (
      await request(origin + "/__migration/export?operation=schema", {
        headers: { Authorization: "Bearer " + token },
      })
    ).json();
    const backupDirectory = join(parent, "backup");
    const result = await exportSource({
      origin,
      token,
      expectedProjectId: schema.projectId,
      expectedCommit: commit,
      directory: backupDirectory,
      request,
    });
    return { ...result, backupDirectory, sourceDirectory, api };
  } finally {
    storage.close?.();
    await runtime?.dispose();
  }
}
