The whole dashboard shell (#405 phase 2): a single URL-driven page composing the sidebar (RunHistory), the main pane (Overview / project home / session view / Settings / Tickets), and the RightRail, owning all shared polls and the live event feed.

## TLDR

- The selection IS the URL (#784): `/` = Overview (#471), `/{projectId}` = project home/launcher, `/{projectId}/{sessionId}` = one session; `view` extends this to `settings` (#958) and `tickets` (#1144, with an optional per-ticket detail route keyed by project + slug). Navigation is `useRoute()`'s `go()`.
- Owns the shared reads: `useRuns(projectId)`; project files polled every 10s scoped to the selected session's worktree (#815); cross-project interventions ("needs you" open-PR queue, #632) polled every 15s feeding sidebar badge + Overview card + notifications; one-shot projects list (reloadable via key bump) driving `document.title` (#695/U3); cross-project recent runs polled only on the Overview; activity feed polled only while both the "new activity" category and browser notifications are enabled (#627).
- One live feed: `useLiveEvents(projectId, runId, tick)` — a shared Telefunc Channel read by both the main view and the right rail's choice gates (#440); `pendingChoices`/`agentViews` derive from `currentRunEvents(events)` — the rail stays scoped to the newest `session` segment even though a run's feed no longer is (a resumed session appends a second segment to the same journal, and a gate the stopped segment left unanswered belongs to a process that is gone); the loop verdict comes up from RunView via `onLoopStatus` (a finished run's events live in its archived log, which that view reads).
- Optimistic run start: `runStart {tick, intent, id, runsOn}` — the daemon-allocated id (#761) lets the URL point at a session before its `run.json` exists; `runsOn` names the device for remote runs (#1067). Projects without a git checkout hand back no id, so `adopting` follows the live output and adopts the running run once the poll surfaces it (that fallback is one-run-at-a-time — daemon.ts keys the busy guard by project — so "the running one" is a safe guess).
- Relay mode (#426): `?run=<id>` renders `RelayView` read-only (no local registry/files); resolved from `window`, absent during prerender, so the build emits the full shell.
- `useDaemonHealth` banner (#948): without it a dead daemon froze every surface silently — channels retry their transport without a verdict and polls keep their last value, so "agent went quiet" and "nothing is live" looked identical.
- The run Context set lives here (#492/#504) so the Start form's `#` chips and the right-rail file tree share one source of truth; reset on project change (keyed off the route — Back/Forward change projects too) and after each launch (#948).
- `useWorking`/`useFavicon` (#875) drive the mark and tab icon; both off on the relay (RelayView owns them from its one feed).

## Decisions

- Live and finished sessions render the same `RunView` (#1026): only the `live` flag flips, so a run ending swaps what the bar/feed/composer say without remounting them.
- Every explicit selection (`selectRun`, `selectProject`, …) cancels `adopting`; the adoption itself navigates with `{replace: true}` — a correction, not a history step.
- "This session is gone" only renders when the runs list actually loaded and the id is not the just-started one — a fresh run's row lands a beat later, and both cases must show live views, not NotFound.
- Unknown project (renamed/removed/mistyped URL) checks `projects.length > 0` first, so it never fires while the one-shot read is still out.
- Tickets takes the full main width — no RightRail (#1144) — like Settings takes the whole pane; the top navbar is gone (#772 follow-up), its brand/nav/utility controls now in the sidebar.
- Stable module-level `EMPTY_*` constants keep the polled values' identities from churning per render.
- `runStarted(inProject, …)` takes the project explicitly because the onboarding checklist starts runs from the Overview and Settings, where nothing is selected (#1169); `selectRunInProject` exists so cross-project rows land on the session, not the launcher.

## Facts

- `relative` on the workspace row is load-bearing (#904): `overflow-hidden` only clips descendants it is the containing block for, and Tailwind's `.sr-only` is `position:absolute` — without it those labels resolve against the initial containing block and give the document a phantom scrollbar that slides the whole app off-screen.
- The workspace row is fixed-height; each column scrolls internally, the row itself never scrolls.
- The whole shell sits inside `SidebarProvider` so sidebar context (state, Cmd/Ctrl+B, `--sidebar-width`) exists on every route.
- The pre-#784 design — three reconciled state pieces (selected run, just-started run, follow-live flag) — produced #761/#766/#768/#774, each a case where they disagreed about which run was in play; a route cannot disagree with itself, and it made sessions linkable/bookmarkable (subsuming remembered-project #475).

## Flows

- start run: child form → `runStarted(project, intent, id?, runsOn?)` → bump `runStart.tick` (optimistic "starting…" rail row with the typed prompt) → `resetContext()` → `go({projectId, runId})` (real history entry) → `reload()` runs. EXCEPT a continuation of the run already on screen (#762): it appends to the same journal — nothing truncates, so nothing would re-replay after a reset — and bumping the tick blanked the transcript the moment a message resumed an ended session; the tick holds, everything else still runs.
- no-id fallback: `adopting=true` → land on project → runs poll surfaces `status==='running'` → `go({projectId, runId}, {replace:true})`.
- render main: relay early-return → settings → ticket detail → tickets list → Overview (no project) → NotFound (unknown project) → adopting live RunView | ProjectHome (`runId===null`) → live RunView (just-started or list not loaded) | NotFound (gone) → RunView with `live = status==='running'`.
- delete session: RunView `onDeleted` → `selectRun(null)` + `reload()` so the stale row disappears (#1032).
