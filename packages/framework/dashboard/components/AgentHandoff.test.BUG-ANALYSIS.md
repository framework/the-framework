# Bug analysis: packages/framework/dashboard/components/AgentHandoff.test.tsx

## Business logic (high-level)

Tests for the four handoff pieces, driven through a `Harness` that composes them the way
`AgentView` does — importantly, it runs the real `useAgentHandoff` hook (only the RPC modules
are mocked), so the busy/pending/error/reload plumbing is exercised, not stubbed. Coverage
matches `AgentHandoff.test.SPEC.md` bullet for bullet:

- **Verdict/detail**: counts summarised; subjects/paths only when expanded (the harness gates
  the details on `open && handoffExpandable`, mirroring the real bar's disclosure); branch name
  never repeated; nothing rendered before the first read (never-resolving promise → empty
  container — a genuine pin of the `loaded` flash guard).
- **Nothing to hand off**: "no changes" + no button + reason; `handoffExpandable` false;
  uncommitted work named ("a.ts, b.ts and 2 more"), hover carries the full newline-joined list,
  disclosure lists them; branch gone and no-remote reasons.
- **Next step**: only Open PR (never Push branch, also asserted when already pushed); click →
  `sendOpenPullRequest('p1','run-1')` and never `sendPushBranch`; failure surfaces the RPC's
  error string (through the real `useAction` failure branch — `{ok:false,error}` → error state);
  open PR → Merge PR wired to `sendMerge`; merged/closed PR → neither button.
- **Arming**: exactly one checkbox, ticked; untick → `sendSetHandoff(...,'local')`; tick from
  local → `'pr'`; push-only label; merge label ("Open PR & merge", and no plain "Open PR" —
  `queryByText` is exact-match so the substring does not false-positive); the pending latch
  (click, await RPC, rerender with the stale armed prop, box still unticked via `data-checked`
  null).

All async tests await their assertions; mocks are reset per test including re-priming resolved
values; `cleanup` runs. Each test fails if its pinned behavior regresses (I traced each
assertion to the branch it guards; none is vacuous).

Weak spots (recorded, none rises to a bug):

1. The merged-PR fixture (`{...worked, pushed: true, merged: true, empty: false, pr: {state:
   'MERGED'}}`) is a state the real reader cannot produce — `readAgentHandoff` derives
   `merged: true` only when the branch is an ancestor of base, which forces `empty: true`. The
   test still proves the button logic it targets (PR-state gating), but it is why the summary's
   unreachable "· merged" marker (see `AgentHandoff.BUG-ANALYSIS.md` bug 1) went unnoticed: no
   test renders a *producible* merged handoff, and no test asserts the "merged"/"pushed"
   markers at all.
2. "push is offered only while the branch is unpushed" (L130) asserts `Push branch` absent —
   but that string is absent in every state of the current one-button design; the test title
   is a leftover from the two-button era. It cannot fail for the reason its name gives
   (harmless: its other assertion, Open PR present for a pushed branch, is real).
3. The Harness renders `state.error` itself rather than through the real bar, so the failure
   test pins the message's existence, not its placement — placement is AgentView's, tested
   there. Acceptable division.

## Functions (low-level)

- **Mocks (L4-10)** — `onAgentHandoff` (reads) and the four control RPCs; shapes match the
  real signatures (`sendSetHandoff` → void, actions → `{ok, error?}`). `sendPushBranch` is
  mocked though nothing should call it — that is the point of the never-called assertion.
- **`worked` fixture (L16)** — a coherent producible handoff (exists, non-empty, unpushed, no
  PR). Correct.
- **`Harness` (L32)** — described above; `open` defaults true so detail tests need no click.
  Correct.
- **Per-test verdicts** — all correct; see weak spots for the two soft assertions.

## Bugs found

None found. (The unproducible merged fixture and the stale test name are recorded above as
test-quality notes, not defects — every assertion still pins a true behavior.)
