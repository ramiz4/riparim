# Repository workflow

- Work on an isolated `codex/` branch and open a pull request against `main`.
- Use Conventional Commits for new commits and PR titles: `fix:` for patches, `feat:` for features, and `feat!:` or `fix!:` for breaking changes. Use `docs:`, `test:`, `refactor:`, `build:`, `ci:`, or `chore:` when appropriate; these do not normally create a release.
- Merge PRs by squash. The PR title becomes the squash commit subject; keep its description suitable for the commit body.
- Never publish feature branches or unmerged PR changes to production, including through Sites tools. A production deployment must correspond to a GitHub release from merged `main` and successful verification. This repository policy overrides the Sites plugin's default immediate-publish workflow.
- For release or deployment work, read [docs/releases.md](docs/releases.md). Do not invent a Sites API or persist temporary Sites credentials as CI secrets.
- Before opening a PR, run `npm run catalog:check`, `npm test`, `npx tsc --noEmit`, `npm run lint`, and `npm run build`. Report a failing check rather than bypassing it.
