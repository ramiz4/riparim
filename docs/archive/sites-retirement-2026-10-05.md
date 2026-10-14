# Sites retirement: October 5, 2026

[#20](https://github.com/ramiz4/riparim/issues/20) retired public access reversibly
at 09:58:38 Europe/Belgrade (UTC+02:00), after the user ended fallback.
The existing verified version became owner-only; only old domain mappings/export
access were removed. Owner, project, versions and D1/R2 remained recoverable;
the old source stayed write-locked. Shared Auth/Google/mail/CI services survived.
No final resource deletion was authorized.

A complete encrypted archive and separate recovery key were secured outside
managed worktrees and in the private project vault. Decryption, payload hashes,
13 migrations, SQLite integrity/foreign keys and independent vault-download hash
passed. A version-42 TAR was reconstructed from trusted release files rather than
provider-downloaded. Private receipts retain exact locations/fingerprints;
unknown acknowledgments stop dependent recovery steps.

The old anonymous URL/export returned HTTP401. Production retained v1.2.9;
fifteen actual Auth/private-file checks passed and synthetic accounts/data were
removed. No actual mail/review moderation occurred.
Archives, keys and old resources have **30-day minimum retention, until at least
November 4, 2026**. That date authorizes no deletion; separate authorization is required.
Reopening the source requires fresh reverse transfer and sole-writer acceptance.

[Full record and original evidence](https://github.com/ramiz4/riparim/blob/bb20bb86051f3e7f82b412f0f6604ff6e460efb4/docs/archive/sites-retirement-2026-10-05.md).
