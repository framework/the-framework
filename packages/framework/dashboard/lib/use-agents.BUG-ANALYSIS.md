# Bug analysis: packages/framework/dashboard/lib/use-agents.ts

## Business logic (high-level)

The selected project's agent list, `usePolled(onAgents(projectId), [], 2000, [projectId])`, owned by the shell so the Runs rail and the main pane share one list (SPEC). All the interesting guarantees delegate to `use-async.ts` and are inherited correctly:

- **No project → no read** — null load; value stays `[]`.
- **2s cadence, stop on unmount** — interval per effect run, cleared on teardown.
- **Project switch clears first and drops late answers** — dep change resets to the initial `[]` (no `keepPrevious`) and retires the in-flight token, which also covers the SPEC's headline: a `reload` fired by an action just before a switch cannot write the old project's agents into the new one (`reload` reads `liveRef.current`, the token the switch just killed).
- **`loaded` tells "gone" from "not read yet"** — only a successful read sets it, and it resets on the dep change, so a bookmarked agent link never flashes "gone" during the first read (#784).
- **Failure keeps the last list** — swallow-and-keep, so a daemon hiccup does not empty the rail.

The initial value `[]` is captured once in `use-async`'s `initialRef`, so the fresh-array-literal-each-render footgun is defused there.

## Functions (low-level)

- `useAgents(projectId)` — returns `{agents, reload, loaded}`; the load closure closes over exactly the dep (`projectId`), honouring the `use-async` contract. The `agents: agents` spelling is cosmetic. Verdict: correct.

## Bugs found

None found.
