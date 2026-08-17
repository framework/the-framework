Makes sure no driver process ever outlives the agent that spawned it: each spawned child leads its own process tree, and stopping an agent — or the framework itself dying — reaps the whole tree instead of orphaning it.

## TLDR

- Signaling only the top agent process used to leave its helpers (workers, tool calls, servers) burning CPU forever; killing the whole tree at once is the fix.
- Every live tree is tracked so even a hard crash of the framework still takes them all down on the way out.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
