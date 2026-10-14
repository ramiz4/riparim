# Contributing

Start with [local development](docs/development/local-development.md).
Agents also follow [AGENTS.md](AGENTS.md). Write engineering content in English;
the [language guide](docs/development/contributing-language.md) defines UI,
external-contract and immutable-source exceptions.

## Git startup

The primary checkout is exclusively for synchronization on clean `main`.
Each new agent task gets an exclusive worktree outside it and a new
`codex/<short-task>` branch. Continue the same task in its existing worktree.

1. Run `git worktree list --porcelain` to identify the primary checkout and
   existing task worktrees. Coordinate other agents before synchronization;
   shared refs and remotes must not be changed concurrently.
2. In the primary checkout, check branch, index, tracked and untracked files
   (`git status --porcelain --untracked-files=all`) and ongoing Git operations.
   Require a clean tree with no merge, rebase or cherry-pick in progress.
3. Run `git fetch origin --prune --tags` successfully. If clean, unused and on
   another branch, run `git switch main`. A missing `main` may be created from
   `origin/main` only when no other worktree has `main` checked out.
4. Run `git merge --ff-only origin/main` and
   `git branch --set-upstream-to=origin/main main`. Verify branch `main` and
   identical `git rev-parse HEAD`, `git rev-parse main` and
   `git rev-parse origin/main`; recheck cleanliness. A successful fast-forward
   command alone does not detect extra local commits.
5. Choose an unused absolute path and unused branch; create from this verified
   `main` with `git worktree add -b codex/<task> /absolute/task/path main`.
   In the new worktree verify the branch and that HEAD equals the verified base.
6. Perform all edits, installations, builds, databases and checks in that worktree.
   Environment-provisioned worktrees must satisfy the same conditions. Before
   continuing a task, recheck its state; later main updates are freshly fetched
   and integrated in the task branch while preserving shared history.

**Stop startup** for dirty/untracked state, extra local commits, divergent `main`,
failed fetch or an ongoing Git operation. Report the actual state and needed
clarification; preserve work without automatic stash, reset, clean, forced checkout
or committing another person's changes. Implementation requires a current base.

## Commits and PRs

Use [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/):
short English descriptions and lowercase types. Each commit covers one coherent
change; independent changes belong in separate PRs.

```text
<type>(<optional scope>): <description>
fix(auth): validate callback redirects
docs: simplify developer guides
```

Types: `feat`, `fix`, `perf`, `refactor`, `docs`, `test`, `build`, `ci`, `chore`,
`style`, `revert`. Incompatible changes use `!` plus a `BREAKING CHANGE:` footer
describing impact and migration. The final squash message retains every such note.
Describe resulting behavior, actual checks and migration requirements in the PR.
Integrate only through a verified squash merge into `main`.

## Checks and formatting

Install separately in each worktree with `npm run install:ci`. Husky automatically
formats staged supported files using the pinned local Prettier and lint-staged;
unstaged changes stay intact and formatter failure prevents the commit. The hook
stays fast: tests, types and builds run separately.

```sh
npm run format
npm run format:check
```

Both share `.prettierrc.json` and `.prettierignore`; exclusions protect generated
files, vendor sources and applied migrations. Optional editor formatting uses the
local version/config. Hooks can be bypassed, so CI also requires `format:check`.
See [testing](docs/development/testing.md) for local CI commands and
[local development](docs/development/local-development.md) for hook setup exceptions.

## Releases

Semantic Release manages versions, tags and generated notes in CI after successful
`main` verification; never run local live releases or edit versions manually.
The checked-in config/workflow is authoritative. The analyzer and notes generator
use `conventionalcommits` consistently: `fix`/`perf` → patch, `feat` → minor,
breaking change → major; other types publish only with a breaking change unless
the release config explicitly justifies a deviation.

The project stays private: npm publication is outside this process. CI secrets
remain protected, release jobs use minimum permissions and run serially.
`Release: Publish and deploy` publishes verified Cloudflare, Sites and Node assets
from merged `main`; PRs/task branches never publish. Cloudflare is the default;
Node installs the published release without a target build. Follow
[releases](docs/operations/releases.md) for deployment, migrations and data/domain cutover.
