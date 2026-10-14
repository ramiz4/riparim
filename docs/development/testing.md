# Testing

Use Node.js 24 LTS (24.10 or newer), npm and Go 1.27.1 for the test suite,
including the `core` group. Go renders the Auth email tests and exports;
set `RIPARIM_GO_BINARY` if it is not on PATH. Install dependencies separately
in your task checkout with `npm run install:ci`.

## While making a change

```sh
npm test -- --group core
npx tsc --noEmit
npm run lint
npm run format:check
```

`core` runs the non-Node-integration suites without building Node.
Run a single relevant file with `node tests/<suite>.test.mjs` for faster iteration.
`npm test` runs the complete suite, including one Node build and both integrations.
Tests use isolated storage/providers and send no real email.

On Linux, macOS and WSL, suites run four at a time; `TEST_CONCURRENCY=1 npm test`
helps diagnose failures serially (allowed values: 1–4). Logs identify the failed suite.
Native Windows is unsupported; use WSL. The runner stops and cleans up its own processes.

If macOS reports `Restore parent must have a canonical private path`, use a private
temporary directory in this checkout instead of the system's symlinked temp path:

```sh
mkdir -p .sites-runtime/test-tmp
chmod 700 .sites-runtime/test-tmp
TMPDIR="$(pwd -P)/.sites-runtime/test-tmp" npm test -- --group core
```

## Before a PR

- **Documentation:** check formatting, English prose, local links/anchors and the full diff.
  Run `npm run language:check` and `git diff --check`; app builds are unnecessary.
- **Code:** run [all CI checks](ci.md#run-all-ci-checks), including the target builds.
  CI must pass for the exact PR commit before merge. Package commands need clean
  committed source; run them after the reviewed commit.
- **UI or Auth:** also follow [customer-flow QA](customer-flow-qa.md).
  Isolated fixtures do not prove real login, delivery or deployment.

Test observable behavior and relevant error/permission cases. For issue execution,
use [TDD and independent reviews](issue-execution.md). Older runner measurements
and cleanup investigations remain in [the archive](../archive/README.md).
