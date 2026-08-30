Names `.the-framework/` — the directory under a project root where The Framework keeps its own files — and the logs branch, `agents-logs`, which carries what The Framework records about its own runs (the agent archives and the routine locks), with the place its checkout sits under a project: `.branches/agents-logs`, beside the agent checkouts and named as its branch like each of them. Nothing of the product rides there: the tickets and the agent queue are the `tickets` skill's, on their own branch. Kept on its own so browser-side surfaces (the dashboard renders preset file paths built from it) can name paths under it without touching any node-only module.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
