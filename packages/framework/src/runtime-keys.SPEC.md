The one key scheme for the daemon's in-memory per-project state, shared by the agent runtime and the preview runtime: an agent-scoped entry is keyed `<project key>::<agent id>`, a project-scoped entry (a fallback agent with no worktree, or a project's preview) is keyed by the bare project key. Building a key, splitting it back into its two halves, and asking whether a key belongs to a given project all happen here and nowhere else, so the encoding cannot drift between call sites.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
