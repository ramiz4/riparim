# Documentation

Start with [local development](development/local-development.md), then use the guide for your task.

## Develop

| Task                                       | Guide                                                     |
| ------------------------------------------ | --------------------------------------------------------- |
| Find the code responsible for a feature    | [Codebase map](development/architecture.md)               |
| Start the app or diagnose setup            | [Local development](development/local-development.md)     |
| Recover an older local database            | [Local data recovery](development/local-data-recovery.md) |
| Create a task branch and contribute        | [Contributing](../CONTRIBUTING.md)                        |
| Run checks or diagnose test failures       | [Testing](development/testing.md)                         |
| Change CI or measure its performance       | [CI](development/ci.md)                                   |
| Add translated UI or routes                | [Internationalization](development/i18n.md)               |
| Check customer and admin flows             | [Customer QA](development/customer-flow-qa.md)            |
| Understand engineering language exceptions | [Codebase language](development/contributing-language.md) |
| Execute an issue with agents               | [Issue execution](development/issue-execution.md)         |

## Operate

| Task                                       | Guide                                                      |
| ------------------------------------------ | ---------------------------------------------------------- |
| Publish or deploy a verified release       | [Releases](operations/releases.md)                         |
| Install and operate the Node server        | [Node](operations/node.md)                                 |
| Configure login or map provider identities | [Auth providers](operations/auth-provider.md)              |
| Activate confirmation and recovery emails  | [Auth email templates](operations/auth-email-templates.md) |
| Configure review email delivery            | [Mail transports](operations/mail-transports.md)           |
| Back up or restore private data            | [Backups](operations/backups.md)                           |
| Check or operate backup alerts             | [Backup monitoring](operations/backup-monitoring.md)       |
| Transfer application data                  | [Data transfer](operations/data-transfer.md)               |
| Switch providers with a return path        | [Provider switching](operations/provider-switch.md)        |
| Move the production domain                 | [Domain cutover](operations/domain-cutover.md)             |

## Maintain the catalogue

| Task                                   | Guide                                  |
| -------------------------------------- | -------------------------------------- |
| Edit, validate or import workshop data | [Workshop data](data/workshops.md)     |
| Run the daily discovery process        | [Daily import](data/daily-import.md)   |
| Verify Google identity and Maps links  | [Google Places](data/google-places.md) |

## Historical evidence

[Archive](archive/README.md) contains dated findings and completion records. Read them as evidence from that date, then check current code and configuration before operating anything.

Guides explain the next action and its constraints. Scripts and configuration own exact versions, schemas and option lists; link them instead of copying their contents. Keep new guides focused on one task and remove superseded instructions. Put measurements and completed investigations in the archive, with their evidence and limits.

The short [SMTP fixture README](../tests/fixtures/smtp/README.md) stays beside its test data. The [third-party licence](../vendor/shadcn-tailwind-4.13.0.LICENSE.md) remains verbatim.
