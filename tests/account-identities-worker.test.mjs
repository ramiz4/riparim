import assert from "node:assert/strict";
import { build } from "esbuild";
import { readFile, readdir } from "node:fs/promises";
import { Miniflare } from "miniflare";

// Exercise the complete migration and trusted mapping operation with the real
// D1 implementation, whose SQL limits differ from Node SQLite. No live services.
const bundled = await build({
  stdin: {
    contents: `import {resolveAccount,linkAccountIdentity} from './lib/auth/identities';export default {async fetch(request){const command=await request.json();try{const account=command.existing?await linkAccountIdentity(command.existing,command.identity,async()=>command.verified===true):await resolveAccount(command.identity);return Response.json({account});}catch(error){return Response.json({error:error.message},{status:409});}}};`,
    resolveDir: process.cwd(),
    loader: "ts",
  },
  bundle: true,
  write: false,
  format: "esm",
  platform: "neutral",
  external: ["cloudflare:workers"],
  define: { "import.meta.env.DEV": "false" },
});
const runtime = new Miniflare({
  modules: true,
  script: bundled.outputFiles[0].text,
  compatibilityDate: "2026-05-15",
  compatibilityFlags: ["nodejs_compat"],
  d1Databases: ["DB"],
  r2Buckets: ["BUCKET"],
});
try {
  const db = await runtime.getD1Database("DB");
  for (const file of (await readdir("drizzle"))
    .filter((file) => file.endsWith(".sql"))
    .sort())
    for (const sql of (await readFile("drizzle/" + file, "utf8"))
      .split("--> statement-breakpoint")
      .map((sql) => sql.trim())
      .filter(Boolean))
      await db.prepare(sql).run();
  const identity = (issuer, subject) => ({
    provider: "supabase",
    issuer,
    subject,
  });
  const source = identity(
      "https://worker-source.supabase.co",
      "00000000-0000-4000-8000-000000000001",
    ),
    target = identity(
      "https://worker-target.supabase.co",
      "00000000-0000-4000-8000-000000000002",
    );
  const call = (command) =>
    runtime.dispatchFetch("https://fixture.invalid/mapping-fixture", {
      method: "POST",
      body: JSON.stringify(command),
    });
  const account = (await (await call({ identity: source })).json()).account;
  await db
    .prepare(
      "INSERT INTO auth_sessions (id,account_id,expires_at,created_at) VALUES ('worker-session',?,9999999999999,'2026-10-11')",
    )
    .bind(account)
    .run();
  assert.equal(
    (await call({ existing: source, identity: target, verified: false }))
      .status,
    409,
  );
  assert.equal(
    (
      await (
        await call({ existing: source, identity: target, verified: true })
      ).json()
    ).account,
    account,
  );
  assert.equal(
    (await (await call({ identity: target })).json()).account,
    account,
  );
  assert.equal(
    (
      await db
        .prepare("SELECT revoked FROM auth_sessions WHERE id='worker-session'")
        .first()
    ).revoked,
    1,
  );
  const foreign = identity(
    "https://worker-foreign.supabase.co",
    "00000000-0000-4000-8000-000000000003",
  );
  const foreignAccount = (await (await call({ identity: foreign })).json())
    .account;
  assert.notEqual(foreignAccount, account);
  assert.equal(
    (await call({ existing: source, identity: foreign, verified: true }))
      .status,
    409,
    "Real D1 rejects cross-account relinking",
  );
  const competition = identity(
    "https://worker-competition.supabase.co",
    "00000000-0000-4000-8000-000000000004",
  );
  const race = await Promise.all([
    call({ existing: source, identity: competition, verified: true }),
    call({ existing: foreign, identity: competition, verified: true }),
  ]);
  assert.equal(
    race.filter((response) => response.ok).length,
    1,
    "Real D1 uniqueness prevents competing accounts from merging",
  );
  const used = identity(
      "https://worker-late.supabase.co",
      "00000000-0000-4000-8000-000000000005",
    ),
    usedAccount = "supabase:worker-late.supabase.co:" + used.subject;
  await db
    .prepare(
      "INSERT INTO auth_account_roles VALUES ('worker-audit','admin','2026-10-11',?)",
    )
    .bind(usedAccount)
    .run();
  assert.equal(
    (await call({ existing: source, identity: used, verified: true })).status,
    409,
    "The production SQL fence preserves unmapped predecessor audit references",
  );
  await db
    .prepare(
      "INSERT INTO auth_account_status VALUES (?,'deleted','2026-10-11')",
    )
    .bind(account)
    .run();
  const blocked = identity(
    "https://worker-blocked.supabase.co",
    "00000000-0000-4000-8000-000000000006",
  );
  assert.equal(
    (
      await (
        await call({ existing: source, identity: blocked, verified: true })
      ).json()
    ).account,
    account,
  );
  assert.equal(
    (
      await db
        .prepare("SELECT status FROM auth_account_status WHERE account_id=?")
        .bind(account)
        .first()
    ).status,
    "deleted",
  );
  console.log(
    "Real D1: additive migration, verified binding, session revocation, competing mappings, predecessor references and tombstone preservation passed",
  );
} finally {
  await runtime.dispose();
}
