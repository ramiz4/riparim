import assert from "node:assert/strict";
import { build } from "esbuild";
import { DatabaseSync } from "node:sqlite";
import { readFile, readdir } from "node:fs/promises";
const bundle = await build({
  entryPoints: ["lib/public-release-routing.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  write: false,
  define: { __RIPARIM_PUBLIC_REVISIONS__: "[]" },
});
const { servePublicRelease } = await import(
  "data:text/javascript;base64," +
    Buffer.from(bundle.outputFiles[0].contents).toString("base64")
);
const db = new DatabaseSync(":memory:");
for (const file of (await readdir("drizzle"))
  .filter((name) => name.endsWith(".sql"))
  .sort())
  db.exec(await readFile("drizzle/" + file, "utf8"));
const requested = [];
const env = {
  DB: {
    prepare(sql) {
      const query = db.prepare(sql);
      return {
        async first() {
          return query.get() ?? null;
        },
      };
    },
  },
  ASSETS: {
    async fetch(request) {
      requested.push(new URL(request.url).pathname);
      return new Response(
        new URL(request.url).pathname.includes("privacy-pocketbase")
          ? "PocketBase"
          : "Supabase",
      );
    },
  },
};
try {
  let response = await servePublicRelease(
    new Request("https://riparim.test/datenschutz"),
    env,
  );
  assert.equal(
    await response.text(),
    "Supabase",
    "An unconfigured existing installation keeps its default privacy provider",
  );
  db.prepare(
    "INSERT INTO auth_settings (id,project_url,public_key,enabled,email_delivery_confirmed,updated_at,provider) VALUES ('main','https://auth.fixture.test','',0,0,'fixture','pocketbase')",
  ).run();
  for (const path of ["/datenschutz", "/sq/privatesia", "/en/privacy"])
    for (const method of ["GET", "HEAD"]) {
      response = await servePublicRelease(
        new Request("https://riparim.test" + path, { method }),
        env,
      );
      assert.equal(
        await response.text(),
        "PocketBase",
        "The static privacy route follows the selected protocol even while auth is disabled",
      );
      assert.equal(response.headers.get("X-Riparim-Public-Snapshot"), "1");
      assert.equal(response.headers.has("set-cookie"), false);
    }
  const rsc = await servePublicRelease(
    new Request("https://riparim.test/datenschutz", { headers: { RSC: "1" } }),
    env,
  );
  assert.equal(
    await rsc.text(),
    "PocketBase",
    "React navigation selects the current provider release variant",
  );
  assert.match(rsc.headers.get("Content-Type"), /text\/x-component/);
  db.prepare(
    "UPDATE auth_settings SET provider='supabase' WHERE id='main'",
  ).run();
  response = await servePublicRelease(
    new Request("https://riparim.test/en/privacy"),
    env,
  );
  assert.equal(
    await response.text(),
    "Supabase",
    "A rollback immediately restores the selected provider text",
  );
  assert.equal(requested.length, 9);
  console.log(
    "Static privacy selection: default, disabled PocketBase, all locales, HEAD, React navigation and rollback passed",
  );
} finally {
  db.close();
}
