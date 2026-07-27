Status: open
Topics: [bug]
GitHub: [#1276](https://github.com/gemstack-land/the-framework/issues/1276)

# Agent escaped its run worktree: edits landed in the main checkout, its commit claims work it does not contain

## TLDR

Reproduced end-to-end failure (run `2026-07-27T01-15-47-451Z`): the child's cwd was its nested worktree `<repo>/.the-framework/worktrees/<runId>` as intended, but every Read/Edit the agent made used absolute paths into the user's MAIN checkout — while its relative `git add`/`git commit` ran in the worktree, staging nothing but daemon bookkeeping. The run still finished `done` with `readyForMerge: true` and a commit titled as if the work were done; the real diff sits uncommitted in the main checkout. Root cause: worktrees nested inside the repo make the live checkout a path prefix of the agent's cwd, and nothing tells the agent where its workspace ends (#1262 is the same nesting disease through pnpm symlinks).

## Why it matters

A session can report done/ready-for-merge while its branch and PR hold none (or part) of the work, and the user's checkout silently accumulates the rest — in a demo this reads as "the flow is broken": PRs that claim changes they do not contain, and mystery dirt on main. Fix directions from the issue: (1) move run worktrees outside the repo (a sibling directory) so the checkout is off the agent's path — the robust one, also removes part of #1262's vector; (2) a workspace-boundary instruction in the system prompt ("all reads and writes stay under the working directory"; #326 surface) — cheap, worth doing regardless; (3) a teardown tripwire that surfaces new uncommitted main-checkout changes on the session instead of reporting ready-for-merge — catches whatever still slips through.

## Source

Imported from GitHub issue [gemstack-land/the-framework#1276](https://github.com/gemstack-land/the-framework/issues/1276), created 2026-07-27, label: `bug`.

### Original description

Found while auditing the branch seam (the "different branch names for same session, business logic broken" lead). This is a reproduced, end-to-end failure, not a theory.

## Forensics: run `2026-07-27T01-15-47-451Z` (the tagline test run)

- The child's cwd was its worktree `.the-framework/worktrees/2026-07-27T01-15-47-451Z`, as intended. The system prompt the daemon composed contains no absolute paths. So far so good.
- But every Read/Edit the agent made used absolute paths into the MAIN checkout: it edited `~/Projects/gemstack/packages/the-framework/README.md` and `~/Projects/gemstack/.the-framework/LOGS.md` directly (verified in the session transcript's tool calls).
- Its `git add packages/the-framework/README.md .the-framework/LOGS.md` and `git commit` ran relative, in the worktree, where those files were untouched. The only thing staged was the framework's own "status: stopped" LOGS entry left by the daemon restart that had interrupted the run.
- Result: commit `83a6c79` on `the-framework/run-2026-07-27T01-15-47-451Z` is titled "docs: update The Framework README tagline to \"Ship faster. Decide smartly.\"" and contains zero agent work.
- The run finished `done` with `readyForMerge: true` and a recorded branch. The real diff sits uncommitted in the user's main checkout to this day.

## Why the agent found the main checkout

Run worktrees are nested inside the repo: `<repo>/.the-framework/worktrees/<runId>`. The user's live checkout is literally a prefix of the agent's cwd, so the moment the agent thinks about "this project" it walks up the path. Nothing tells it where its workspace ends. #1262 is the same nesting disease through pnpm symlinks.

## Impact

A session can report done / ready-for-merge while its branch and PR hold none (or part) of the work, and the user's checkout silently accumulates the rest. In a demo this reads as "the flow is broken": PRs that claim changes they do not contain, and mystery dirt on main.

## Fix directions

1. Move run worktrees outside the repo (e.g. a sibling directory), so the user's checkout is not on the agent's path at all. Also removes part of #1262's vector.
2. Add a workspace-boundary instruction to the system prompt ("all reads and writes stay under the working directory"). Prompt text is the #326 surface.
3. Teardown tripwire: if the main checkout gained new uncommitted changes during a run, surface that on the session instead of reporting ready-for-merge.

1 is the robust one; 2 is cheap and worth doing regardless; 3 catches whatever still slips through.
