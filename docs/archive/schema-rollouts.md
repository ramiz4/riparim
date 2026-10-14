# Historical schema rollout notes

Applied migrations stay unchanged. These compatibility notes describe past releases;
new deployments follow [migration safety](../operations/releases.md#migrations-retry-and-rollback).

- `0015`: claim documents default to `[]`, without backfill. New writes mirror the
  first file; old code sees one. Historical fileless claims remain reviewable.
- `0016`: adds external identity mappings without changing ownership/file keys.
  After provider cutover, only identity-aware code is safe.
- `0017`: adds mail transport/MIME markers. Started NULL-transport events remain
  Resend and preserve their frozen bytes/acceptances.
- `0018`: defaults existing accounts to Supabase and binds deletion grants.
  Switching provider still requires separate private account/secret migration.
- `0020`: adds nullable workshop hours without backfill; legacy writes preserve
  approved hours and public profiles stop loading Google widgets.
- `0025`: backfills visit service lists from the scalar after backup/recovery checks.
  New writes mirror the first service; conflicting legacy scalar edits win on reread.

Additive-column rollback does not remove columns or undo provider changes.
Localized Auth templates changed no schema/secrets: activation still required
backup, exact origin, byte readback and real per-locale receipts. Started review
messages retained language/request bytes. Oracle hosting was evaluated and rejected;
that evaluation performed no production Node/domain/Auth cutover.

[Full record and original evidence](https://github.com/ramiz4/riparim/blob/bb20bb86051f3e7f82b412f0f6604ff6e460efb4/docs/archive/schema-rollouts.md).
