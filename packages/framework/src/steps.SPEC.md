The prompts a build agent opens with, and the one check that decides between them: whether the workspace already holds an app.

## Business logic — TL;DR

- **Three build-opening prompts, filled with the user's intent** - the greenfield build prompt, the existing-codebase prompt (chosen when the workspace already holds source at build time), and the scaffold retry (sent when a build's opening turn left the workspace empty). Each prompt's text is authored as markdown in the prompts directory like every other agent-facing prompt; what happens here is only the choice between them and filling in the intent.
- **Workspace-emptiness check** - a workspace counts as empty when it holds no source file the agent could have produced: lockfiles, dotfiles, and dependency/output directories (node_modules, .git, dist, build caches) do not count. Best-effort and cheap — it stops at the first real file, treats an unreadable or missing directory as empty, and never throws.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
