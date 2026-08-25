# Bug analysis: packages/framework/src/store/agent-checkout.ts

## Business logic (high-level)

The one resolution every agent-addressed surface shares: given a project root and an agent id, which
directory does that agent's files live in (`resolveAgentCheckout`), and which event journal should a
run-scoped live view tail (`resolveAgentEventsPath`). The daemon's serve targets and previews, every
dashboard RPC and every event stream go through here, so they can never disagree about where an agent is.

**Ordering is the whole design.** Three probes, in order:

1. The agent's own live meta (`readLiveMetas` → the record's `cwd`). A running agent states the checkout
   it works in, so that wins outright.
2. The worktree directory for that id, probed on disk. This exists from the moment the daemon creates
   it — *before* the agent has written any `agent.json` (#766) — so it covers the window that a
   meta-only lookup misses.
3. The project root.

The SPEC's rationale for probe 2 is the load-bearing part: an event stream resolves its path **once**,
when the browser opens the connection, and keeps it for the connection's life. Falling back to the root
for an agent whose first status write had not landed yet would not self-correct a moment later — the
stream would tail the root journal for as long as the connection lived, which is how a newly started
agent once displayed a previous agent's output. So probe 2 is not a nicety, it is the fix for a real
class of stale-UI bug, and both functions keep it.

`resolveAgentEventsPath` diverges at the *last* step only: where plain resolution falls back to the
project root, an ended agent's archived `<id>.jsonl` wins. The archive existing proves the agent ended,
and it is that agent's own record, whereas the root journal belongs to whichever root-level agent wrote
it last. The root journal remains the final fallback so a just-started root agent (no meta yet, no
worktree to probe) still streams. The SPEC states this preference applies to streams only, and it does.

Consistency of the two functions was checked step by step: same guard, same live-meta lookup, same
worktree probe, same root fallback — `resolveAgentEventsPath` simply appends `FRAMEWORK_DIR/EVENTS_FILE`
to whatever `resolveAgentCheckout` would return, plus the archive step. They cannot drift for any input.

Edge cases and failure modes:

- **Unsafe / absent id.** `isSafeAgentId` (`/^[A-Za-z0-9_-]+$/`) is checked *before* the id ever reaches
  `join`, so `../escape` cannot traverse out of the project — this is the path-traversal guard for the
  whole family of surfaces, and the test file exercises it.
- **`readLiveMetas` rejecting** is swallowed to `[]` (a project with no `.the-framework`, an unreadable
  `branches/`), so resolution degrades to the worktree probe rather than throwing into an RPC handler.
  `archivedAgentPaths` swallows its own errors internally (`findArchive(...).catch(() => undefined)`),
  and `nodeFs().isDirectory` returns `false` for a missing path rather than throwing — so neither
  function has a reachable rejection path.
- **Archive completeness.** `findArchive` keys on the `<id>.json` meta existing and returns the sibling
  `<id>.jsonl`; `archiveAgent` always writes both (an absent live log is archived as `''`), so
  `archivedEvents` can never be a path that does not exist. The destructure
  `const [, archivedEvents] = …` yields `undefined` for the empty array `archivedAgentPaths` returns
  when there is no archive, which is exactly what `?? rootJournal` needs.
- **Both committed and transient archives are searched** (`archiveDirs`: every `agents/<user>/` under
  the data branch's checkout, then `.the-framework/agents/`), so an agent archived on the data branch by
  another user is still found.
- **Side effect of probe 1.** `readLiveMetas` → `readLiveMeta` self-heals a stale `running` meta whose
  owning pid is provably dead by flipping it to `stopped` and archiving it. So a resolution call can
  *mutate* store state. That is `agent-store`'s documented read-time healing (#716) and it makes
  resolution more correct here, not less: the healed agent drops out of the live list, the worktree probe
  or the freshly written archive then answers. Worth knowing, not a defect.
- **A finished agent whose `agent.json` still sits at the project root** resolves via probe 1 to the
  root journal rather than to its archive. That is correct, not a miss of the archive preference: the
  root journal *is* that agent's log for as long as its meta names it, and the SPEC's preference is
  scoped to "where plain resolution would fall back to the project root".
- **Ordering vs. a resumed agent**: a live worktree beats a stale archive left by an earlier stint,
  because the archive is consulted only after the worktree probe fails.

## Functions (low-level)

- `resolveAgentCheckout(projectCwd, agentId)` → `Promise<string>`.
  Inputs: project root and a possibly-undefined agent id. Guard → live meta `cwd` → worktree dir →
  project root. Edge cases: empty/undefined id and unsafe id short-circuit to the root; a live record
  with a falsy `cwd` would fall through to the probe (`readLiveMetas` always sets `cwd` to a real
  candidate directory, so this is unreachable); duplicate ids across two checkouts would take the first
  in `byIdDesc` order, which cannot occur since an id is a start timestamp minted once. No throw path.
  Verdict: correct.
- `resolveAgentEventsPath(projectCwd, agentId)` → `Promise<string>`.
  Same order, appending `FRAMEWORK_DIR/EVENTS_FILE` at each step, with the archived `<id>.jsonl`
  inserted ahead of the root journal. `rootJournal` is computed once up front and used for both the
  guard return and the final fallback, so the two cannot diverge. Returns a path that may not exist yet
  (a live agent's journal before its first event) — correct for a tailer that watches for creation.
  Verdict: correct.

## Bugs found

None found.
