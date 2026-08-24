# Bug analysis: packages/framework/dashboard/components/DashboardPage.tsx

## Business logic (high-level)

The Overview landing page (#1139): onboarding checklist (until `onboardingDismissed`), Quota,
Human Queue beside (Agents-now stacked on AI Queue), Routine work, Hot tickets — the exact order
`DashboardPage.SPEC.md` mandates. Data: one `onDashboard` RPC polled every 5s via `usePolled`
(loading until the first read); `interventions` arrive as a prop from the shell (which also feeds
notifications off the same set — the SPEC's "one call" refers to the board's own data; the queue
prop is the shell's, consistent with the notification wiring). Navigation callbacks are pure
pass-throughs; every row is a way in per SPEC.

Lifecycle: no local state beyond the poll hook; polling cleanup is `usePolled`'s concern (lib).
Dismissed checklist only hides here — the preference is read live, so dismissing from the child
updates this page immediately through the shared preferences store.

## Functions (low-level)

### `DashboardPage(props)` (L29–78)

Order and wiring as above. `data?.active ?? []` / `data?.queue ?? []` with `loading` passed so the
sections can render skeletons instead of fake emptiness — correct distinction between "no data
yet" and "empty". Verdict: correct.

### `HumanQueue({ items, onSelectProject, onSelectAgent })` (L85–190)

- `openAgent`: agent row → `onSelectAgent(projectId, agentId)`, falling back to the project when
  the id is absent — matches the SPEC's "only if that identity is somehow missing".
- Rows keyed by `interventionKey(item)` (client lib, stable per intervention identity).
- Three branches on `item.kind`: `awaiting` (button → agent), `unpushed` (button → agent; commit
  count only when known and > 0 — the "0 commits" contradiction is deliberately avoided, comment
  and SPEC agree), else PR (`<a target="_blank" rel="noreferrer">` to `item.url`).
- Count badge only when non-empty; empty copy "AI doesn't need you." — per SPEC.
- Edge cases: `item.branch` undefined on an unpushed row yields the tooltip "work on  was never
  pushed" (double space, no name) — cosmetic-only and the daemon always names the branch for
  unpushed interventions; noted, not reported. PR items always carry `url`/`number` by type.
  Verdict: correct.

## Bugs found

None found.
