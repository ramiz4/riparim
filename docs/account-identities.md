# Stable accounts and external login identities

Riparim treats account IDs as opaque internal keys. Ownership rights,
file paths, roles, blocks, and delivery events continue to use these
keys. The private `auth_identities` table separately maps
`provider`, a normalized HTTPS `issuer`, and `subject` to them. An account can have
exactly one identity per provider and issuer; each external identity belongs
to exactly one account. Email addresses and editable profile metadata are
not proof of a mapping.

Historical keys such as `supabase:projekt.supabase.co:<uuid>` remain
unchanged. Their readable format has no domain meaning. Only the
migration and compatibility boundary in `lib/auth/legacy-supabase.ts` know
this format. New Supabase accounts also receive such keys during the compatible
rollout phase so that a still-running predecessor version
refers to the same accounts. The complete normalized issuer authority
distinguishes different ports; standard HTTPS retains old keys.
Other providers can receive a new random internal key.
The identity module uses the same mapping for the concrete
PocketBase adapter; configuration and private operator migration are documented in
[auth-provider.md](auth-provider.md).

## Migration and rollout

The new additive Drizzle migration `0016_account_identities.sql` runs before
the new application code. It backfills historical account references from
sessions, legacy links, roles and role assignments, blocks, deletion grants,
reviews and moderation, uploads, business data, and delivery events.
Ownership keys and files are not rewritten. Old writers can
continue after migration; the resolver registers accounts they create later
when needed. Old sessions and deletion grants without issuer fields are valid
only for their historical source identity.
Backfilled mappings use the fixed migration marker
`2026-10-11T00:00:00.000Z` as `created_at` so repeated upgrades
of the same historical export source produce the same transferable rows.
Later new mappings use their actual creation time.

New session entries store provider, issuer, and subject separately from the
password/Google login method. An identical external session ID
from another project therefore cannot use an existing session grant.
Role revocation and blocks continue to apply to the internal account ID.

This task changes neither live accounts nor provider configuration. An
actual provider switch requires a separate controlled
data/identity migration assignment and complete, reviewed inventory lists.

## Explicit verified mapping

`linkAccountIdentity(existing, next, verify)` is a function used exclusively
on the server or offline. There is no public route
and no automatic linking of identical email addresses. The
trusted caller must independently verify **both** identities and
prove their explicit assignment to the same internal account. For a
migration, this proof can come from a reviewed migration list with exact
source/target identifiers; for an account-driven mapping, it can come from two
fresh server-verified logins. A provider query alone
proves only that an account exists and does not replace the verified mapping decision.
Never compare by email alone.

The source must already be registered. Before the write call, the
controlled migration process internally records the account ID and both
provider/issuer/subject tuples, without tokens, secrets, or email addresses.
The return value must exactly match the expected internal account ID.
A minimal call in a trusted migration program is:

```ts
const accountId = await resolveAccount(sourceIdentity);
if (accountId !== reviewedMapping.accountId) throw Error("SOURCE_MISMATCH");
const linked = await linkAccountIdentity(
  sourceIdentity,
  targetIdentity,
  async (identity) => {
    // Exact approved tuple, plus independent server-side provider verification.
    // The proof must include the issuer, never only subject or email.
    return verifyApprovedIdentity(reviewedMapping, identity);
  },
);
if (linked !== reviewedMapping.accountId) throw Error("TARGET_MISMATCH");
```

The function never reassigns existing bindings or merges accounts.
Unmapped accounts already used by an old writer are protected too.
Database uniqueness and the atomic check prevent
concurrent bindings across accounts. Existing application sessions
are revoked when a mapping is added; a new login is then required.
Inactive or deleted accounts can be migrated in a controlled manner to the same internal
ID; their block or deletion tombstone remains
unchanged and applies immediately to the target identity. Incomplete
migration lists do not constitute an approved cutover: all existing accounts, including
blocks and started deletions, must have verified mappings before
target logins are enabled.

During the compatible schema rollout, the old login project remains active.
Before writing target mappings or enabling the target project,
all old writers must be stopped. Otherwise an old version would
continue to create different ownership keys for the target project. After mapping,
the migration process verifies every expected source/target relationship through the
resolver, compares inventory counts, and checks customer, admin, blocking, and
deletion flows with isolated accounts. The auth adapter also explicitly supports server-approved
compatible HTTPS hosts. Its configuration does not replace account migration; see
[auth providers and switching](auth-provider.md).

## Deletion, delivery, and return path

User administration and self-service account functions translate the current
external identity to the internal ID. Self-protection and roles use the
internal ID; provider operations use the verified current subject.
Deletion grants store their issuer and cannot be used at another project.
Self-deletions started before a project switch must be
completed at the original project or continued administratively afterwards through
the verified new mapping. The pending list shows the current
mapped subject even after its provider account has been deleted.

After successful deletion, identity mappings and local
tombstones remain. This prevents surviving tokens or old external
accounts from obtaining a new internal identity or earlier rights.
Files, reviews, business assignments, sessions, and delivery events
continue to be cleaned up. The currently configured provider account is
deleted; retiring old provider projects and their remaining
accounts belongs to the separate provider switch, which requires their administrative
access.

The outbox finds the current provider contact through the mapping, including
confirmed private legacy native links. It does not parse internal IDs
and retains block checks, verified contacts, immutable retry payloads,
and idempotency.

Before target mappings/cutover, the application may return to the verified
predecessor version; additive tables and nullable columns
remain. Do not change or roll back any applied migration.
After a cutover, only an identity-aware version is a safe
rollback. Switching back to the original provider uses the
preserved original mappings and requires a new login; never
delete identity rows to bypass a conflict check.

## Evidence

`tests/account-identities.test.mjs` checks the actual additive migration,
new/old identities, distinct issuers, explicit double verification,
concurrent bindings, later predecessor writers, unchanged private
file paths, foreign identities with identical email/forged metadata,
role revocation, blocking during mapping, admin self-protection, current
outbox contacts, and repeatable account deletion. Existing password,
Google, legacy native-link, account, and administration checks remain
registered; `tests/account-settings.test.mjs` also checks late
predecessor deletion grants. All provider responses are synthetic; no real
messages or account migrations are triggered.

`tests/account-identities-worker.test.mjs` also runs the same migration and
binding/conflict checks against the actual D1 implementation.
The migration uses small nested selects; binding checks
references with direct `NOT EXISTS` so both paths also comply with their SQL limits.

The application-owned identity contracts preserve possible HTTPS issuer paths (for example realms). The concrete Supabase/PocketBase adapters use their verified origin. Different paths are not reduced to the same origin. Auth profiles, new session grants, and started deletion grants are explicitly provider-bound; see [auth-provider.md](auth-provider.md).
