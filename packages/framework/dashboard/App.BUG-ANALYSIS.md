# Bug analysis: packages/framework/dashboard/App.tsx

## Business logic (high-level)

The dashboard shell. Responsibilities per `App.SPEC.md`:

- **URL = selection**: `useRoute()` parses `/`, `/{projectId}`, `/{projectId}/{agentId}`,
  `/settings`, `/tickets`, `/{projectId}/tickets/{slug}[/plan]`; every navigation helper
  (`selectAgent`, `selectProject`, `selectAgentInProject`, `newAgentInProject`, `showDashboard`,
  `showSettings`, `showTickets`, `openTicket`, `openTicketPlan`) is a history push and also ends
  the adopt-follow. Verified against `lib/route.ts`: `settings`/`tickets` cannot collide with
  project ids, so the route branches in `renderMain` are exhaustive and ordered correctly
  (plan → detail → list → overview → unknown project → home/adopting → missing agent → agent).
- **Just-started agent**: `agentStart` {tick, intent, id, runsOn} drives the optimistic sidebar
  row and the live `AgentView` before `agent.json` exists; a continuation of the agent already on
  screen keeps the tick so the transcript is not blanked. "Gone" is only shown for an agent absent
  from a list that was actually read (`agentsLoaded` from `useAgents`) and that is not the
  just-started id — matches the SPEC's three-way distinction.
- **No-worktree fallback**: `adopting` follows live output and adopts the running agent with a
  `replace` navigation once the poll surfaces it; every explicit selection clears it. Gap: it is
  not scoped to the project it started in (Bug 2).
- **Per-project context set**: reset on `projectId` change (covers Back/Forward, keyed off the
  route), on start (`agentStarted`), and on sidebar "New" in the same project (`newAgentInProject`
  resets explicitly because the project-change effect would not fire). Complete.
- **Shared polls**: files (10s, scoped to project+agent), interventions (15s, unconditional —
  feeds badge, Overview card, title, notifier), projects (30s, reloadable via `projectsKey`),
  activity (15s, polled only while its notification could fire — matches SPEC), recents (10s,
  Overview only). Notifications gated on category+browser prefs; the notifier receives the whole
  `ProjectionRead` so unreachable projects are not mistaken for all-new (#1625).
- **Tab title/icon**: `useDocumentTitle(interventions.length, projectName)`, `useFavicon(working)`.
- **Dead daemon banner**: `useDaemonHealth()` gates a `role="alert"` banner. Matches SPEC.
- **Dead ends**: unknown project → `NotFound` (guarded by `projects.length > 0` — Bug 1); gone
  agent → `NotFound` with a way back; `onDeleted` returns to the project home and reloads the
  rail.

Layout: one `SidebarProvider` frame; `AgentHistory` sidebar; main pane; `RightRail` on every
view except tickets. Note: the inline comment at L415-417 claims Settings has no rail either
("the way Settings takes the whole main pane with none either"), but the code renders the rail on
`/settings` and the SPEC backs the code ("the tickets page drops the right rail entirely" — only
tickets) — a stale comment, recorded here rather than filed as a bug since behavior follows the
SPEC. `docsInMain` is computed exactly for the ProjectHome case (project, no agent, not adopting,
not unknown), mirroring `renderMain`'s branch — the `view !== 'settings'` term is redundant
(settings always has `projectId === null`) but harmless.

## Functions (low-level)

- **`App()`** — everything below is inside it; hooks are called unconditionally in a stable
  order (no conditional hooks — the conditionality lives in `load: null` / ternaries). Correct.
- **`agentStart` state + `agentStarted(inProject, intent, startedId, runsOn)` (L70, L150-166)** —
  continuation detection compares both id and project; tick bump only for non-continuations
  (prevents the #762 transcript blanking); `runsOn` only kept when passed (a later plain start
  drops the previous `runsOn` — correct, the spread omits it); `setAdopting(startedId ===
  undefined)`; context reset; `go` (no-op when already there — relevant for continuations, whose
  URL is unchanged, so no history spam); `reload()` so the real row lands fast. Edge: `go` with
  `agentId: startedId ?? null` before the row exists is exactly what the `agentStart.id` check in
  `renderMain` covers. Correct.
- **context reset effect (L87-91)** — depends on `projectId` only; `resetContext` is stable
  enough in practice (fresh closure each render, deliberately excluded from deps). Runs on mount
  too (resets an empty set — harmless). Correct.
- **files poll (L97-102)** — `null` load when no project; deps `[projectId, agentId]` match the
  closure. Correct.
- **interventions/projects/activity/recents polls (L107-146)** — deps match closures
  (`[projectsKey]`, `[browserActivity]`, `[projectId]`); stable initials avoid churn. Note:
  bumping `projectsKey` resets `projects` to the empty initial until the re-read lands
  (keepPrevious is not set), so the sidebar's project list and any `unknownProject` verdict blank
  for a beat after "project added" — cosmetic flicker, noted not filed. Correct.
- **`unknownProject` (L126)** — requires a non-empty projects list before declaring a project
  unknown. Wrong discriminator: emptiness conflates "not read yet" with "read and there are no
  projects" (Bug 1). Verdict: **bug found**.
- **adopt effect (L173-181)** — fires whenever `adopting` with any running agent in the
  *currently routed* project; replace-navigation so no extra history entry. Not scoped to the
  project the fallback started in (Bug 2). Verdict: **bug found** (edge).
- **navigation helpers (L185-246)** — each clears `adopting` and pushes a route; `openTicket`/
  `openTicketPlan` carry slug/plan; `newAgentInProject` resets context explicitly. Correct.
- **stream ownership (L252-258)** — `useLiveEvents(projectId, agentId, agentStart.tick)` opened
  once here and handed to both panes; `currentAgentEvents` scopes the rail's views to the newest
  session segment while the feed keeps the whole journal — matches the SPEC's resume-appends
  intent. Correct.
- **`renderMain()` (L276-367)** — branch order analyzed above. The gone-agent branch renders only
  when `agentsLoaded && agentId !== agentStart.id` — so a bookmarked link never flashes "gone"
  during the first read, per SPEC. The finished/live branch derives `live` from
  `selectedAgent.status === 'running'` so the frame is never rebuilt across the transition
  (same `AgentView` element position either way). `remoteLabel` for the just-started case is
  gated on `agentId === agentStart.id` so a *different* not-yet-listed agent (list not read yet)
  does not borrow the started one's device label. Correct.
- **render tree (L369-435)** — daemon banner; `relative` on the workspace row (the #904
  sr-only/phantom-scrollbar fix) with the reasoning preserved in the comment; sidebar props wire
  the optimistic row (`startTick`/`startIntent`), follow flag, working mark, intervention count;
  `RightRail` gets `hasBrowser` only for a running agent with a `browserStreamPort`. Correct.

## Bugs found

1. `L126`: **With zero registered projects, a URL naming a project renders that ghost project's
   home instead of the "No such project" page.** `unknownProject` demands `projects.length > 0`,
   using non-emptiness as the proxy for "the projects have been read" — but on a machine with no
   projects registered the poll legitimately answers `[]`, the proxy never turns true, and
   `renderMain` falls through to `ProjectHome` for a project the daemon does not know (its reads
   fail or return nothing forever). The NotFound copy itself names the trigger — "the link may be
   from another machine" — which is precisely the fresh-machine, zero-project case. The SPEC pins
   the intent on read-completion ("only once the projects have actually been read"), and
   `usePolled` already exposes the `loaded` flag built for exactly this distinction (its doc cites
   the same #784 concern), which App.tsx uses for agents but not projects. Severity: minor.
   Fix: destructure `loaded` from the projects poll and gate on it — `projectId !== null &&
   projectsLoaded && !projects.some(...)` (add `keepPrevious` or drop `loaded`'s reset if the
   `projectsKey` bump would otherwise flash the home view for a beat).

2. `L173-L181`: **The adopt-follow can hijack a Back/Forward navigation into a different project.**
   `adopting` is cleared only by explicit selections (clicks); a popstate navigation does not
   clear it, and the adopt effect matches any running agent in whatever project the URL now names.
   Scenario: Start on a no-worktree project A (from Settings or Overview, `adopting = true`),
   then press Back before A's poll surfaces the running agent, landing on previously visited
   project B; B's agents load, one is running, and the effect replace-navigates to that agent —
   the user is bounced off B's launcher onto an unrelated agent page and the history entry they
   backed into is overwritten. The SPEC allows the one-agent inference only "in the no-worktree
   fallback" project where the daemon's busy guard makes it safe; in project B it is a guess.
   Severity: minor. Confidence: medium (needs the Back to happen inside the adoption window).
   Fix: store the project alongside the flag (`setAdopting` → `{ projectId: inProject }`) and
   have the effect (and the `renderMain` adopting branch) act only when the routed project
   matches, clearing the flag otherwise.
