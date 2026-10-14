# Codebase map

Riparim lists approved workshops in Kosovo. Customers submit reviews with private visit evidence; admins approve publication. Business owners propose profile changes for moderation.

## Where to work

| Area                                     | Entry points                                                                                         |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Pages and API requests                   | [`app/`](../../app/)                                                                                 |
| Reusable UI and client state             | [`components/`](../../components/)                                                                   |
| Auth, sessions, roles and deletion       | [`app/auth.ts`](../../app/auth.ts), [`lib/auth/`](../../lib/auth/)                                   |
| Catalogue records and imports            | [`db/directory.ts`](../../db/directory.ts), [`db/catalogue-import.ts`](../../db/catalogue-import.ts) |
| Database schema and storage boundary     | [`db/schema.ts`](../../db/schema.ts), [`db/storage.ts`](../../db/storage.ts)                         |
| Immutable SQL migrations                 | [`drizzle/`](../../drizzle/)                                                                         |
| Locale routes and typed translations     | [`lib/i18n/`](../../lib/i18n/)                                                                       |
| Durable review email delivery            | [`lib/notifications/`](../../lib/notifications/)                                                     |
| Runtime adapters                         | [`lib/runtime/`](../../lib/runtime/)                                                                 |
| Worker entry and framework integration   | [`build/`](../../build/)                                                                             |
| Catalogue sources and provenance         | [`data/`](../../data/)                                                                               |
| Local setup, releases and operator tools | [`scripts/`](../../scripts/)                                                                         |
| Isolated contract and integration tests  | [`tests/`](../../tests/)                                                                             |
| CI, release and backup workflows         | [`.github/workflows/`](../../.github/workflows/)                                                     |
| Portable backup monitor                  | [`monitor/worker.ts`](../../monitor/worker.ts)                                                       |

## Request and data boundaries

Pages use shared business rules from `lib/` and database modules from `db/`. API routes validate input and check server permissions before writes. Internal source paths use English; [locale routing](i18n.md) preserves public URLs.

Cloudflare is the default runtime: D1 stores application records and private R2 stores evidence. Node runs the same application through SQLite and private local files. [`lib/runtime/contracts.ts`](../../lib/runtime/contracts.ts) defines the storage boundary; avoid coupling business rules to a provider implementation.

[`build/cloudflare-worker.ts`](../../build/cloudflare-worker.ts) serves eligible public release assets and selected read endpoints before loading the framework. Private pages and writes still require verified authorization. [`scripts/render-public-release.mjs`](../../scripts/render-public-release.mjs) creates public documents at build time; account data and evidence stay out of release artifacts.

Auth uses an application-owned [provider contract](../../lib/auth/contract.ts), with Supabase and PocketBase adapters. Stable internal account identities preserve ownership across provider changes. Read [Auth providers](../operations/auth-provider.md) before changing sessions, mapping or account deletion.

Reviews, ownership claims and uploads have separate privacy and moderation rules. Read the affected API, its model and its tests together. [Customer QA](customer-flow-qa.md) covers the observable flows; [workshop data](../data/workshops.md) explains the catalogue's source and import boundaries.

## Start a change

1. Follow [Contributing](../../CONTRIBUTING.md) to create isolated task work.
2. Find the page/API and read its `lib/`, `db/` and test callers.
3. Change the smallest module that owns the behavior.
4. Run the relevant [checks](testing.md), inspect the diff and integrate through a verified PR.
