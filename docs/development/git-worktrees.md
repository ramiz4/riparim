# Git startup for agent tasks

Complete this before every new task.

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
