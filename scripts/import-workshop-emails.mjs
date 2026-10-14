import { readFile, writeFile, mkdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";
import {
  workshopEmailImportQuery,
  workshopEmailRevision,
} from "./lib/workshop-email-import.mjs";
import { statementSql } from "./catalogue-release-plan.mjs";

const args = process.argv.slice(2),
  options = {};
let write = false;
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--write") {
    write = true;
    continue;
  }
  if (
    !["--output", "--local-db", "--release", "--revision"].includes(args[i]) ||
    !args[i + 1] ||
    options[args[i]]
  )
    throw Error(
      "Use [--output FILE] [--local-db FILE --write] or --release TAG --write [--revision HASH]",
    );
  options[args[i]] = args[++i];
}
await mkdir(".sites-runtime/email-import", { recursive: true });
const bundle = ".sites-runtime/email-import/contract.mjs";
await build({
  entryPoints: ["lib/workshop-contacts.ts"],
  outfile: bundle,
  bundle: true,
  format: "esm",
  platform: "node",
  packages: "external",
});
const { validateWorkshopEmailContacts } = await import(
  pathToFileURL(resolve(bundle))
);
const catalogue = JSON.parse(await readFile("data/workshops.json", "utf8"));
const manifest = validateWorkshopEmailContacts(
  JSON.parse(await readFile("data/workshop-emails.json", "utf8")),
  catalogue.workshops,
);
const revision = workshopEmailRevision(manifest),
  query = workshopEmailImportQuery(manifest, options["--revision"] ?? revision);
if (options["--output"])
  await writeFile(options["--output"], JSON.stringify(query) + "\n", {
    mode: 0o600,
  });
if (write) {
  if (options["--local-db"]) {
    const { DatabaseSync } = await import("node:sqlite"),
      db = new DatabaseSync(options["--local-db"]);
    db.exec("BEGIN");
    try {
      const changes = query.batch.map(
        (q) => db.prepare(q.sql).run(...q.params).changes,
      );
      db.exec("COMMIT");
      console.log({ changes });
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    } finally {
      db.close();
    }
  } else {
    const run = (command, args) => {
      const result = spawnSync(command, args, { encoding: "utf8" });
      if (result.status !== 0) throw Error(`${command} failed`);
      return result.stdout.trim();
    };
    const tag = options["--release"];
    if (!/^v\d+\.\d+\.\d+$/.test(tag ?? ""))
      throw Error("Production requires a published main release");
    const head = run("git", ["rev-parse", "HEAD"]);
    if (head !== run("git", ["rev-parse", `${tag}^{commit}`]))
      throw Error("Checkout must match the release");
    run("git", ["merge-base", "--is-ancestor", head, "origin/main"]);
    const release = JSON.parse(
      run("gh", [
        "release",
        "view",
        tag,
        "--json",
        "isDraft,isPrerelease,assets",
      ]),
    );
    if (release.isDraft || release.isPrerelease || release.assets.length < 6)
      throw Error("Release is incomplete");
    for (const file of [
      "data/workshop-emails.json",
      "scripts/lib/workshop-email-import.mjs",
      "scripts/import-workshop-emails.mjs",
      "lib/workshop-contacts.ts",
      "lib/workshop-emails.ts",
    ])
      if (
        run("git", ["show", `HEAD:${file}`]) !==
        (await readFile(file, "utf8")).trim()
      )
        throw Error("Import differs from release: " + file);
    const file = ".sites-runtime/email-import/apply.sql";
    await writeFile(file, query.batch.map(statementSql).join("\n"), {
      mode: 0o600,
    });
    run(process.execPath, [
      "node_modules/wrangler/bin/wrangler.js",
      "d1",
      "execute",
      "DB",
      "--remote",
      "--config",
      "wrangler.jsonc",
      "--file",
      file,
      "--yes",
    ]);
  }
}
console.log(
  JSON.stringify({
    mode: write ? "write" : "preview",
    revision,
    workshops: manifest.contacts.length,
    addresses: manifest.contacts.reduce((n, c) => n + c.emails.length, 0),
    multiple: manifest.contacts.filter((c) => c.emails.length > 1).length,
    missing: manifest.contacts.filter((c) => !c.emails.length).length,
  }),
);
