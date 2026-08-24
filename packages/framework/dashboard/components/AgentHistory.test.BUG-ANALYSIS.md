# Bug analysis: packages/framework/dashboard/components/AgentHistory.test.tsx

## Business logic (high-level)

Rail tests, mounted under the required `SidebarProvider`; RPC-bearing chrome (ThemeToggle,
NotificationsMenu, ConnectionIndicator) and the projects RPC stubs are mocked so jsdom never
fetches. Coverage vs. `AgentHistory.test.SPEC.md`:

- **Status words** — running+pulse; settled → "waiting", pulse gone (asserts both the word and
  the absence of `.animate-pulse` — honest, since the still dot has no pulse class);
  publishing… (armed, no report) with pulse; plain done for reported/never-armed (two rows,
  `getAllByText('done').length === 2` — cannot pass if either mislabels); terminal status never
  relabelled waiting despite a stale `settledAt`. All genuinely pin the logic. ✓
- **Starting placeholder** — highlight lands on the "starting…" row (checks `bg-accent` on it
  AND its absence on New — the #784 regression pair); retires on a landed agent that was never
  seen running (the `landed` rule; asserts both the placeholder's absence and the failed row's
  presence); survives a pre-existing agent (the `known`-snapshot rule; done via rerender with
  `startTick` 0→1, matching the real tick flow). ✓
- **Where it runs** — device glyph label with name; other-host laptop glyph shown only for
  `otherHost` rows (both positive and negative asserted, cross-project variant); cloud runs:
  in-cloud vs stopped vs waiting vs merged/done trio (fresh/old `startedAt` drive the
  12h-window branch of `cloudRunState` both ways) plus glyph + driver label ("claude-web is
  still Claude"). These pin `cloudRunState` integration, not just the component. ✓
- **Scope** — empty Overview shows New + "No agents yet."; pooled recents name projects and
  `onSelectRecent` gets `(projectId, agentId)`. ✓
- **New** — one project → starts there; in-project → starts there; several+none →
  `aria-haspopup` (menu, not immediate start). ✓
- **Tickets** — offered/absent per `onTickets`; opens; `aria-current` active with Overview not
  claiming it (the `projectId === null` shared-state regression). ✓ (Does not cover the
  ticket-*detail* route where New and Tickets both light up — that needs `projectId` non-null
  with `ticketsActive`, a combination no test renders; the bug filed in
  `AgentHistory.BUG-ANALYSIS.md` bug 1 slips through exactly here.)
- **Title tooltip** — overflow simulated by stubbing `scrollWidth`/`clientWidth` prototype
  getters (jsdom measures 0), full prompt in tooltip via the shared `hoverTooltip` util; the
  fits case fires hover events and asserts no tooltip role appears — a real negative since the
  plain-span branch has no trigger wiring. Spies restored in `finally`. ✓
- **Project health** — red dot + `projectErrorTitle` wording + raw message in tooltip; healthy
  project keeps "Activated:" sr-only text and no `.bg-danger`. ✓

Async hygiene: the two tooltip tests await `hoverTooltip`/`findByText`; everything else is
synchronous rendering. `cleanup` after each; hoisted mocks initialized before the dynamic
import of the component under test (the documented reason for the `await import`).

Gaps (no SPEC claim broken): no test for the cloud-waiting row's dot (the SPEC-required still
dot is missing in the source — nothing here would catch it), none for the optimistic row's 20s
deadline (timer-based; reasonable omission), none for the two-highlight ticket-detail case
noted above.

## Functions (low-level)

- **`agent(over)` (L27)** — minimal valid `AgentMeta`; `updatedAt`/`startedAt` fixed ISO
  strings keep `formatRelative` deterministic enough (it renders a relative phrase, never
  asserted on). Correct.
- **`renderRail` (L39)** — SidebarProvider wrapper; rerenders in tests re-wrap manually —
  consistent. Correct.
- **`proj(id,name)` (L223)** — activated ProjectSummary. Correct.
- **Assertions on class names** (`bg-accent`, `.animate-pulse`, `.bg-danger`) — couple the
  tests to styling tokens, but each token *is* the behavior under test (highlight, pulse, error
  dot); acceptable and stable within this design system. Correct.

## Bugs found

None found.
