# Bug analysis: packages/framework/dashboard/components/AgentHandoff.tsx

## Business logic (high-level)

Four exports composing the end-of-work handoff in the agent's action bar (SPEC:
`AgentHandoff.SPEC.md`): `HandoffSummary` (one-line verdict), `HandoffArm` (the live
pre-commitment checkbox), `HandoffActions` (the settled agent's next step / reason), and
`AgentHandoffDetails` (+`handoffExpandable`) behind the disclosure. Data comes from
`useAgentHandoff` (polled `onAgentHandoff` → `readAgentHandoff` in
`src/dashboard/agent-handoff.ts`) and, for the arm, from the event fold `handoffState` reduced
to a rung by `handoffFromStages`.

Verified against the SPEC:

- **Verdict** — "branch gone" vs "no changes" told apart; counts + DiffStat; "pushed" only when
  no PR (the bar links the PR); see bug 1 for "merged".
- **Arming** — one checkbox, label names the rung in force (`Push branch` / `Open PR` /
  `Open PR & merge`), untick → `local`, re-tick → `pr` (never restores merge) — exactly the
  SPEC's ladder semantics; optimistic `pending` holds the click until the events echo it
  (bounce-free, test-pinned). See bug 2 for the pending latch across agent switches.
- **Next step** — `prPending` → nothing (the "second PR" guard, #1028); open unmerged PR →
  Merge PR; closed/merged PR → nothing; else Open PR; branch gone / empty (+named uncommitted
  paths, first two + count, full list in `title`) / no remote → Reason. Order of the guards
  matches the SPEC's own order. In-flight labels ("Merging…", "Opening PR…") keyed off
  `pending`, failures surface through `useAgentHandoff`'s error (rendered by the callers).
- **Details** — commit list capped at 6, files and uncommitted at 10, each with "and N more";
  empty sections omitted; `handoffExpandable` refuses branch-gone and
  nothing-changed-nothing-pending. All ✓.

Concurrency/ordering: the arm's RPC failure path reverts `pending` (`.catch`), success waits
for the event round-trip; `busy` prevents double-fire during the RPC only, which is fine since a
second click during the pending window just re-sends. A failed `sendSetHandoff` reverts
silently — no error line — the SPEC only demands failure reporting for the next-step actions,
so noted here, not filed. `HandoffActions` is stateless; its `busy`/`pending` live in
`useAgentHandoff`, reset by `act`.

Cross-file observation (fix would belong in `src/dashboard/agent-handoff.ts` L343-346):
`readAgentHandoff` computes `merged` purely as `git branch --list --merged base branch`
(ancestor check), while the framework's own merges are squash merges (`ghMergePr` uses
`--squash`), whose branch tip is never an ancestor — so `merged: true` occurs only for
externally merge-committed branches, and for those `base..branch` is empty ⇒ `commits.length
=== 0` ⇒ `empty: true`. Both facts feed bug 1.

## Functions (low-level)

- **`handoffExpandable(handoff)` (L29)** — `exists && (!empty || pendingFiles?.length)`.
  Nullable-safe. Note: an `empty`-because-bookkeeping-only handoff can still carry non-empty
  `commits`/`files`; when it also has `pendingFiles` the details pane then lists the
  bookkeeping files — informative rather than wrong. Correct.
- **`HandoffSummary` (L34)** — null → null; `!exists` → "branch gone"; `empty` → "no changes";
  else counts + optional markers. Pluralization correct. Bug 1: the `merged` marker (L51) is
  unreachable — see below. Otherwise correct.
- **`HandoffArm` (L67)** — `armed = handoffFromStages(state)`; `shown = pending ?? armed`;
  effect clears `pending` when the events agree. `set` is optimistic with revert-on-reject.
  The un/re-tick mapping `on ? 'pr' : 'local'` matches the SPEC. Bug 2: `pending`/`busy` are
  never reset when `agentId` changes under the mounted component. Otherwise correct.
- **`Arm` (L134)** — label-as-hit-target checkbox inside a tooltip trigger; `onCheckedChange`
  normalizes the indeterminate type to boolean. Correct.
- **`HandoffActions` (L168)** — guard order: no handoff → null; `prPending` → null; PR present
  → Merge only for OPEN-and-not-merged; `!exists` → reason; `empty` → reason (+pending files
  named via `namePending`); `!hasRemote` → reason; else Open PR. Edge: a PR with state
  'UNKNOWN' (offline `resolveAgentPr` fallback) offers nothing — conservative and safe against
  the double-PR mistake. Edge: `merged` true with no PR falls through to the `empty` reason
  ("Nothing committed — no PR to open."), slightly untrue for landed work but never offers a
  wrong action; folded into bug 1's fix. Correct except as noted.
- **`namePending(paths)` (L234)** — first two joined, rest counted; `rest` arithmetic safe for
  1/2/3 paths (0 → no suffix). Correct.
- **`Reason` (L241)** — width-capped truncating span, optional `title` hover. Correct.
- **`AgentHandoffDetails` (L252)** — re-checks `handoffExpandable`; two-column grid only with
  >1 section. Correct.
- **`Commits`/`Files`/`PendingFiles` (L271/L312/L293)** — slice + count remainder; keys by
  sha/path (unique within a handoff); binary files say "binary" instead of a diffstat. All
  correct.

## Bugs found

1. **L39/L51: a merged branch's verdict reads "no changes" — the "· merged" marker is dead
   code.** `readAgentHandoff` can only report `merged: true` when the branch tip is an ancestor
   of base (`git branch --list --merged`), and then `base..branch` is necessarily empty ⇒
   `commits.length === 0` ⇒ `empty: true` — so `HandoffSummary` early-returns "no changes" at
   L39 and never reaches the `handoff.merged && '· merged'` span at L51. Scenario: an agent's
   PR is merged on GitHub with a merge commit (or the user merges the branch locally); the
   agent's bar then says "no changes", which reads as "the agent produced nothing" — exactly
   the confusion the SPEC forbids ("work that landed says 'merged'"; branch-gone/no-changes/
   merged are "different facts"). The framework's own squash merges (`--squash` in
   `ghMergePr`) sidestep the marker too (git `merged` stays false), so no path ever renders it.
   Severity: minor. Fix: in `HandoffSummary`, check merged before the empty early-return —
   e.g. `if (handoff.empty) return <span>{handoff.merged ? 'merged' : 'no changes'}</span>` —
   and (cross-file, `src/dashboard/agent-handoff.ts` L346) consider `pr.state === 'MERGED'` as
   `merged` so squash-merged work says it too.

2. **L76-87: `HandoffArm`'s optimistic `pending` (and `busy`) leak across agent switches.**
   The component is rendered at a stable position inside the always-mounted `AgentView`
   (`working ? <HandoffArm/> : …`, no `key`), so switching the rail from working agent A to
   working agent B keeps the same instance and state. Scenario: untick A's box (pending
   `'local'`), switch to B before A's event echo lands — B's box renders unticked ("hands off
   nothing") although B is armed `pr`, and the latch never clears because the clearing effect
   waits for `pending === armed` (`'local' === 'pr'` never holds); B's arming display stays
   wrong until the user clicks it. The sibling `AgentComposer` resets its equivalents on
   `[agentId]` for exactly this reason. Severity: minor (wrong pre-commitment display; the
   daemon state is untouched). Confidence: medium (needs the switch inside the echo window,
   but the wrong state then persists indefinitely). Fix:
   `useEffect(() => setPending(null), [agentId])` in `HandoffArm`.
