# Bug analysis: packages/framework/src/dashboard-rpc/events.ts

## Business logic (high-level)

The daemon's live feed for one agent. It is not an RPC in the table sense — `index.ts` exports it
separately as `RPC_EVENT_STREAM`, and the mount turns each `send(value)` into one SSE frame — so
this module's whole job is: pick the source, and keep the subscription pointed at the right file for
its whole life.

Per `events.SPEC.md` there are four invariants:

1. **The feed belongs to one agent.** With `agentId`, follow that agent's own journal (its worktree
   while running, its archive once it has ended); without one, follow the project-root journal.
   An unknown project streams nothing and closes cleanly (`undefined` return), never an error.
2. **A relayed agent streams from memory.** `contextEventsSource()(projectId, agentId)` answers only
   for an agent this daemon relays from a device; that wins over disk and the feed closes when the
   relayed agent's iterable is exhausted (`forwardStream`'s `onDone`).
3. **A local agent streams from its log wherever it now lives** — replay, one `stream-sync` marker,
   then appends, following the journal across its move into the archive without loss or repeats.
4. **A feed never falls back onto another agent's events.** `resolveAgentEventsPath`'s last-resort
   answer is the project-root journal; adopting that mid-subscription would splice a *different*
   agent's output into this tab, so a run-scoped feed treats "the answer is now the root journal" as
   "no answer" and goes quiet. The first attach is deliberately exempt (a non-git fallback agent
   legitimately writes there).

Invariant 4's implementation is the `initial` latch plus the pre-computed `rootJournal`. Both are
sound: `rootJournal` is a pure path derivation (`join(cwd, '.the-framework', 'events.jsonl')`) with
no probing, so it cannot go stale, and the latch is flipped inside the resolver — the only place
`tailAgentEvents` calls it — so exactly the first resolution is permissive. Ordering is safe because
`tailAgentEvents` awaits that first `resolvePath()` before any relocation can be attempted.

**Lifecycle / concurrency.** One tail per subscription; nothing is shared between subscribers, so
two browsers watching the same agent each hold their own `JsonlTailer` and offset. The stop function
returned by `tailAgentEvents` is what the mount calls on disconnect; it sets `stopped` and kills the
`followFile` interval + watcher. A resolver rejection (registry read failure) is handled inside
`tailAgentEvents` — the marker still fires and the feed stays silent, rather than an unhandled
rejection.

**The gap.** The relocation trigger in `tailAgentEvents` is "the tailed file disappeared". That
covers exactly one direction of the journal's travel — worktree → archive. The reverse move, which
`events-tail.ts`'s own header names ("a continuation restores it into a fresh checkout"), never
fires: `restoreArchivedAgent` (store/agent-store.ts L763) *copies* the archived `<id>.jsonl` into the
new checkout and leaves the archive in place, so the file this feed is tailing never disappears and
the tail never re-resolves. Everything about the continuation is otherwise ready — the restored log
is a byte-identical prefix, so `retarget` + offset carry would work exactly as it does in the
outward direction. See bug 1.

## Functions (low-level)

### `resolveEventsPath(projectId, agentId?)`
Project id → workspace path (`resolveProjectPath`, the registry) → `resolveAgentEventsPath(cwd,
agentId)`. Returns `undefined` only for an unknown project. Inputs are caller-supplied strings off
an HTTP request; `resolveAgentEventsPath` rejects unsafe ids itself (`isSafeAgentId`, falling back to
the root journal), so no traversal reaches `join`. Each call does a registry read plus up to two fs
probes and an archive lookup — it runs three times per subscribe (L70, L76, and the tail's first
`resolvePath`) and once per relocation attempt; cheap enough, and the redundancy is harmless because
all three answers are consistent unless the agent ends inside that window (in which case the tail's
own answer wins, which is the correct one). Correct.

### `StreamSync` / `LiveFeedEvent`
Wire-only marker type, never written to a journal. `LiveFeedEvent` is what the mount serialises.
Note that the marker travels the same channel as real events and is distinguished by `kind`; the
dashboard's `use-live-events` switches on `kind === 'stream-sync'` and swallows it. Since
`FrameworkEvent` has no `stream-sync` kind, there is no collision. Correct.

### `streamAgentEvents(projectId, agentId, send, onDone?)`
The whole surface.

- **Relay branch (L60–63).** `contextEventsSource()` throws if the context is unwired — deliberate
  (context.ts: "unwired is a bug rather than a degraded host"), and the one host wires it. When it
  answers, `forwardStream` owns the pump: `send` per value, `onDone` when the iterable ends, stop
  cancels the iterator. Note `onDone` is *not* passed to the disk branch — correct per SPEC ("the
  feed closes when that agent ends" is the relayed case only; a local agent's tab stays open).
- **Disk branch (L70–89).** `path` is computed only to decide `undefined` vs a tail; the tail
  re-resolves for itself. `rootJournal` is computed once, before the latch, and only when an
  `agentId` was named. The resolver: first call returns whatever was resolved; every later call
  maps "the root journal" to `undefined`, which `tailAgentEvents.relocate` reads as "not visible
  yet" and keeps polling the dead path — the "goes quiet" behaviour SPEC §4 asks for. One subtlety
  worth stating: `undefined` there is indistinguishable from "not resolvable yet", so a deleted
  session's tail polls a nonexistent path once a second for as long as the tab stays open. That is
  by design (the alternative is closing the SSE response, which the mount reads as an error), and
  the cost is one `existsSync` per second.
- **Edge: `agentId` given, no worktree, no archive (a just-started run, #766).** First resolution
  answers the root journal and the latch permits it; the feed shows the project journal until the
  page is reloaded. Intentional per the code comment and SPEC ("The very first attachment is
  deliberately permissive").
- **Edge: unknown project.** `undefined` → mount closes cleanly. Correct.
- **Edge: `send` after stop.** `tailAgentEvents` guards every callback on `stopped`; `forwardStream`
  guards its loop. Nothing can write to a closed response. Correct.

Verdict: correct except for the continuation direction of the journal's travel (bug 1).

## Bugs found

1. **L78–89 (fix belongs in `packages/framework/src/dashboard-rpc/events-tail.ts` L89–104): a feed
   open across a *continuation* stays pinned to the stale archive and shows nothing the resumed
   agent does.** `tailAgentEvents` re-resolves only when the tailed file disappears. Teardown
   removes the worktree, so an open feed correctly relocates to the archived `<id>.jsonl`. A
   continuation then runs `restoreArchivedAgent` (`store/agent-store.ts` L763–781), which *copies*
   that archive into the fresh checkout and leaves the original in place — so the tailed file never
   vanishes, `pullOrRelocate` keeps taking the `existsSync(path) === true` branch, and the feed sits
   on a file nothing will ever append to again. Concrete scenario: the user watches agent X; it
   finishes, its branch is pushed and its worktree removed (`tearDownWorktree`,
   `daemon-runtime.ts` L594–629, the normal path — "the checkout goes once its work is on the
   remote"); the user clicks Continue (or the daemon's own transient-death retry, `retryTransientDeath`,
   fires it unattended). The same agent id is reused, so the dashboard's subscription is not torn
   down — `useLiveEvents`' effect deps are `[projectId, agentId]` and `resetKey` deliberately does
   not resubscribe (`dashboard/lib/use-live-events.ts` L135) — and the tab shows an empty/frozen
   feed for the entire continued run, only catching up when the *next* teardown rewrites the archive
   (which grows past the carried offset). This contradicts `events.SPEC.md` §"A local agent streams
   from its log, wherever it now lives" and `events-tail.ts`'s own header, which names "a
   continuation restores it into a fresh checkout" as a move this tail handles. Severity: major
   (the live feed of a resumed agent is silent). Confidence: medium (mechanism is certain; it
   depends on the tab staying subscribed across the continuation, which the hook's deps say it
   does). Fix: make relocation answer to the resolver rather than to the file's disappearance — in
   `pullOrRelocate`, when the file exists, also compare `await resolvePath()` with `path` every poll
   (or every Nth) and relocate when it differs; `retarget` already carries the offset correctly
   because the restored journal is a byte-identical prefix of the archive. Cheaper alternative in
   the dashboard: add the `resetKey` to `useLiveEvents`' subscribe effect deps so a Start/Continue
   resubscribes — the reconnect path already buffers the replay and swaps on `stream-sync`, so it
   would not flicker.
