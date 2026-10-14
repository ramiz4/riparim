# Contributing

**Before every new agent task**, complete [Git startup](docs/development/git-worktrees.md).
Work in that isolated checkout and follow [AGENTS.md](AGENTS.md).

## Make a change

1. [Start the app](docs/development/local-development.md) in the task checkout.
2. Find the feature in the [codebase map](docs/development/architecture.md).
   Read its callers, model and tests before editing.
3. Keep the change focused. Write engineering content in English;
   [language boundaries](docs/development/contributing-language.md) preserve UI,
   public contracts and original source evidence.
4. Run the relevant [checks](docs/development/testing.md) and inspect the full diff.
   Run `git diff --check`; report actual results and any limitations.
5. Open a PR to `main` with its purpose, verification and migration requirements.
   Integrate only after required checks pass, using a squash merge.

## Commits

Use [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/)
for task commits, PR titles and the final squash message:

```text
<type>(<optional scope>): <short English description>
fix(auth): validate callback redirects
```

Use lowercase types: `feat`, `fix`, `perf`, `refactor`, `docs`, `test`, `build`,
`ci`, `chore`, `style`, `revert`. Keep one coherent change per commit;
independent changes belong in separate PRs. Incompatible changes need `!` and a
`BREAKING CHANGE:` footer explaining impact and migration; preserve it when squashing.

Semantic Release manages versions, tags and notes in CI on verified `main`:
`fix`/`perf` → patch, `feat` → minor, breaking change → major. Other types normally
publish no release. Its analyzer and notes generator use `conventionalcommits`;
the [release configuration](release.config.mjs) owns any justified exceptions.
Never run local live releases or edit versions/tags manually. Follow
[release operations](docs/operations/releases.md) for deployment.

## Formatting

`npm run install:ci` enables the local commit hook. It formats staged files with
the pinned Prettier, preserves unstaged changes and blocks formatter errors.
CI also checks formatting; tests and builds stay outside the fast hook.

```sh
npm run format
npm run format:check
```

Use the local version for optional editor formatting. See
[local setup](docs/development/local-development.md) for hook errors/exceptions.
