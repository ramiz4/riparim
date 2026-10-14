# Codebase map

Customers find workshops and submit reviews with private visit evidence.
Admins approve publication; business owners propose profile changes for moderation.

## Find the feature

| What you are changing                     | Start here                                                             |
| ----------------------------------------- | ---------------------------------------------------------------------- |
| Pages or HTTP endpoints                   | [app/](../../app/)                                                     |
| Shared UI or browser state                | [components/](../../components/)                                       |
| Auth, sessions, roles or account deletion | [app/auth.ts](../../app/auth.ts), [lib/auth/](../../lib/auth/)         |
| Business rules, translations or email     | [lib/](../../lib/)                                                     |
| Database queries and schema               | [db/](../../db/), [drizzle/](../../drizzle/)                           |
| Curated catalogue and its sources         | [data/](../../data/)                                                   |
| Runtime/build adapters                    | [lib/runtime/](../../lib/runtime/), [build/](../../build/)             |
| Setup, imports and operator tools         | [scripts/](../../scripts/)                                             |
| Tests and automation                      | [tests/](../../tests/), [.github/workflows/](../../.github/workflows/) |
| Backup monitor                            | [monitor/](../../monitor/)                                             |

Pages and APIs use shared rules from `lib/` and queries from `db/`.
For a change, read the entry point, its model/callers and the relevant tests together.

## Keep the boundaries

Cloudflare is the default: D1 stores application records, private R2 stores evidence.
The Node alternative uses SQLite and private files through the same
[runtime contracts](../../lib/runtime/contracts.ts). Keep business rules independent of providers.

Public release pages contain no account data or evidence. Private requests and
writes require server authorization. Only approved workshops/reviews are public.

Source paths use English; [locale routing](i18n.md) preserves public URLs.
For Auth or catalogue changes, read [Auth providers](../operations/auth-provider.md)
or [workshop data](../data/workshops.md). Start work through
[Contributing](../../CONTRIBUTING.md) and finish with the relevant [checks](testing.md).
