import { readFile, mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";
import {
  catalogueReleasePlan,
  statementSql,
} from "./catalogue-release-plan.mjs";
import { validateOpeningHoursImport } from "./lib/opening-hours-import.mjs";
import {
  checkoutRoot,
  localDevelopmentConfiguration,
} from "./local-development.mjs";
import { runLocalD1 } from "./local-d1.mjs";

export async function localOpeningHoursSeedSql(root = checkoutRoot) {
  const catalogue = JSON.parse(
    await readFile(resolve(root, "data/workshops.json"), "utf8"),
  );
  const hours = JSON.parse(
    await readFile(resolve(root, "data/opening-hours-import.json"), "utf8"),
  );
  const output = resolve(root, ".sites-runtime/local-dev/hours-contract.mjs");
  await mkdir(resolve(root, ".sites-runtime/local-dev"), { recursive: true });
  await build({
    absWorkingDir: root,
    entryPoints: ["lib/opening-hours.ts"],
    outfile: output,
    bundle: true,
    format: "esm",
    platform: "node",
    packages: "external",
  });
  const { openingHoursSchema } = await import(pathToFileURL(output));
  validateOpeningHoursImport(hours, catalogue, (value) =>
    openingHoursSchema.parse(value),
  );
  const plan = await catalogueReleasePlan(catalogue, "local-development", root);
  const statements = [
    ...plan.statements,
    { sql: plan.completionSql, params: [plan.key, "local-development"] },
  ];
  // Defaults fill missing imported hours only. Owner-confirmed hours, suppressed
  // imports and locally edited identities retain their existing behavior.
  for (const record of hours.records)
    statements.push({
      sql: `INSERT OR IGNORE INTO workshop_opening_hours_imports(workshop_id,opening_hours,source_metadata,import_revision,imported_at,suppressed)
 SELECT id,?,?,?,?,0 FROM workshops WHERE id=? AND name=? AND city=? AND address=? AND phone=? AND status='published'`,
      params: [
        JSON.stringify(record.hours),
        JSON.stringify(record.metadata),
        hours.revision,
        new Date().toISOString(),
        record.id,
        record.expected.name,
        record.expected.city,
        record.expected.address,
        record.expected.phone,
      ],
    });
  return statements.map(statementSql).join("\n");
}

export async function seedLocalOpeningHours(root = checkoutRoot, options = {}) {
  const local = await localDevelopmentConfiguration(root);
  const runtime = local.runtimePath;
  await mkdir(runtime, { recursive: true });
  const file = resolve(runtime, "opening-hours.sql");
  await writeFile(local.configPath, JSON.stringify(local.wranglerConfig));
  await writeFile(file, await localOpeningHoursSeedSql(root));
  await runLocalD1(local, "seed", ["execute", "DB", "--file", file], options);
  console.log(
    "Local development: catalogue and default opening hours prepared.",
  );
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
)
  await seedLocalOpeningHours();
