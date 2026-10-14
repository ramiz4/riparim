import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { isDeepStrictEqual } from "node:util";
import {
  catalogueReleasePlan,
  statementSql,
  writeCatalogueSql,
} from "./catalogue-release-plan.mjs";

export async function applyCatalogueRelease({
  planPath,
  root,
  commit,
  cli,
  config,
  directory,
  run,
  options,
}) {
  const plan = JSON.parse(await readFile(planPath, "utf8"));
  const source = JSON.parse(
    await readFile(join(root, "data/workshops.json"), "utf8"),
  );
  const expected = await catalogueReleasePlan(source, commit, root);
  if (!isDeepStrictEqual(plan, expected))
    throw Error("Released catalogue plan does not match the checked source");
  const base = [cli, "d1", "execute", "DB", "--remote", "--config", config];
  const result = JSON.parse(
    run(
      process.execPath,
      [
        ...base,
        "--command",
        statementSql({
          sql: "SELECT value FROM catalog_state WHERE key=?",
          params: [plan.key],
        }),
        "--json",
      ],
      options,
    ),
  );
  if (
    !Array.isArray(result) ||
    result.some((r) => r.success !== true || !Array.isArray(r.results))
  )
    throw Error("Catalogue completion marker could not be checked");
  if (result.some((r) => r.results.length > 0))
    return { imported: false, reason: "complete" };
  for (let start = 0; start < plan.statements.length; start += 50) {
    const file = join(directory, `catalogue-${start}.sql`);
    await writeCatalogueSql(file, plan.statements.slice(start, start + 50));
    run(process.execPath, [...base, "--file", file, "--yes"], options);
  }
  const file = join(directory, "catalogue-complete.sql");
  await writeCatalogueSql(file, [
    { sql: plan.completionSql, params: [plan.key, new Date().toISOString()] },
  ]);
  run(process.execPath, [...base, "--file", file, "--yes"], options);
  return { imported: true, statements: plan.statements.length };
}
