Makes sure no driver process ever outlives the agent that spawned it: each spawned child leads its own process tree, and stopping an agent — or the framework itself dying — reaps the whole tree instead of orphaning it.

## Flows

- Every live tree is tracked so even a hard crash of the framework still takes them all down on the way out.

## Rationales

- The whole tree is killed at once because signaling only the top agent process leaves its helpers (workers, tool calls, servers) burning CPU forever.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
