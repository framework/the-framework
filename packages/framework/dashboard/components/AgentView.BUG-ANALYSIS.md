# Bug analysis: packages/framework/dashboard/components/AgentView.tsx

## Business logic (high-level)

One agent's page — stable frame for running and finished (#1026), per `AgentView.SPEC.md`. Key
mechanisms, each checked:

**Event source selection** — `shown = live ? events : archived?.length && !feedAhead ? archived
: events`. Empty archive never replaces on-screen events (#1383) ✓; stale archive never hides a
resumed leg — `feedAhead` prefers the channel when it holds more (#1460) ✓; foreign-journal
guard: `sameJournal` matches the archive's first event as fingerprint (JSON.stringify equality
— events are plain JSONL rows, so structural equality is sound; an unloaded/empty archive keeps
the show-the-feed fallback, transiently showing the root journal until the archive lands, which
the SPEC accepts) ✓. `archiveBehind` bumps a dep to re-read the archive while the feed is ahead,
which is how archive-only epilogue events (clean run's `handoff`) reach the screen ✓ — but see
bug 2 for a residual stall.

**`feedLive`** — `live || (feedAhead && isAgentActive(events))`: the feed's own verdict drives
the scroll contract and the composer slot during the ≤2s poll window after a Resume ✓ (the
composer's Stop takes over the moment the first event lands, per SPEC).

**working vs live (#1173)** — `working = live && !agentSettled(events)`; the arm checkboxes
show while working, the handoff actions once settled; the handoff read enabled `!working`;
`showHandoff` additionally waits for `handoff.loaded` so the summary swaps exactly once ✓.
`working` reads the *channel* events (not `shown`) as the comment demands — correct: while live
they are the same events, and once not live `working` is false regardless.

**outcome** — `live ? undefined : agentOutcome(shown)`; during the resume window the newest
segment has no `end`, so `agentOutcome` is undefined — the composer's `resuming` latch covers
the flicker (#1460) ✓.

**armed handoff** — `handoffState(shown, armedDefault)` seeded from the agent record's mirror
(#1376) so a tab opened mid-run reads the same arming ✓; the failed auto-handoff is surfaced on
the bar (`armed.result?.outcome === 'failed'`) ✓.

**Retained worktree / removal** — `retained` refetches per `[projectId, agentId, live]`
(`useLoaded` resets to `[]` on dep change), `removed` clears the offer locally after a removal
✓ for the same agent — but `removed` never resets on an agent switch (bug 1).

**Target notices** — ActionsRunNotice / CloudAgentNotice (+ CloudMirrorRow tail) /
RemoteAgentNotice each rendered unconditionally and self-gating on `target` ✓; `lost` banner
delegated to AgentFeed ✓; empty states split "Loading agent…" (finished, archive pending) vs
the feed's own waiting label ✓.

Statefulness across agent switches (the component is never remounted — `App.tsx` renders it
unkeyed): `archived`/`retained` reset via dep-keyed hooks; `removed` (bug 1), `archiveBehind`
(bug 2), `open` (deliberate-looking persistence of the disclosure; harmless), and `changes`
(stale counts can flash on the bar for up to one poll after switching between two working
agents before the new `AgentChanges` reports — self-correcting, noted only) do not.

## Functions (low-level)

- **`AgentView(props)` (L30)** — orchestration only; every derived value analyzed above.
- **`archived` read (L89)** — `!live && agentId ? () => onAgent(projectId, agentId) : null`;
  dep list includes `archiveBehind` for the re-read. Correct.
- **`retained` read (L97)** — enabled on the same condition; `includes(agentId)` guarded by
  null/undefined checks. Correct.
- **`onChangesSummary` (L117)** — identity-stable via useCallback, equality guard prevents
  render loops with `AgentChanges`. Correct.
- **`sameJournal`/`feedAhead`/`shown` (L141-144)** — analyzed above; the `!archived?.length`
  clause makes an empty archive count as same-journal, which combined with `shown`'s
  `archived?.length &&` guard keeps the live events on screen. Correct.
- **archive-behind effect (L145)** — fires only when `!live && archived !== null && feedAhead`;
  see bug 2. Otherwise correct.
- **`session`/`progress`/`outcome`/`armed` folds (L153-162)** — all over `shown`, so a finished
  agent reads its archive. Correct.
- **Render (L168-263)** — bar summary swap (`showHandoff`), details/changes/handoff panes gated
  on `open`/`working`, feed props for finished (`stick:false, openAt:'end'`, empty label),
  composer receives `feedLive`/sessionId/driver/outcome. Matches SPEC. Correct.

## Bugs found

1. **L98: `removed` is never reset when the agent changes — the next agent's Remove offer is
   wrongly hidden.** Scenario: open finished agent A (worktree retained), press Remove
   (`onWorktreeRemoved` → `removed = true`), then select finished agent B which also retained
   its worktree — `AgentView` stays mounted (no `key` in `App.tsx`), `retained` refetches and
   includes B, but `hasWorktree = !live && !removed && …` stays false, so the bar never offers
   to remove B's worktree (until a full page reload). Contradicts the SPEC ("Whether a finished
   agent still has its worktree decides whether the bar offers to remove it"). Severity: minor.
   Confidence: high. Fix: `useEffect(() => setRemoved(false), [agentId])` (mirroring the reset
   pattern AgentComposer uses for its latches).
2. **L88/L145: `archiveBehind` carries over across agent switches and can stall the archive
   re-read on an exact length collision.** It is only ever set to `events.length` and never
   reset, so after leaving agent A with `archiveBehind = N`, opening agent B whose channel feed
   also holds exactly N events while its archive is behind makes `setArchiveBehind(N)` a no-op
   — no re-read fires, and B's archive-only epilogue events (the `handoff`/PR line) never reach
   the screen until some new event changes the length or the user refreshes; the SPEC promises
   they arrive "without the user refreshing". Severity: minor. Confidence: low (requires the
   equal-length coincidence). Fix: reset it on agent change (`useEffect(() =>
   setArchiveBehind(0), [agentId])`) or make the trigger a fresh object token instead of the
   length.
