# Final data reconciliation for domain cutover

The tools prepare final reconciliation for #19. They enable no maintenance lock
and change no domain, runtime configuration or publication. The public source
Site stays available during preparation. The short pause is announced only
after successful verification and before activation, as described in
[domain-cutover.md](domain-cutover.md).

## Proven baseline

Completion of #18 includes the protected source backup, target backup before
import and private transfer report. `loadTransferredBaseline()` checks their
identities, completion receipts and checksums. It reconstructs confirmed inserts
only in memory. Insert counts, retained cache metadata and the complete target
fingerprint must exactly match the transfer report. This does not declare a
current coincidentally similar target to be the baseline.

`planDataDelta()` compares this baseline with the fresh paused source and fresh
target. Unchanged source rows preserve original target values, including already
validated cache metadata. New, changed or deleted source rows produce only the
corresponding inserts, modifications or deletions. Other target changes stop
the plan. Already transferred exact changes are skipped on renewed reconciliation.
Session revocations, account blocks, removed roles and deleted submissions are
therefore not restored from an older backup. A Supabase project change is
outside this domain reconciliation and produces No-Go.

The cache metadata decision uses the existing shared identity function.
A changed phone number, address or map source does not leave an old target hash
as current confirmation. Quotas, roles and business data do not fall under this
exception. All original backups remain unchanged.

## Separate proof of expired Auth counters

By default, every target deviation in `auth_attempts` is also rejected.
The optional expiry projection requires a protected QA receipt and complete
protected target backup as a timestamped witness. Its `exportedAt` is the fixed
cutoff; it must be no later than trusted execution time or the fresh
source/target backups.

The check first confirms the unchanged #18 fingerprint. It then hides only
counters whose SHA/ten-minute window, positive attempt count and twenty-minute
expiry match the actual limiter implementation and which had already expired
**before this cutoff**. After projection, the entire proven baseline must match
the witness. Active or malformed counters and changes in other tables remain
conflicts. A specific IP mapping is not claimed proven through time correlation.

This projection neither cleans up nor restores expired counters.
Already expired target rows remain physically unchanged; expired source rows
are not copied again. Active source counters are reconciled normally.
The final **raw** target fingerprint also includes these preserved target rows,
so a successful no-op does not claim an otherwise unverified projected state.

## Protected execution

`scripts/apply-delta-d1.mjs` accepts options and short-lived credentials only
through protected JSON on stdin. Tokens belong neither in arguments,
configuration files, Git nor reports. The responsible execution process obtains
them from the protected service and builds input in memory. Without
`execute: true`, only a plan with counts and fingerprints is emitted.
The `applyDeltaPlan()` module interface permits injected provider access for
isolated tests.

| Option                                             | Evidence                                                                                |
| -------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `baselineSourceDirectory`                          | Complete finished source backup from #18                                                |
| `preTransferTargetDirectory`                       | Private target backup before confirmed #18 inserts                                      |
| `transferReportFile`                               | Private confirmed transfer report with complete result fingerprint                      |
| `sourceDirectory`, `expectedSourceCommit`          | Fresh complete source backup and independently verified source release                  |
| `destinationDirectory`, `expectedCommit`           | Fresh protected target backup and actual target release                                 |
| `expiryProjection`                                 | Optional: `witnessDirectory`, `expectedWitnessCommit`, `receiptFile`                    |
| `sourceOrigin`, `sourceToken`, `sourceProbeParent` | Protected authenticated source access for complete renewed pause/inventory verification |
| `token`                                            | Separate protected Cloudflare access to the fixed embedded target account and target D1 |
| `execute`                                          | Only boolean `true` activates data mutations                                            |

Before each section, the unchanged authenticated source pause and explicit target
maintenance marker with immutable release commit are checked. The target
inventory is fully reread. SQL and bindings come only from the new three-way
reconciliation; there is no input of arbitrary SQL text.
Changes and deletions compare all old columns, including null values.
Each statement may modify exactly one expected row; each section has at most
50 statements and each statement at most 95 bindings.

A lost acknowledgment is never retried automatically. Source and target remain
paused, a new protected target backup is created and three-way reconciliation
is recalculated. It detects fully or partially transferred changes.
At the end, both the complete raw target state and a new empty change plan
must match. Source identity and original source fingerprints are checked again.

## Private files and Go/No-Go

A private source inventory changed since #18 currently produces an explicit
No-Go before any D1 mutation: first a separate complete R2 delta for content,
metadata, references and deletions must be reviewed. Database reconciliation
alone transfers no file. Current target inventory, its privacy and references
must also be separately confirmed before invocation according to
[data-transfer.md](data-transfer.md). The tools claim no already executed file
transfer or domain cutover.

Only conflict-free completion is followed by routing, exclusive activation of
the target writer, business domain/Auth acceptance and the agreed observation
period. Backups, source Site and private reports remain until safe handover.
