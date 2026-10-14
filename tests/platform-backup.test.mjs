import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const result = spawnSync(
  "python3",
  [fileURLToPath(new URL("./platform-backup.test.py", import.meta.url))],
  { stdio: "inherit", env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" } },
);
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
