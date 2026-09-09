Names `.the-framework/` — the directory under a project root where The Framework keeps its own files. Nothing of the product rides on a branch of its own: the tickets and the agent queue are the `tickets` and `queue` skills', the runs are the `logs` skill's, and the routine locks sit beside them, all on the shared `agent-data` branch. Kept on its own so browser-side surfaces (the dashboard renders preset file paths built from it) can name paths under it without touching any node-only module.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
