import { build } from "esbuild";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { pathToFileURL } from "node:url";

export async function catalogueReleasePlan(
  catalogue,
  commit,
  root = process.cwd(),
) {
  const output = resolve(root, ".sites-runtime/catalogue-release/import.mjs");
  await mkdir(dirname(output), { recursive: true });
  await build({
    absWorkingDir: root,
    entryPoints: ["db/catalogue-import.ts"],
    outfile: output,
    bundle: true,
    platform: "node",
    format: "esm",
  });
  const {
    catalogueImportStatements,
    catalogueImportKey,
    catalogueCompletionSql,
  } = await import(pathToFileURL(output));
  // CI validates both immutable sources before packaging. Deployment uses only
  // its locked esbuild/Wrangler tools, with no application validator dependency.
  const { contacts } = JSON.parse(
    await readFile(resolve(root, "data/workshop-contacts.json"), "utf8"),
  );
  if (!Array.isArray(contacts))
    throw Error("Released contact source is missing");
  const { contacts: emails } = JSON.parse(
    await readFile(resolve(root, "data/workshop-emails.json"), "utf8"),
  );
  if (!Array.isArray(emails)) throw Error("Released email source is missing");
  // The same statement factory powers runtime imports; this adapter records its plan.
  const recorder = {
    prepare(sql) {
      return {
        bind(...params) {
          return { sql, params };
        },
      };
    },
  };
  return {
    schemaVersion: 1,
    commit,
    key: await catalogueImportKey(catalogue, contacts, emails),
    completionSql: catalogueCompletionSql,
    statements: await catalogueImportStatements(
      recorder,
      catalogue,
      contacts,
      emails,
    ),
  };
}
export function statementSql({ sql, params }) {
  let index = 0;
  const text = sql.replace(/\?/g, () => {
    if (index >= params.length) throw Error("Catalogue parameter missing");
    const value = params[index++];
    if (value === null) return "NULL";
    if (typeof value === "number" && Number.isFinite(value))
      return String(value);
    if (typeof value === "string")
      return "'" + value.replaceAll("'", "''") + "'";
    throw Error("Invalid catalogue parameter");
  });
  if (index !== params.length) throw Error("Extra catalogue parameter");
  return text + ";";
}
export async function writeCatalogueSql(file, statements) {
  await writeFile(file, statements.map(statementSql).join("\n") + "\n", {
    mode: 0o600,
    flag: "wx",
  });
}
