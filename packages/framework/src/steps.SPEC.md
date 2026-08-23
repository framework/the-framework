The prompts a build agent opens with, and the one check that decides between them: whether the workspace already holds an app.

## Business logic — TL;DR

- **Greenfield build prompt** - frames a from-scratch build of the user's intent: the workspace may be empty, so scaffold the whole project (package manifest and scripts, config, every source file), install dependencies, make the app run, and summarize in one short paragraph.
- **Existing-codebase prompt** - chosen when the workspace already holds source at build time. It names the one thing the agent cannot infer — this codebase already exists — and the work to deliver, and nothing more; the how-to-behave rules it once carried (do not re-scaffold, read the existing code first, smallest coherent change set) were dropped as babysitting a capable agent.
- **Scaffold retry prompt** - a hard "the app does not exist yet — create it from scratch now" directive, used when a build's opening turn left the workspace empty: the agent stalled rather than scaffolding, and this retry tells it an empty directory is expected, not a reason to refuse or wait.
- **Workspace-emptiness check** - a workspace counts as empty when it holds no source file the agent could have produced: lockfiles, dotfiles, and dependency/output directories (node_modules, .git, dist, build caches) do not count. Best-effort and cheap — it stops at the first real file, treats an unreadable or missing directory as empty, and never throws.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
