import { execFileSync } from "node:child_process";
import vinext from "vinext";
import { defineConfig } from "vite";
import hostingConfig from "./.openai/hosting.json";
import { readExecutionProfile } from "./scripts/execution-profile.mjs";
import { sites } from "./build/sites-vite-plugin";
import { connectorPreview } from "./build/connector-preview-plugin.mjs";
import { vinextNavigation } from "./build/vinext-navigation.mjs";
import { releaseBuildTarget, sitesBuildConfiguration } from "./scripts/release-policy.mjs";

// macOS Seatbelt blocks FSEvents, so Codex previews need polling for HMR.
const isCodexSeatbeltSandbox = process.env.CODEX_SANDBOX === "seatbelt";
const managedLinux = readExecutionProfile() === "managed-linux";

export default defineConfig(async ({ command }) => {
  const buildTarget = releaseBuildTarget(process.env.BUILD_TARGET);
  // Use Miniflare's local Request.cf placeholder unless fetching is requested.
  process.env.CLOUDFLARE_CF_FETCH_ENABLED ??= "false";
  process.env.WRANGLER_SEND_METRICS ??= "false";

  // Keep Wrangler and Miniflare state project-local. These are non-secret tool
  // settings; application environment belongs in ignored `.env*` files.
  process.env.WRANGLER_WRITE_LOGS ??= "false";
  process.env.WRANGLER_LOG_PATH ??= ".wrangler/logs";
  process.env.WRANGLER_REGISTRY_PATH ??= ".wrangler/dev-registry";
  process.env.MINIFLARE_REGISTRY_PATH ??= ".wrangler/registry";

  // Wrangler snapshots its log path while the Cloudflare plugin is imported.
  const { cloudflare } = await import("@cloudflare/vite-plugin");

  const releaseCommit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  if (!/^[a-f0-9]{40}$/.test(releaseCommit) || (process.env.GITHUB_SHA && process.env.GITHUB_SHA !== releaseCommit)) throw new Error("Build checkout must match its workflow commit.");

  return {
    define: { __RIPARIM_RELEASE_COMMIT__: JSON.stringify(releaseCommit) },
    server: {
      ...(managedLinux
        ? { host: "0.0.0.0", allowedHosts: ["terminal.local"] }
        : {}),
      ...(isCodexSeatbeltSandbox
        ? { watch: { useFsEvents: false, usePolling: true } }
        : {}),
    },
    plugins: [
      vinext(),
      vinextNavigation(),
      sites({ mockAuth: !managedLinux }),
      connectorPreview(),
      cloudflare({
        configPath: command === "serve" || buildTarget === "sites" ? "./wrangler.sites.jsonc" : "./wrangler.jsonc",
        viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
        inspectorPort: false,
        // The plugin concatenates arrays. Local previews and Sites builds use
        // the same logical bindings over a base without production resources.
        config: command === "serve" ? () => ({
          ...sitesBuildConfiguration(hostingConfig),
          vars: { SITE_ORIGIN: process.env.SITE_ORIGIN ?? "http://127.0.0.1:5174" },
          services: [{ binding: "CONNECTORS", service: "sites-connector-preview", entrypoint: "ConnectorPreview" }],
        }) : buildTarget === "sites" ? () => sitesBuildConfiguration(hostingConfig) : undefined,
        ...(command === "serve"
          ? {
              auxiliaryWorkers: [
                {
                  config: {
                    name: "sites-connector-preview",
                    main: "./build/connector-preview-worker.mjs",
                    compatibility_date: "2026-05-15",
                  },
                },
              ],
            }
          : {}),
      }),
    ],
  };
});
