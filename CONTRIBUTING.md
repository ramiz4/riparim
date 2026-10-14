# Contributing to Riparim

## Git: primary checkout and task worktrees

The primary Git worktree stays on `main` and contains no task changes.
Every new agent task gets a separate worktree and a new
`codex/<task>` branch. Continuations use the existing task isolation.

Before creating it, the agent must establish the following conditions:

1. Identify the primary checkout with `git worktree list --porcelain`;
   do not assume the current path is the primary checkout. Coordinate any ongoing
   work by other agents first; do not synchronize concurrently.
2. Check `git status` there. The working tree and index must be clean, including
   untracked files; no merge, rebase, or cherry-pick may be in progress.
3. Successfully run `git fetch origin --prune --tags`. If the primary checkout is clean,
   currently unused, and on another branch, return with `git switch main`.
   If `main` is missing, it may be created from `origin/main` provided that
   `main` is not checked out in any other worktree.
4. Update `main` with `git merge --ff-only origin/main` and set its upstream
   to `origin/main`. Afterwards, `HEAD` must match `origin/main` exactly.
   Additional local commits and divergence are stop conditions, even when a merge
   with `--ff-only` returns successfully for a branch that is ahead.
5. Choose an unused worktree path outside the primary checkout and a
   new branch. Create both from this verified `main`. Check the branch and
   base commit in the new worktree before starting the actual work.

If a condition fails, stop the startup procedure and report the specific state.
Preserve others' work; automatic stashing, reset, clean, or a
forced checkout does not resolve this conflict. A task worktree already
provisioned by the environment must satisfy the same conditions.

After checking the state, the following template may be used. Replace the three
variables with the identified absolute paths and a unique branch name.
The template assumes an existing `main` and a primary checkout with no ongoing
Git operation; any error stops it before subsequent steps.

```sh
(
  set -eu
  primary_checkout='/absolute/path/to/primary-checkout'
  task_worktree='/absolute/path/to/new/task-worktree'
  task_branch='codex/short-task'

  test -z "$(git -C "$primary_checkout" status --porcelain --untracked-files=all)"
  git -C "$primary_checkout" fetch origin --prune --tags
  git -C "$primary_checkout" switch main
  git -C "$primary_checkout" merge --ff-only origin/main
  git -C "$primary_checkout" branch --set-upstream-to=origin/main main
  test "$(git -C "$primary_checkout" branch --show-current)" = main
  task_base=$(git -C "$primary_checkout" rev-parse main)
  test "$task_base" = "$(git -C "$primary_checkout" rev-parse origin/main)"
  test "$task_base" = "$(git -C "$primary_checkout" rev-parse HEAD)"
  test -z "$(git -C "$primary_checkout" status --porcelain --untracked-files=all)"
  test ! -e "$task_worktree"
  git -C "$primary_checkout" worktree add -b "$task_branch" "$task_worktree" main
  test "$(git -C "$task_worktree" branch --show-current)" = "$task_branch"
  test "$(git -C "$task_worktree" rev-parse HEAD)" = "$task_base"
)
```

Then work in the task worktree. Installations, build output,
local databases, and test state remain isolated there; shared
Git refs and remotes still require coordination. For later updates
of the task branch, fetch `origin/main` again and integrate it only in the
task worktree. Preserve shared branch history.

## Codebase language

Write repository-owned code, filenames, comments, documentation, technical messages,
and test descriptions in English. Keep the multilingual UI and its translation
resources in their supported languages. Preserve compatibility URLs, wire and storage
contracts, original source evidence, vendor/generated content, and applied migrations
where translating them would change their meaning or behavior. The authoritative
scope, exceptions, and verification rules are in
[docs/codebase-language.md](docs/codebase-language.md).

## Conventional Commits

All new task commits and PR titles follow
[Conventional Commits 1.0.0](https://www.conventionalcommits.org/en/v1.0.0/).
Use short English descriptions and lowercase types:

```text
<type>(<optional scope>): <description>
```

Types: `feat`, `fix`, `perf`, `refactor`, `docs`, `test`, `build`, `ci`, `chore`,
`style`, `revert`. Each commit covers one coherent change.

```text
feat(catalogue): add service filters
fix(auth): validate callback redirect targets
docs(agents): define isolated task workflow
```

Mark incompatible changes with `!` and add a
`BREAKING CHANGE:` footer describing their impact and migration path, for example:

```text
feat(api)!: require verified workshop ownership

BREAKING CHANGE: Workshop updates require verified ownership. Existing owners
must complete verification before submitting further updates.
```

For squash merges, the commit message actually integrated into `main`
must follow this convention and include every breaking-change note.
Prefer separate PRs for multiple independent changes.

## Semantic Release

Semantic Release is the required target process for versions, release notes,
and release tags. The checked-in release configuration and CI workflow
are the technical source of truth. This policy alone does not enable
release automation.

- Releases run exclusively in CI on `main` after successful
  quality checks; PRs and task branches do not publish releases.
- Both the commit analyzer and release notes generator must use the
  `conventionalcommits` preset and recognize breaking changes consistently.
- `fix` produces a patch, `feat` a minor, and breaking changes a major release;
  `perf` should trigger a patch. Other types do not trigger publication without
  a breaking change. Deviations must be justified in the release configuration.
- The release process manages versions, release tags, and generated release notes.
  Tasks do not change them manually or run local live releases.
- The application remains a private project; publishing an npm package
  is outside the release process. CI credentials stay in protected secrets;
  release jobs receive only the permissions they need and run serially.
- The `Release: Publish and deploy` workflow publishes verified GitHub Release artifacts for Cloudflare, Sites, and Node.
  Cloudflare remains the deployment default; the Node path installs the
  published main release without building on the target. Deployment, production migrations, and
  the separate data/domain cutover follow
  [docs/releases.md](docs/releases.md). Open PRs are not published.

References: [Semantic Release](https://semantic-release.org/intro/) and
[configuration](https://semantic-release.org/usage/configuration/).

## Quality and handover

Install in the relevant task worktree with `npm run install:ci`. The
`prepare` process configures Husky automatically. Before a commit,
lint-staged formats only staged, supported files with the pinned Prettier version;
unstaged changes are preserved. A formatter error prevents the
commit. Use `npm run format` for full local formatting
and `npm run format:check` for a read-only check of the same scope.

Optional editor formatting on save must use the local
Prettier version and project configuration. The central exclusions in
`.prettierignore` protect generated files, vendor sources, and applied
migrations. Hooks can be bypassed locally; `format:check` is therefore a
required CI check. Tests, type checking, and builds stay outside the fast
commit hook. Installation exceptions and worktree configuration are documented in
[README](README.md#format-code).

AI agents must follow the design principles, privacy rules, and
completion conditions in [AGENTS.md](AGENTS.md). Installation and local checks
are documented in [README.md](README.md); required code checks are defined by
[the CI workflow](.github/workflows/ci.yml). Describe the resulting
behavior, checks performed, and necessary migrations in the PR.
