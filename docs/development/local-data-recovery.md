# Recover local data

Use this only when startup refuses an older local database without trustworthy
migration history. Existing tables/schema alone never justify fabricated receipts:
historical SQL may contain unproved data changes. Normal startup adopts nothing.
Stop all dev/setup/local Wrangler processes for this checkout before recovery.
Keep archives and raw schema private; share only sanitized evidence/hashes.

## Preserve a dataset with proven history

A **Principal DevOps Engineer** prepares a bounded plan; an independent **Principal
Software Architect** reviews it under [issue execution](issue-execution.md).

1. Copy and verify complete D1/R2 state before any history write:

   ```sh
   state_backup=".wrangler/state-backup-$(date -u +%Y%m%dT%H%M%SZ)"
   test ! -e "$state_backup"
   cp -Rp .wrangler/state "$state_backup"
   chmod 700 "$state_backup"
   diff -rq .wrangler/state "$state_backup"
   ```

2. Prove the exact contiguous migration prefix from original successful execution
   records: ordered filenames, source commit and matching SQL hashes, covering every
   statement/data change. Missing, failed, ambiguous or partial records stop adoption;
   an old checkout, table list or schema similarity is insufficient.
3. Capture schema only (no application rows), protecting the output:

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

4. Engineer and reviewer check that prefix against `drizzle/meta/_journal.json` and
   immutable SQL; compare all application tables/constraints/indexes/triggers and
   backup completeness. Divergence/unproved data migrations stop adoption.
5. After review, create explicit `approved-baseline.sql`: only the pinned Wrangler
   `d1_migrations` definition and one receipt per proven filename, recording adoption
   time honestly. No replay, application changes, later receipts or replacement of
   unknown journals. Review records the exact prefix and SQL hashes.
6. With processes still stopped, inspect/apply only that reviewed local file:

   ```sh
   node ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local \
     --config .sites-runtime/local-dev/wrangler.json \
     --persist-to .wrangler/state \
     --file .sites-runtime/local-dev/approved-baseline.sql
   npm run dev:setup
   npm run dev
   ```

7. Verify actual HTTP catalogue plus local account/ownership/upload fixtures. Retain
   original archive/reviewed receipts. This authorizes no production operation;
   [data transfer](../operations/data-transfer.md) retains its own evidence checks.

If verification fails, stop processes, preserve failed replacement state in another
unused archive, copy original state back and compare D1/R2 byte for byte. Use the
same local CLI with `--command "PRAGMA quick_check"` and require `ok`; check private
upload bytes/inventory too. Keep the original archive; restored legacy history
remains blocked until proved.

## Start fresh with disposable data

This removes the old dataset from active development and recreates curated defaults,
while retaining its complete D1/R2 archive. From the checkout root, with processes stopped:

```sh
state_backup=".wrangler/state-backup-$(date -u +%Y%m%dT%H%M%SZ)"
test ! -e "$state_backup"
mv .wrangler/state "$state_backup"
chmod 700 "$state_backup"
npm run dev:setup
npm run dev
```

Retain the actual protected/ignored archive path; never upload it or move it into
another project. If setup fails the archive remains intact. To restore, stop
processes, archive replacement state under another unused name and move the original
back to `.wrangler/state`; its legacy history still needs verification. Recovery
performs no automatic reset, deletion or production operation.
