# Locked tool-job installations

Each verification branch (`quality`, `node`, `workers`) installs the complete
root `package-lock.json` with `npm run install:ci`; the final gate installs no
dependencies. Only the three following tool jobs use independent private
manifests and npm v3 locks under `.github/tools/`:

| Job               | Direct root-pinned packages                                      | Purpose                                                                               |
| ----------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| PR title          | `@commitlint/cli`, `@commitlint/config-conventional`             | Existing root `commitlint.config.mjs`, including warnings and breaking-change parsing |
| Semantic release  | `semantic-release`, `conventional-changelog-conventionalcommits` | Existing root release config and its analyzer, notes-generator and GitHub plugins     |
| Cloudflare deploy | `wrangler`, `esbuild`                                            | Exact Wrangler CLI plus the external D1 catalogue-plan source verification            |

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

The read-only [Actions benchmark](https://github.com/ramiz4/riparim/actions/runs/38097121619/job/114345209368)
installed the complete app and each tool tree serially on the same Ubuntu
runner with Node 24.21.0, four CPUs and 16,766,414,848 bytes RAM. Every fixture
used the exact same PR merge commit
`f82fac09f00a0cb56043d59b4440188e5eabf285` (PR head `d3811ae`). Each profile had
its own initially empty npm cache, then repeated `npm ci` against that warm
cache. All twelve offline smoke completions passed: the three tool checks in
each app-install state, plus each corresponding isolated tool check in both
states. The temporary benchmark workflow was removed before merge.

| Install       | Cold wall time | Warm wall time | npm-reported installed packages |
| ------------- | -------------: | -------------: | ------------------------------: |
| Complete app  |        18.91 s |        14.29 s |                           1,037 |
| Title tools   |         2.03 s |         1.68 s |                              76 |
| Release tools |         2.90 s |         2.09 s |                             302 |
| Deploy tools  |         2.73 s |         2.17 s |                              39 |

Against installing the full app in every tool job, title installation saved
16.88 s cold / 12.61 s warm. Release plus deploy saved 32.19 s cold / 24.32 s
warm. These measurements describe installation work, excluding job queueing,
runner setup, artifact transfers and publication. The actual new
[Conventional PR title job](https://github.com/ramiz4/riparim/actions/runs/38097121600/job/114345209248)
completed in 10 s with a 3 s installation step.

Separate cloud-host cold/warm installs also passed with all offline smokes.
They reported 1,041 app packages and 42 deploy packages; installed counts vary
with optional platform dependencies. Their concurrent cold install timings
(title 17.89 s, release 23.79 s, deploy 21.43 s) demonstrate reproducibility,
not a comparable speed measurement. All direct root pins and release plugin
versions matched the root lock.

Production permissions, secrets, serial `production-release` concurrency,
exact source checkout, four release assets, SHA-256 validation, retry behavior,
external catalogue import checks and upload ordering are unchanged.
