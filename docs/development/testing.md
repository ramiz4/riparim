# Testing

Run from the task worktree after `npm run install:ci`, with Node.js 24 LTS
(24.10 or newer) and Go 1.27.1 (or `RIPARIM_GO_BINARY`). Tests use isolated SQLite/R2/provider fixtures;
no real email or production data is involved. CI in
[`.github/workflows/ci.yml`](../../.github/workflows/ci.yml) is authoritative.

## Local CI checks

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

The cleanup command removes only generated checkout-local `dist/` before the
Sites build, matching CI; never reuse the previous target's output. The workflow-lint
script downloads SHA-256-pinned actionlint; supported hosts are Linux amd64/macOS arm64.
Packaging requires clean committed source; run package commands after the reviewed commit.
Docs-only work needs Markdown links/anchors, formatting, scope review and diff checks,
not application builds. Executable changes run the full CI checks above.

## Focused iteration

- `npm test` runs all registered suites, checking i18n first and building Node once.
  `--group core` skips Node integration/build; `--group node` runs both integrations.
  Explicit `RIPARIM_NODE_PREBUILT` must match current source/output digests.
- Linux/macOS/WSL run four independent suite processes by default.
  `TEST_CONCURRENCY=1 npm test` runs serially; values 1–4 are supported. Native Windows
  is refused before suites/state changes because cleanup requires POSIX process groups.
- Logs identify each suite. Failure stops queued/running siblings; signals return
  130 (SIGINT)/143 (SIGTERM). Descendants receive SIGTERM then SIGKILL after 500 ms
  if needed; shared `.test-runtime` is removed only after processes/output close.
  Suites own isolated directories/ports, not the shared root.
- `npm run build` includes client navigation, prefetch-failure and Worker/i18n tests
  for each target. `npm run test:client-build` repeats client checks on an existing build.
- Local startup tests exercise real HTTP catalogue/profile reads in disposable
  checkouts; bootstrap/seed suites cover history refusal, retries, locking and preserved edits.
- Customer/auth/UI work also follows [customer-flow QA](customer-flow-qa.md): provider
  fixtures do not establish live login or production deployment.

Use meaningful observable-contract tests with relevant error/permission cases.
For issue work, follow [TDD and independent reviews](issue-execution.md).
CI architecture and benchmark tooling are in [CI](ci.md); older concurrency and
shutdown measurements are in [the archive](../archive/README.md).
