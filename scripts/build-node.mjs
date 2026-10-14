import { build } from "esbuild";
import { spawnSync } from "node:child_process";
import {
  assertNodeInputs,
  nodeOutputDigest,
  nodeSourceDigest,
} from "./node-release.mjs";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

await assertNodeInputs();
const sourceDigest = await nodeSourceDigest();
await mkdir(".node-runtime", { recursive: true });
await build({
  entryPoints: {
    command: "scripts/node-command.ts",
    server: "scripts/node-server.ts",
    install: "scripts/deploy-node.mjs",
  },
  outdir: ".node-runtime",
  outExtension: { ".js": ".mjs" },
  bundle: true,
  format: "esm",
  platform: "node",
  packages: "external",
  alias: {
    "@/lib/runtime/env": resolve("lib/runtime/node-env.ts"),
    "@/lib/notifications/smtp": resolve("lib/notifications/node-smtp.ts"),
    "next/headers": "next/headers.js",
    "next/navigation": "next/navigation.js",
  },
});
const built = spawnSync(
  process.execPath,
  ["node_modules/next/dist/bin/next", "build", "--webpack"],
  { stdio: "inherit", env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" } },
);
if (built.status === 0) {
  if (sourceDigest !== (await nodeSourceDigest()))
    throw Error("Source changed during Node build.");
  await writeFile(
    ".node-runtime/build.json",
    JSON.stringify({ sourceDigest, outputDigest: await nodeOutputDigest() }) +
      "\n",
  );
}
process.exitCode = built.status ?? 1;
