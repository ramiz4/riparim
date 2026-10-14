import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { sitesBuildConfiguration } from "./release-policy.mjs";
import { redactLocalDiagnostic } from "./local-diagnostics.mjs";

export const checkoutRoot = fileURLToPath(new URL("../", import.meta.url));
export const defaultLocalDevPort = 5174;

export async function localDevelopmentConfiguration(root = checkoutRoot) {
  root = resolve(root);
  const runtimePath = resolve(root, ".sites-runtime/local-dev");
  const local = {
    root,
    runtimePath,
    configPath: resolve(runtimePath, "wrangler.json"),
    persistPath: resolve(root, ".wrangler/state"),
    wranglerPath: resolve(root, "node_modules/wrangler/bin/wrangler.js"),
  };
  let base;
  try {
    const hosting = JSON.parse(
      await readFile(resolve(root, ".openai/hosting.json"), "utf8"),
    );
    base = sitesBuildConfiguration(hosting);
  } catch (error) {
    throw new Error(
      redactLocalDiagnostic(
        `Local development configuration failed (${error.code ?? error.name}).\n` +
          `Check the tracked .openai/hosting.json in ${root}.\n` +
          `Database: DB (local only)\nConfig: ${local.configPath}\nState: ${local.persistPath}\n` +
          `Next: restore the checkout's valid hosting configuration; see docs/development/local-development.md.`,
      ),
    );
  }
  return {
    ...local,
    wranglerConfig: {
      ...base,
      main: resolve(root, base.main),
      d1_databases: base.d1_databases.map((database) => ({
        ...database,
        migrations_dir: resolve(root, "drizzle"),
      })),
    },
  };
}
