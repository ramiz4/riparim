# CI

Run the [local checks](testing.md) for your change. [ci.yml](../../.github/workflows/ci.yml)
is authoritative: `quality` checks core tests/types/lint, `node` builds once and
runs two integrations, and `workers` builds Cloudflare/Sites. The final
`Tests, types, lint and build` gate requires all three. Each verification job uses
`npm run install:ci`; the gate needs no dependencies.

## Run all CI checks

Run from the task worktree after `npm run install:ci`. The workflow defines the
required commands. Packaging requires clean committed source; run package commands
after the reviewed commit. Keep dependencies and generated outputs in this worktree.

```sh
bash scripts/check-workflows.sh
npm run format:check
npm run catalog:check
npm test -- --group core
npx tsc --noEmit
npm run lint
npm run backups:worker:check
npm run build:node
RIPARIM_NODE_PREBUILT="$PWD" npm test -- --group node
node scripts/package-release.mjs node
BUILD_TARGET=cloudflare npm run build
npm run release:package
node -e 'require("node:fs").rmSync("dist", { recursive: true, force: true })'
BUILD_TARGET=sites npm run build
node scripts/package-release.mjs sites
git diff --check
```

The cleanup removes only generated worktree-local `dist/` before the Sites build;
never reuse another target's output. Workflow lint downloads SHA-256-pinned
actionlint on supported Linux amd64/macOS arm64 hosts. Documentation-only changes
use [documentation checks](testing.md#before-a-pr) instead of app builds.

## Locked tool jobs

PR-title, release and deploy jobs install smaller locked profiles:

- `title`: Commitlint and its Conventional Commit config.
- `release`: Semantic Release and the Conventional Commit plugin.
- `deploy`: Wrangler and esbuild for catalogue-plan verification.

```sh
npm run install:tool -- title
node scripts/check-tool-install.mjs title
```

Substitute `release` or `deploy` as needed. Start from a clean checkout without
root `node_modules`; existing directories or dangling links are rejected.
The check runs offline, without publication or provider requests.
When changing tools, update root pins and the matching `.github/tools/` manifest,
lockfile and deploy overrides together. Keep native-binary/Miniflare sharp policy
and complete plugin dependencies; never use unversioned `npx`.
[Past installation measurements](../archive/ci-tool-installs.md).

## Change workflows safely

Use unique ASCII `Category: Purpose` names and contextual `run-name`; filenames
are stable trigger/monitor identities. Preserve required check names exactly:
`Tests, types, lint and build`, `Conventional PR title`, and
`Verify merged main / Tests, types, lint and build`. Monitor labels
`Supabase Auth Backup` and `Platform Backup` also stay stable.

`tests/ci-workflow.test.mjs` checks names/triggers. Run
`scripts/check-workflows.sh` for SHA-256-pinned actionlint; its optional
ShellCheck/Pyflakes integrations are disabled.
For runtime experiments, use [CI benchmarking](ci-benchmark.md).
Production verification/publication stays serialized: [releases](../operations/releases.md).
