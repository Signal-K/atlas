# AGENTS

## Cycle branch policy

This policy is mandatory for every agent and every implementation task in this repository.

- Work in one dated branch per cycle, named `cycle/YYYY-MM-DD`. Create or switch to the current cycle branch before making any code, test, documentation, or configuration edit.
- Never commit ordinary work directly to `master`. `master` is the last Friday-approved state; the only permitted direct update is the reviewed Friday-evening cycle merge.
- At the start of each task, run `git branch --show-current`. If it is not the current `cycle/` branch, stop and create/switch to that branch before editing.
- Keep all Linear ticket work, validation commits, and cycle evidence on the current cycle branch. Do not create ticket-per-feature branches unless the user explicitly asks for an exception.
- On Friday evening, merge the verified cycle branch into `master` as one reviewed cycle closeout. Before merging, reconcile Linear status, clean worktree, checks, CI/deployment, and runtime evidence.
- On Saturday, conduct the cycle review: examine delivery evidence, user friction and feedback, PostHog/replay signals, unresolved reliability issues, and prioritised work for the next cycle.

## Navigation commit policy

This repository follows the mandatory commit policy for every repository under `~/Navigation`.

- Linear is the task system of record. Resolve or create the active Linear issue before editing, keep it current, and add implementation evidence before finishing.
- Commit only after a coherent ticket outcome or acceptance slice is implemented and verified. Do not create checkpoint, progress, one-file, or speculative commits. One achieved outcome is one commit by default.
- A coding request authorizes the final task commit unless the user explicitly says not to commit. Do not pause solely for routine commit confirmation once the outcome is complete.
- Before committing, inspect `git status --short`, run appropriate checks, stage the complete task from this repository root with `git add .`, then review `git diff --cached` and `git status --short`. Do not hand-pick only a small subset of task files.
- Preserve unrelated user-owned work. Exclude only clearly unrelated changes, secrets, generated caches/build output, or files explicitly excluded by the user, and disclose exclusions in the handoff and Linear comment.
- Every commit subject must use exactly `🚀🐺 ↝ [KES-299 ATL-999]: Commit message`.
  - Choose two different emoji for each commit. Do not use flags or smiley/human-face reaction emoji; object, symbol, nature, and animal emoji such as `🐺` are allowed.
  - Use the exact `↝` arrow and spacing.
  - Put all ticket keys worked on in one bracket pair, separated by single spaces. Include the active Linear key; related external keys may follow.
  - Describe the achieved outcome concisely after `: `.
- Never bypass the commit-message hook with `--no-verify`.
