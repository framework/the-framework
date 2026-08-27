A checkout as an agent gets it: the worktree on its branch, the parent checkout's dependency directories linked in, and the `branches/` links brought up to date — one sequence for a new agent (a fresh `tf-agent-<agent id>` branch, from a stated base or the project's head) and for a continued one (back on the branch its work is on). The daemon allocating a run and the command line both go through it, so the two never differ in what a checkout starts with. The linking and the links are best-effort: a checkout without its dependencies is a worse run, not a failed one, and a missing link is made by the next reconcile pass.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
