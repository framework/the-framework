Stands up a disposable copy of the product for one story: the daemon's business logic wired exactly as production wires it, real git-repo projects registered through the real add-project call, and agents spawned as real child processes with the fake driver in the driver seat.

## TLDR

- Stories drive the product only through the same calls the dashboard makes and watch it through the same live event feed, so what a test sees is what a user sees; the pieces the daemon runs as live loops (quota, auto-PM) are stubs a story controls directly.
- "Finished" means two different things — the agent's row says done, and its workspace has actually been retired — and a story can wait for either, because acting on an agent in between is the same race a fast-clicking user hits.
- Each world gets its own throwaway global state, so parallel stories never see each other's projects; a story can also park an agent on a scripted question, and read back exactly how each agent child was invoked.
- Teardown mirrors daemon shutdown: stop the agents, wait out in-flight teardowns, then delete everything.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
