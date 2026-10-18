# Complete catalogue WhatsApp verification: October 18, 2026

Every canonical workshop telephone number was checked in the authenticated
WhatsApp Web interface: **193 distinct numbers across 194 workshops**. The
[dated verification manifest](../../data/whatsapp-verification-2026-10-18.json)
records the exact number, associated workshop IDs, outcome and UTC observation
time for every check.

| Lookup result  | Distinct numbers | Workshops |
| -------------- | ---------------: | --------: |
| Registered     |              171 |       171 |
| Not registered |               22 |        23 |
| Unresolved     |                0 |         0 |
| Total          |              193 |       194 |

Eurogoma Gjakovë-2 and Mitrovicë share one number, which returned a negative
result; this accounts for the different number and workshop totals. All eight
previously stored WhatsApp contacts returned positive results. They were a
partial catalogue record, not the complete set of registered numbers. The full
check supersedes the earlier two-workshop sample.

## Method and limits

The operator visibly confirmed the required project browser profile, then used
WhatsApp Web > New chat > Phone number. For each distinct number, the input was
cleared and the exact public catalogue number was entered. An account result
established registration; a completed lookup showing no results established the
recorded negative outcome. Delayed responses were revisited before a final
classification. AS Motors was also checked through a direct chat link, which
explicitly reported that its number was not on WhatsApp. No outcome was inferred
from a number prefix, an empty catalogue field or a generated link.

WhatsApp's [official click-to-chat documentation](https://faq.whatsapp.com/5913398998672934)
requires an active WhatsApp account in addition to knowing the telephone number.
Its [registration documentation](https://faq.whatsapp.com/684051319521343/?cms_platform=iphone&locale=en_US)
requires registration and number verification; WhatsApp Business also supports
landlines. A telephone listing alone therefore cannot establish availability.

These observations establish account registration at the recorded time. They do
not establish ownership, acceptance of workshop inquiries, message delivery,
response time or future availability. **No messages, calls, invitations or contact
writes were performed.** Account profile names, chat content and private account
information were not retained in the manifest.

## Authorized catalogue preparation

The user explicitly requested the existing WhatsApp button for every successfully
checked catalogue number. Accordingly, [workshops.json](../../data/workshops.json)
now contains **171 WhatsApp contacts: eight retained and 163 newly enabled**. The
23 workshops with negative results retain an empty WhatsApp field.

For the 163 changed records, only `whatsapp` and `updatedAt` changed. Original
source evidence, verification dates, Google identity and snapshots, approval
status and all other profile fields were preserved. The existing
[contact link helper](../../lib/workshops.ts) and
[profile action](../../app/[locale]/workshop/[id]/profile.tsx) already use the
separate WhatsApp field, so no UI or schema change was required.
[Translation hashes](../../lib/workshop-translations.ts) exclude WhatsApp and
revision timestamps; translations remained unchanged.

A fresh read-only baseline comparison matched all 194 canonical profiles against
live database and public API fields. It found no owners, pending changes or draft
profiles and preserved 35 retirement markers. A protected eight-table backup
restored all 920 rows and 14 schema entries exactly in isolated SQLite. The final
simulation used the authoritative [catalogue import factory](../../db/catalogue-import.ts):
437 statements changed the intended 163 profiles, preserving every other baseline
field and allowing the expected catalogue completion marker.

This record documents browser verification, catalogue preparation and isolated
simulation. Required PR checks, reviewed squash merge, verified release and live
acceptance follow the [release procedure](../operations/releases.md); production
deployment is not established by this report.
