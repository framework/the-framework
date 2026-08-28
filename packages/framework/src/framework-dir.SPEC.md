Names `.the-framework/` — the directory under a project root where The Framework keeps its own files — and the data branch, `tf-data`, with the place its checkout sits under a project. Kept on its own so browser-side surfaces (the dashboard renders preset file paths built from it) can name paths under it without touching any node-only module.

The data checkout's place, `.the-framework/branches/tf-data`, is temporary (#1736): the agent checkouts moved to the branch-management package's `.branches/`, and the data checkout stays where it has always been until the convention for where a data branch lives is decided.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
