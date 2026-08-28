A checkout as an agent gets it: the worktree on its branch, `.branches/` hidden from the project's git, the parent checkout's dependency directories linked in, the skill linked in where the agent's harness looks for it, and the `.branches/` links brought up to date — one sequence for a new agent (a fresh `agent-<agent id>` branch, from a stated base or the project's head) and for a continued one (back on the branch its work is on). A daemon allocating a run and the command line both go through it, so the two never differ in what a checkout starts with. All of it is best-effort: a checkout without its dependencies is a worse run, not a failed one, and a missing link is made by the next reconcile pass.

The checkouts are the package's state, not the project's: as an untracked directory at the root, `.branches/` would ride any sweeping `git add -A` onto a code branch, so it is hidden through the repository's own exclude file the moment the first checkout exists — no tracked file changes, and no user ever sees a diff.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
