The left Runs rail (#314 second sidebar) as the shadcn Sidebar: app chrome (brand, New, Overview, Tickets, Projects nav, footer utilities) plus the recent-sessions list, one component on every route.

## TLDR

- Shared shell: rendered on home/Overview and session pages alike, so the left column never vanishes when no project is selected; with the top navbar removed (#772 follow-up) the sidebar carries brand (`BrandLink`, animating while `working`), theme toggle, notifications, connection indicator and Settings in the footer.
- Two row sources: a selected project's own `runs`, or — on the Overview (`projectId === null` with `recentRuns` given) — every project's sessions pooled newest-first, each row naming its project and jumping in via `onSelectRecent`.
- `NewButton` is project-count aware: in a project (or exactly one project) starts there; zero projects opens AddProjectPanel (nowhere to run); several opens a picker dropdown — same label+Plus in every case.
- Optimistic start row: `startTick`/`startIntent` seed a dim "starting…" running row the instant Start is clicked, cleared when a real running run lands, the project changes, or a 20s deadline passes (a failed start otherwise said "starting…" forever, #948).
- Highlight logic: URL-selected run id (#784); `followLive` highlights the newest running run only (#738); a selected id not yet in the list highlights the optimistic stand-in (#784/#705).
- `RunRow` badges: pulsing dot + running; still dot + "waiting" when `settledAt` set on a live run (#785, parked on the user); "in cloud" for a done `web` run (#1263/#1264 — its local process ends at hand-off by design, the cloud side keeps working); device glyph for `target === 'remote'` (#1067); agent logo via `agentForDriver` carries the accessible name.
- Nav items: `OverviewButton` (Human Queue count badge, #632), `TicketsButton` (#1144, offered only when `onTickets` given — the relay has nothing to route it to), `ProjectsNav` (expandable indented list, not a dropdown; activated-dot per project; Add project).

## Decisions

- Exactly one nav item is ever active: New carries the fill only on a project's launcher (`projectId !== null && selectedRunId === null && !followLive`), Overview only when `projectId === null && !ticketsActive`, Tickets via `ticketsActive` — Overview and Tickets both live at `projectId === null` so the flag disambiguates.
- A finished `web` run reads "in cloud", not "done" — `done` is about this machine, not the session (#1264); a stopped web run is just stopped.
- Run title fade/marquee (`rail-title` / `is-overflowing`) is measured in JS (`scrollWidth > clientWidth`) since CSS can't tell overflow; short titles show plainly.
- Sticky "Recent sessions" label with a scroll-fade gradient strip; label shown even for an empty list so "No sessions yet." reads as the list's state (#1147).

## Facts

- `collapsible="none"`: a fixed-width in-flow column — the bespoke collapsing aside of #862 is gone.
- Rows use the themed `ScrollArea` (#913) with `pr-3` clearing the overlaid scrollbar; `stale settledAt` never relabels a terminal status (only `status === 'running'` can read "waiting").
