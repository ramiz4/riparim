# Locked tool-job installations

The verification job still installs the complete root `package-lock.json` with
`npm run install:ci`. Only the three following tool jobs use independent private
manifests and npm v3 locks under `.github/tools/`:

| Job | Direct root-pinned packages | Purpose |
| --- | --- | --- |
| PR title | `@commitlint/cli`, `@commitlint/config-conventional` | Existing root `commitlint.config.mjs`, including warnings and breaking-change parsing |
| Semantic release | `semantic-release`, `conventional-changelog-conventionalcommits` | Existing root release config and its analyzer, notes-generator and GitHub plugins |
| Cloudflare deploy | `wrangler`, `esbuild` | Exact Wrangler CLI plus the external D1 catalogue-plan source verification |

`npm run install:tool -- title` (or `release` / `deploy`) requires a clean
checkout without root `node_modules`. It validates exact direct root pins and
lock entries before `npm ci`, then links the installed tool tree at root
`node_modules`. The root scripts and configs consequently use their original
module and CLI paths. Existing directories and dangling links are rejected,
never replaced. Each workflow caches npm against its selected tool lock.

The deploy manifest preserves the root Miniflare/sharp override and native
binary installation policy. Its source import graph is
`deploy-cloudflare` → `apply-catalogue-release` → `catalogue-release-plan`
→ esbuild → the central TypeScript catalogue statement factory. That factory's
runtime imports are local modules and JSON; database interfaces are erased
types. `esbuild` is required even though deployment uploads compiled bytes.
No app React, Next, Vinext, Vite or Drizzle packages are installed in these jobs.
Commitlint's configuration loader requires TypeScript transitively; it remains.
Semantic Release's dependencies also remain complete, including its bundled
default plugins, although root configuration publishes only GitHub assets.

When changing root tool pins or deploy overrides, update the corresponding
manifest and lock together. Registered policy tests detect drift; root app
installation remains independent. Never use unversioned `npx` downloads.

## Verification and measurements

`node scripts/check-tool-install.mjs <tool>` checks an installed tree offline:
title valid/invalid/scope/breaking/header/body rules through the actual root
Commitlint config; release plugin loading, semantic analysis and rendered notes;
deploy exact versions, Wrangler `--version`, and real catalogue-plan compilation.
It performs no release, deployment, migration or provider API request.

Initial isolated cloud-host installs used empty per-tool npm caches, then
reinstalled from the same warm caches. Cold values were title 17.89 s,
release 23.79 s and deploy 21.43 s. These installs ran concurrently and serve as
reproducibility evidence, not comparable speed claims. The full root install
reported 1,041 packages. Controlled GitHub Actions comparisons and final timing
results are recorded after the read-only benchmark, before merge.

Production permissions, secrets, serial `production-release` concurrency,
exact source checkout, four release assets, SHA-256 validation, retry behavior,
external catalogue import checks and upload ordering are unchanged.
