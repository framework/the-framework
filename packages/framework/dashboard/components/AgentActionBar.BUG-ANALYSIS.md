# Bug analysis: packages/framework/dashboard/components/AgentActionBar.tsx

## Business logic (high-level)

One agent's action bar, a pure composition with no state of its own. Left: identity and git
context via `GitStatusBar` (project/session breadcrumb, branch as a disclosure when `onToggle`
is given, dirty flag, disk size, PR, `summary`) with the one status pill injected beside the
branch facts as `agentState`. Right, in the SPEC's order: `AgentErrorCount` (unresolved error
count), the caller-supplied `actions` node (the handoff's next visible step), and the
`AgentActionsMenu` overflow. Serves running and finished agents alike so controls stay put at
Done — nothing here branches on liveness; the children derive everything from `events`.

SPEC conformance checked point by point:
- **Identity first, git second** — label/projectName/summary/expanded/onToggle forwarded to
  `GitStatusBar`; the bar itself adds nothing. Holds (delegated).
- **One status word** — `agentStatusPill(events)` (lib/agent-status.ts) is ranked exactly as the
  SPEC lists: failed (with reason) > stopped > publishing > ready for merge > building (only
  while active) > finished, and null until the agent named itself/reached a state/ended.
  Verified against the implementation; the pill renders with `title={status.label}` so the
  truncated (max-w-40) failure reason is still reachable, and the dot is `aria-hidden`. Holds.
  (The inline comment at L53-54 lists only five states, omitting "publishing" — stale comment,
  not behavior; noted only.)
- **Errors counted next to the controls** — `AgentErrorCount` sits inside the `shrink-0`
  controls cluster, so the count cannot be truncated away. Holds.
- **Only the next step is a button** — `actions` is a slot; the menu gets
  `retainedWorktree`/`onWorktreeRemoved`/`onDeleted` so remove-worktree and delete are offered
  per the caller's knowledge. Holds (the caller decides what `actions` holds; this file cannot
  enforce "only the next step", by design).
- **The row never wraps** — `flex items-center` with `overflow-hidden`, a `grow shrink-0`
  spacer, and a `shrink-0` controls cluster; only `GitStatusBar` (min-width-able) gives up
  width. A pathologically long status label is capped at `max-w-40`. Holds.

Edge cases: `agentId` absent (project-root control log fallback) is simply forwarded; `status`
null renders no pill (the `agentState` expression short-circuits to `false`, which GitStatusBar
must treat as absent — consistent with its `ReactNode` prop); `events` empty → null pill, zero
errors, menu still usable. No effects, subscriptions, or timers — nothing to leak; re-renders
are driven entirely by the parent's `events` identity.

## Functions (low-level)

- **`AgentActionBar(props)`** — computes `status = agentStatusPill(events)` once per render and
  lays out the row as described. Inputs: ids, events, presentation props, callbacks. Output: one
  flex row. Failure modes: none of its own — no async, no state; incorrect `events` ordering
  would surface in the children, which own that logic. The `agentState` prop passes `status &&
  (<span…>)`, so a falsy status contributes `null`-ish content rather than an empty wrapper.
  Verdict: correct.

## Bugs found

None found.
