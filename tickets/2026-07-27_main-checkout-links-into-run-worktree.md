Topics: [bug]
GitHub: [#1262](https://github.com/gemstack-land/the-framework/issues/1262)

# Main checkout's workspace links can end up pointing into an ephemeral run worktree

## TLDR

Observed live: the MAIN checkout's `packages/the-framework/node_modules/@gemstack/ai-autopilot` was a symlink into a run worktree; when the merged-worktree sweep removed that worktree the link dangled and every subsequently started session died at boot with `ERR_MODULE_NOT_FOUND` (silently — see #1261). **Root-caused in-thread, with a minimal repro**: any `pnpm install` run inside a run worktree. The worktree is a full checkout with its own `pnpm-workspace.yaml`, its per-package `node_modules` are #736 dependency symlinks into the main checkout, and pnpm realpaths through them — so the workspace links it rewrites physically land in the main checkout's real `node_modules`, with relative targets pointing back into the ephemeral worktree. Options: heal at teardown (scan the project root's dependency links for targets inside the removed worktree and re-point them — mechanical, covers every install reason; recommended as the small safe one) vs prevent (no pnpm knob exists; replacing per-package links with real dirs costs the disk #736 exists to avoid). Recovery when hit: `pnpm install` at the repo root.

## Why it matters

An ephemeral run corrupting the *main* checkout is the worst failure class — it silently bricks every subsequent session on the machine. And it will keep happening: lockfile-changing runs are expected to install in their worktree (`worktree-deps.ts` says so itself), so this re-hits until healed. Teardown healing is scoped, small, and already offered ("say the word and I will build it").

## Source

Imported from GitHub issue [gemstack-land/the-framework#1262](https://github.com/gemstack-land/the-framework/issues/1262), created 2026-07-27, label: `bug`, 1 comment.

### Original description

Observed state, writer not yet identified: packages/the-framework/node_modules/@gemstack/ai-autopilot in the MAIN checkout was a symlink into .the-framework/worktrees/<run-id>/packages/ai-autopilot. When the merged-worktree sweep removed that worktree, the link dangled and every subsequently started session died at boot with ERR_MODULE_NOT_FOUND (silently, see the companion issue).

The dead run worktrees also had their own root node_modules, so a pnpm install ran inside at least one of them during a session. pnpm-workspace.yaml globs are narrow (packages/*, examples/*), so how main's links got rewired is unclear; possibly pnpm's verify-deps auto-install interacting with the nested worktree layout.

Fix for anyone who hits it: pnpm install at the repo root restores the links. Worth deciding: should run worktrees skip installs, or should .the-framework/worktrees be excluded from anything pnpm can see?

### Notes from the GitHub thread

- Writer identified with a scratch-workspace repro (`liba` depends on `libb`): `pnpm install` inside a worktree with the #736 links rewires the MAIN checkout's links — byte for byte the corruption observed live. Mechanism: pnpm treats the worktree as a workspace root, resolves through the symlinked `node_modules` (it realpaths directories), so its writes land in the main checkout's real `node_modules` while the relative targets it computes point into the worktree.
- Options assessed: teardown healing (when a worktree is removed, re-point dangling dependency links at the root's own sibling paths) — mechanical, no change to what runs can do, recommended; prevention has no pnpm knob and real dirs cost the disk #736 avoids. Companion fix: PR #1272 (for #1261) makes the resulting boot death visible and names the module.
