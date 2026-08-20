Activates a repo for the framework: it becomes a Git repo if it is not one yet, gets the framework's marker directory and its ignore rules, and the activation itself is committed.

## Flows

- Pre-existing uncommitted changes are committed first, so the install commit is clean and none of the user's work is mixed into it.
- The ignore rules keep every bit of agent state out of Git on the code branches (the durable records live on the data branch); the quality presets are materialized so their references resolve, but regenerate per install rather than being committed.
- The ignore file is also the activation marker: it is the one file install always writes, so a repo that has it is already activated.
- Install also records the layout marker — the committed note of where this build keeps its bookkeeping, the data branch's name included — so a differently-laid-out build later refuses to run in the repo instead of committing files under the wrong names.
- Activating an already-activated repo is a harmless no-op, and any failure comes back as an error value, never a throw.
- Also finds which immediate children of a folder are their own Git repos, for adding a whole directory of projects at once.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
