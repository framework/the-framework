Stands up a disposable copy of the product for one story: the daemon's business logic wired exactly as production wires it, real git-repo projects registered through the real add-project call, and agents spawned as real child processes with the fake driver — a scripted stand-in for the coding-agent CLI — in the driver seat.

## Flows

- Stories drive the product only through the same calls the dashboard makes and watch it through the same live event feed, so what a test sees is what a user sees. The pieces the daemon runs as live loops (quota, auto-PM) are stubs a story controls directly.
- "Finished" means two different things — the agent's row says done, and its workspace has actually been retired — and a story can wait for either.
- Each story file's process gets its own throwaway global state — shared by the worlds that file stands up — so parallel story files never see each other's projects. A story can also park an agent on a scripted question, and read back exactly how each agent child was invoked.
- Teardown mirrors daemon shutdown: stop the agents, wait out in-flight teardowns, then delete everything.

## Rationales

- A story can wait for either kind of finished because acting on an agent in between — row done, workspace not yet retired — is the same race a fast-clicking user hits.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
