# Local development

Use the repository's supported Node.js version and npm. Node.js 24 LTS is the CI baseline and the recommended development version; supported versions remain defined by `package.json`. Go is needed for the full test suite and Auth email template export, but not for starting development.

```sh
npm run install:ci
npm run dev
```

The default address is `http://127.0.0.1:5174`. Startup checks its local prerequisites, verifies the database's schema/history, applies pending migrations, prepares the existing curated catalogue/contact/email/opening-hours defaults, then starts Vinext. A fresh clone needs no build or real Cloudflare account. Optional live Auth, email and Google integrations keep their separate setup requirements.

```sh
npm run dev:setup
npm run dev -- --host 127.0.0.1 --port 5180
```

`dev:setup` runs exactly the same preparation and exits. The selected port determines the local origin when `SITE_ORIGIN` is unset. An explicit `SITE_ORIGIN` overrides it; keep that override consistent with the address you use. Existing checkout-local execution profiles retain their own managed preview behavior.

## State and updates

Migration, seed and Vite use the same checkout-local `.wrangler/state` directory and local `DB`/`BUCKET` bindings. Separate worktrees have independent databases and uploads. Every preparation data command targets local state explicitly, including when production credentials exist in the environment.

The checked-in `drizzle/` SQL files are the schema source. Wrangler's `d1_migrations` receipts record applied filenames. On restart, only pending migrations run. If a later migration fails, earlier successful migrations can remain applied; fix the reported cause and rerun preparation to resume. Do not edit an applied migration or execute its SQL manually.

The seed preserves the existing contracts: newer local profile edits, owner-confirmed opening hours, suppressed imports and modified imported hours remain protected. Updated curated sources can update eligible older records. The bootstrap adds no customer accounts, visits, reviews or private evidence. It does not reset data after failures.

## Diagnose a failure

The terminal identifies the failed phase, local configuration/state path, exit or spawn error, relevant sanitized cause and local log path. Read the indicated log rather than retrying unrelated setup steps. Logs and generated configuration remain under ignored `.sites-runtime/local-dev`.

- Missing dependency or unsupported runtime: use a supported Node version and rerun `npm run install:ci` in this worktree.
- Migration failure: inspect the named migration and database/history diagnosis. Preserve already-applied SQL and retry after fixing the actual cause.
- Seed validation failure: inspect the checked-in source or permission error. Do not bypass schema checks or overwrite existing local edits.
- Another preparation is active: wait for it to finish. Stop your dev processes before moving state or recovering from a forced interruption. Never remove a lock owned by a live process.
- Unknown history or schema: follow the legacy procedure below. A missing receipt does not mean it is safe to replay every migration.

SIGINT/SIGTERM abort preparation without claiming server readiness. A later retry uses the actual migration history. A port already in use remains a server error; choose another port or stop the process that owns it.

After a forced kill, the preparation lock can remain at `.wrangler/state/.riparim-prepare.lock`. Read its `owner.json` and inspect the recorded PID, for example with `ps -p <pid> -o pid=,command=`. A reused PID is not proof of an abandoned lock. Stop the checkout's dev/setup/Wrangler processes and verify that no preparation still owns this state before explicitly removing the abandoned lock directory. If ownership is uncertain, retain the lock and diagnose it. Normal shutdown releases its own lock; startup never forcibly removes an existing one.

## Older databases without trustworthy migration history

Previous instructions applied individual SQL files with `d1 execute`. Such a database may already contain tables while having no `d1_migrations` history. Replaying `CREATE TABLE` or `ALTER TABLE` would fail or produce an unsafe partial update. Startup therefore stops before migration or seed writes. Unknown, incomplete or divergent tracked schemas also stop.

Do not fabricate receipts based only on existing table names or a matching schema. Historical migrations can contain data changes that table definitions cannot prove. Startup does not adopt history automatically. Use one of the explicit procedures below.

### Retain an existing dataset with verified execution records

This is a one-time reviewed history adoption, separate from ordinary startup. A **Principal DevOps Engineer** prepares the bounded plan, and an independent **Principal Software Architect** reviews it under [issue execution](issue-execution.md). Request that specific review with the evidence below; do not upload database files, private uploads, credentials or raw customer rows.

1. Stop every dev/setup/local Wrangler process using this checkout. Copy the complete D1/R2 state to a protected unused archive, leaving the active dataset in place. Verify the copy before any history write:

   ```sh
   state_backup=".wrangler/state-backup-$(date -u +%Y%m%dT%H%M%SZ)"
   test ! -e "$state_backup"
   cp -Rp .wrangler/state "$state_backup"
   chmod 700 "$state_backup"
   diff -rq .wrangler/state "$state_backup"
   ```

2. Establish the exact contiguous applied migration prefix from the original successful execution records. Supply ordered filenames, the original source commit, and hashes of the executed SQL that match the checked-in migration set. The records must account for every statement, including data changes; an old checkout alone, a table list or schema similarity is insufficient. Missing, failed, ambiguous or partial records stop adoption.
3. Capture schema definitions only, through the installed local CLI, into a protected local review file. This reads no application rows and leaves the state archive byte-for-byte intact:

   ```sh
   (
     umask 077
     node ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local \
       --config .sites-runtime/local-dev/wrangler.json \
       --persist-to .wrangler/state --json \
       --command "SELECT name,type,tbl_name,sql FROM sqlite_schema WHERE sql IS NOT NULL ORDER BY name" \
       > .sites-runtime/local-dev/legacy-schema-review.json
   )
   ```

4. The two reviewers verify the trusted execution prefix against `drizzle/meta/_journal.json` and the immutable SQL, compare the complete application schema/constraints/indexes/triggers with that exact prefix, and confirm backup completeness. Share sanitized evidence and hashes in the review request; keep the actual archive local. A divergent schema or unproved data migration is a stop condition.
5. Only after that review, the engineer supplies an explicit `approved-baseline.sql` for this state and proven prefix. Its allowed effects are solely creation of the pinned Wrangler-native `d1_migrations` definition and one receipt for each proved migration filename. It must not rerun migration SQL, modify application tables/rows, mark later migrations applied, or replace an existing unknown journal. Record the adoption time as such rather than inventing historical execution timestamps. The review records the exact prefix and SQL hashes.
6. With all checkout processes still stopped, inspect and apply that reviewed file using the local target, then let normal preparation validate the journal/schema and apply only pending migrations:

   ```sh
   approved_baseline_sql=".sites-runtime/local-dev/approved-baseline.sql"
   node ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local \
     --config .sites-runtime/local-dev/wrangler.json \
     --persist-to .wrangler/state --file "$approved_baseline_sql"
   npm run dev:setup
   npm run dev
   ```

7. Verify the actual HTTP catalogue and the required local account/ownership/upload fixtures against the preserved dataset; retain the original archive and reviewed receipts. This handoff authorizes no production operation and performs no automatic data adoption. The existing [data transfer](data-transfer.md) workflow retains its own schema/history and evidence verification requirements.

If any verification fails, stop all checkout processes, preserve the failed replacement state under another unused archive name, copy the original archive back to `.wrangler/state`, and compare its D1/R2 files byte for byte. Run the local CLI with `--command "PRAGMA quick_check"` and require `ok`; verify the archived private upload bytes/inventory as well. The restored legacy state remains blocked until its history can be proved. Never erase the original archive to make verification pass.

### Start fresh with a disposable dataset

For a disposable development database, explicitly archive the complete local state before starting fresh. **This removes the old dataset from active development and recreates curated defaults; the archived state remains available.** Stop all dev, setup and local Wrangler processes for this checkout first. Run from the checkout root:

```sh
state_backup=".wrangler/state-backup-$(date -u +%Y%m%dT%H%M%SZ)"
test ! -e "$state_backup"
mv .wrangler/state "$state_backup"
npm run dev:setup
npm run dev
```

The archive includes D1 and R2 state. It can contain private local test data, so keep it ignored and protected; do not upload it or copy it into another project's checkout. Retain its actual path. If preparation fails, the archive is still intact.

To restore the archived state, stop the checkout's processes again, preserve the replacement state under a different unused archive name, and move the original archive back to `.wrangler/state`. The original legacy database will continue to require verified history handling. No automated reset, deletion or production data operation is part of this recovery.

## Verification

`tests/local-dev-startup.test.mjs` drives the actual dev entry point in disposable source checkouts and verifies HTTP catalogue/profile reads. The bootstrap tests cover migration history, safe legacy refusal, retries, locking and failure diagnostics with isolated local state. Existing seed tests protect imported/owner/local edit behavior. The new suites run through the normal core test registry and require no provider credentials or real emails.

For changes, run all required checks from `.github/workflows/ci.yml`, including core tests, Node integration and both Worker targets. Database preparation adds no extra build prerequisite to the everyday dev command.
