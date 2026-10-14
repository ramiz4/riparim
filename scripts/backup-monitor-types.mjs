import { execFileSync } from "node:child_process";
import { readFile, rm, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const temporary = join(root, "monitor/worker-env.tmp.d.ts"),
  target = join(root, "monitor/worker-env.d.ts");
try {
  execFileSync(
    process.execPath,
    [
      join(root, "node_modules/wrangler/bin/wrangler.js"),
      "types",
      "monitor/worker-env.tmp.d.ts",
      "--config",
      "wrangler.backup-monitor.jsonc",
      "--env-interface",
      "BackupMonitorBindings",
      "--include-runtime",
      "false",
      "--strict-vars",
      "false",
    ],
    { cwd: root, stdio: "pipe" },
  );
  const generated =
    (await readFile(temporary, "utf8")) +
    "\n// A module keeps generated Cloudflare declarations separate from the app.\nexport type BackupMonitorEnv = BackupMonitorBindings;\n";
  if (process.argv.includes("--check")) {
    if ((await readFile(target, "utf8")) !== generated)
      throw Error("Regenerate backup monitor binding types.");
  } else await writeFile(target, generated);
} finally {
  await rm(temporary, { force: true });
}
