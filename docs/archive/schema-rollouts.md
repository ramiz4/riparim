# Historical schema rollout notes

Compatibility notes retained from release operations; migration files and GitHub
release history are authoritative. Applied SQL stays unchanged.
For a new release, follow [migration safety](../operations/releases.md#production-migrations-retries-and-rollback).

| Migration                     | Behavior and return-path limit                                                                                                                                                                                                                                                |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `0015_noisy_rockslide.sql`    | Adds claim `documents` JSON default `[]`; no backfill. New writes mirror the first file into legacy columns. Old code remains compatible but sees one file.                                                                                                                   |
| `0016_account_identities.sql` | Adds exact external identity mappings without changing internal ownership/file keys; old writers can register later. Deterministic historical `created_at`: `2026-10-11T00:00:00.000Z`. After provider cutover, only identity-aware code is safe.                             |
| `0017_mail_transports.sql`    | Adds nullable transport/MIME and SMTP start marker. Started NULL-transport events remain Resend; preserve frozen bytes/acceptances.                                                                                                                                           |
| `0018_auth_providers.sql`     | Adds default Supabase provider and deletion-grant binding; existing profile/cookies remain compatible. Provider switching needs independent account/secret migration.                                                                                                         |
| `0020_married_magus.sql`      | Adds two nullable workshop opening-hour fields; no backfill. Legacy drafts/imports preserve approved hours; public profiles stop loading Google widgets.                                                                                                                      |
| `0025_dark_pretty_boy.sql`    | Adds nullable visit `services` JSON, backfills scalar `service` as one item. Back up/recovery-test before backfill. New writes mirror first category; old code sees/edits that scalar. If scalar differs from first JSON value, it wins on reread; no stale extra categories. |

Historical claim acceptance: old claims without a file remain reviewable.
New claims require 1–5 PDF/JPG/PNG files, ≤5 MiB each/10 MiB total; the multipart
body cap is 11 MiB. Account deletion/export preserves all private document references.
The old Worker can operate with additive columns, but rollback does not remove them.

Localized Auth-template activation from issue #52 changed no schema/secrets.
Provider fields require separate private backup, exact origin comparison and real
DE/SQ/EN receipt acceptance. Code deployment/rollback does not modify those fields.
Started review messages retain original language/request bytes on every retry.

Oracle Always Free was evaluated October 11–12, 2026 and rejected for hosting.
No Node host/domain/Auth production cutover was performed by that evaluation.
