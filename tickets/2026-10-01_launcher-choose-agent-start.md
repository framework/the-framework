Priority: 2
Topics: UX, launcher
Issue: [#1901](https://github.com/framework/the-framework/issues/1901)

# Launcher: choose where an agent starts

## TLDR

Nice to have: when starting an agent, choose where it starts: `main` (the default) or the branch the project's checkout is on, with its unpushed commits. The launcher shows the choice next to Start ("Starts from `main`"), as a small picker.

## Why it matters

Since #1900 every agent starts from origin's default branch, fetched first. That is safe (the agent never picks up unpushed work, and its push never publishes it), but it takes away building on work that is not pushed yet: on `my-feature` with 3 unpushed commits, "add tests for my new function" starts from `origin/main` and cannot see the function. Today the only way is to push the branch first, then start the agent on it from the command line (`branches create --base`). And nothing on screen says where an agent starts.

## Proposal

- The launcher shows where the agent starts, next to Start: "Starts from `main`" (the real default branch's name).
- That line is a picker with two choices: `main` (default) and "my current branch" (the branch the project's checkout is on, with its unpushed commits).
- The pick reaches the run the way the coding agent and model do: an environment variable for the project's start hook, then a base for the checkout (`createCheckout`'s `base`, which `branches create --base` already uses).
- Uncommitted edits are not carried over: the agent gets what is committed. A later step if it is missed.
- A follow-up on an existing run is not affected: it continues on its own branch.

## How other tools do it

- Claude Code: a setting, `worktree.baseRef`: `"fresh"` (default, the remote's default branch) or `"head"` (your current work).
- Codex app: a "starting branch" picker in the new-chat box; it starts from that local branch and carries its uncommitted changes over.
- Claude Code on the web: a branch selector per repository.

## Open questions

- Remember the last pick per project, or always start on `main`?
- Should the run page say the run started from a local branch, since its push may publish commits that were only local?
