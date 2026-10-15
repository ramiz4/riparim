# Local recovery

Stop this checkout's dev/setup/Wrangler processes before changing state.
Keep backups and raw schema private and ignored; share only sanitized evidence.
Recovery here targets local data, never production.

## A preparation lock remains

Read `.wrangler/state/.riparim-prepare.lock/owner.json` and inspect its PID with
`ps -p <pid> -o pid=,command=`. PID reuse or lock age proves nothing.
Remove the lock only after verifying that no preparation owns this state;
retain it if ownership is uncertain. Normal shutdown releases its own lock.

## Automatic legacy backup

`npm run dev` (and `npm run dev:setup`) automatically archives local application
state that has no migration history, then prepares fresh catalogue defaults.
The printed `.wrangler/state-backup-*` path contains the original D1/R2 state,
with private directory permissions. Keep it until its data is no longer needed.
No legacy records are automatically imported and no migration receipts are fabricated.

If archiving fails midway, startup stops and retains the preparation lock to block
retries. With all processes stopped, move the entries from the printed backup back
into `.wrangler/state` before clearing the abandoned lock. Preserve both locations;
never overwrite conflicting entries. Then address the reported filesystem error.

To inspect or recover an archived legacy dataset, use the reviewed procedure below
on a private copy. Simply restoring it and running `dev` archives it again.

## Start fresh with disposable data

This archives the complete D1/R2 state, removes it from active development and
recreates curated defaults. From the checkout root, with all processes stopped:

```sh
state_backup=".wrangler/state-backup-$(date -u +%Y%m%dT%H%M%SZ)"
test ! -e "$state_backup"
mv .wrangler/state "$state_backup"
chmod 700 "$state_backup"
npm run dev:setup
npm run dev
```

Retain the archive path. To restore, stop processes, preserve replacement state
under another unused archive name and move the original back. Its legacy history
still needs verification. Never upload the archive or move it into another project.

## Keep an older dataset

Existing tables do not prove which data migrations ran. Startup archives missing history and refuses
unknown/incomplete/divergent recorded history rather than fabricating receipts or replaying SQL.
A **Principal DevOps Engineer** prepares the plan; an independent **Principal Software
Architect** reviews it under [issue execution](issue-execution.md).

1. Copy complete state and verify the backup before any write:

   ```sh
   state_backup=".wrangler/state-backup-$(date -u +%Y%m%dT%H%M%SZ)"
   test ! -e "$state_backup"
   cp -Rp .wrangler/state "$state_backup"
   chmod 700 "$state_backup"
   diff -rq .wrangler/state "$state_backup"
   ```

2. Prove the exact contiguous migration prefix from successful execution records:
   ordered filenames, source commit and matching SQL hashes for every statement/data change.
   Missing, failed, ambiguous or partial evidence stops adoption; schema similarity is insufficient.
3. Capture schema only, not account rows, for private review:

   ```sh
   (
     umask 077
     node ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local \
       --config .sites-runtime/local-dev/wrangler.json --persist-to .wrangler/state --json \
       --command "SELECT name,type,tbl_name,sql FROM sqlite_schema WHERE sql IS NOT NULL ORDER BY name" \
       > .sites-runtime/local-dev/legacy-schema-review.json
   )
   ```

4. Compare every table/constraint/index/trigger and the backup with that prefix,
   [journal](../../drizzle/meta/_journal.json) and immutable SQL. Stop on divergence.
5. Review `approved-baseline.sql`: only the pinned Wrangler `d1_migrations` definition
   and one receipt per proven filename, using the real adoption time. Record prefix/SQL hashes.
   It must not replay SQL, alter application data, mark later files applied or replace an unknown journal.
6. With processes stopped, inspect and apply only the reviewed local baseline:

   ```sh
   node ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local \
     --config .sites-runtime/local-dev/wrangler.json --persist-to .wrangler/state \
     --file .sites-runtime/local-dev/approved-baseline.sql
   npm run dev:setup
   npm run dev
   ```

7. Verify actual HTTP catalogue and account/ownership/upload fixtures. Retain the
   original backup/receipts; [data transfer](../operations/data-transfer.md) has separate checks.

If verification fails, stop processes, archive failed replacement state, copy the
original back and compare D1/R2 byte for byte, including private file inventory.
Run the same local CLI with `--command "PRAGMA quick_check"` and require `ok`.
Keep the original archive; restored legacy history remains blocked until proved.
