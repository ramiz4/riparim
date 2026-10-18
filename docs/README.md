# Documentation

For your first change: [start the app](development/local-development.md),
[find the feature](development/architecture.md), then [run checks](development/testing.md).
Follow [Contributing](../CONTRIBUTING.md) for task isolation and PRs.

## Development

- [Local recovery](development/local-data-recovery.md): locked setup or an older database.
- [Internationalization](development/i18n.md) and [language boundaries](development/contributing-language.md).
- [Customer-flow QA](development/customer-flow-qa.md): check UI, Auth and permissions.
- [CI](development/ci.md): complete verification and workflow changes.
  [Benchmarking](development/ci-benchmark.md) is a separate advanced task.

## Operations

- [Releases](operations/releases.md) and [Node hosting](operations/node.md).
- [Auth providers](operations/auth-provider.md) and [Auth email templates](operations/auth-email-templates.md).
- [Review email delivery](operations/mail-transports.md).
- [Profile sharing](operations/profile-sharing.md): public links, printable cards and manual pilot handoff.
- [Backups](operations/backups.md) and [backup monitoring](operations/backup-monitoring.md).
- [Data transfer](operations/data-transfer.md), [provider switching](operations/provider-switch.md)
  and [domain cutover](operations/domain-cutover.md).

## Catalogue

- [Workshop data](data/workshops.md): edit, validate and import.
- [Daily discovery](data/daily-import.md): verified research and publication.
- [Google identity](data/google-places.md): Place IDs and Maps links.

## Agents and past work

Agents follow [AGENTS](../AGENTS.md), [Git startup](development/git-worktrees.md)
and, when invoked, [issue execution](development/issue-execution.md).
[The archive](archive/README.md) holds dated evidence; use active guides for current operations.

Keep each guide focused on a task. Link code/configuration for implementation detail;
put completed investigations in the archive. The short [SMTP fixture note](../tests/fixtures/smtp/README.md)
stays beside its data; [third-party licence text](../vendor/shadcn-tailwind-4.13.0.LICENSE.md) stays verbatim.
