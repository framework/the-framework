All React components of the framework dashboard: the shared-shell chrome, the Overview cards, the launcher/composer, the session (run) view, the right-rail panels, tickets, settings, and the UI/vendored primitive layers beneath them — nearly every `X.tsx` paired with an `X.test.tsx` vitest+testing-library suite.

## TLDR

- Shell & chrome: `RunHistory` (the left shadcn Sidebar: brand, New, Overview/Tickets/Projects nav, pooled recent sessions, footer utilities), `BrandLink`, `Logo` (hexknot mark, animates while working), `ConnectionIndicator` (which daemon, by origin), `ThemeToggle`, `NotificationsMenu` (bell: delivery methods vs categories), `ErrorBoundary` (#1194 — no more white blank screen), `NotFound`.
- Overview (`DashboardPage`, #1139): at-a-glance cards — `Quota` (one week-long usage track, #960), `Agents` (sessions working now), `AiQueue` (every project's TODO_AGENTS.md), `RoutineWork` (auto-PM jobs + Run now + schedule controls), `HotTickets`, `ActivityChart`, `RunOutcomes`, `OnboardingChecklist`.
- Launcher (project home): `ProjectHome` (never consumed by a run), `StartRunForm` (the one `startRun` write + trust preflight), `Composer` (shared editor + control row; presets prefill and run verbatim), `PromptEditor` + `prompt-editor/` (TipTap chips/suggestions), `PresetsMenu`, `PresetCreatePanel`, `OptionsMenu` (global run options), `AgentModelMenu` (agent→model tree so incompatible pairs can't be picked), `ContextMenu`/`ContextFiles` (run Context set), `ResolvedOptions` (chips of what will actually run, repo-tier marked), `SystemPromptDisclosure` (the real composed prompt).
- Session view: `RunView` (stable frame, live→archived swap), `RunActionBar` (+`GitStatusBar`, `SessionActionsMenu` ⋮, `SessionDetails` spend strip), `RunFeed` (`RunOverview` + `EventList`), `RunChanges` (live worktree diff), `RunHandoff` (arm/summary/actions/details), `RunComposer` (message / resume / new run), target notices (`ActionsRunNotice` #1053, `CloudRunNotice` #610, `RemoteRunNotice` #1067), `RelayView` (read-only shared watch).
- Right rail: `RightRail` (content-earned tabs, #1146) hosting `FileTree` (context picker over animate-ui), `ChoicesRail`/`ChoicePanel` (interactive gates), `ViewsRail` (agent-pushed markdown), `BrowserPanel` (preview screencast), `DocsPanel` (PLAN/TODO), `ProjectLogPanel` (LOGS.md), `LoopStatusCard` pinned beneath.
- Tickets (#1144): `TicketsPage` (cross-project sections) → `TicketsPanel` (one-liner rows + Import/Update-from-GitHub presets) → `TicketDetailPage` (full markdown + Queue).
- Settings & devices: `SettingsPage` (global tier, shared run-option table), `DevicesSettings`/`AddDeviceDialog` (#1052 remote daemons; token stays in localStorage), `DiscordDialogs`, `BridgeSettings`.
- Workspace plumbing: `WorkspaceActions`/`ProjectActions` (GitHub/folder/editor/Serve for project or worktree), `PreviewBar` (Serve #475), `AddProjectPanel`, `DiffView`/`FilePreview` (#816 one diff rendering everywhere), `Markdown` (dependency-free, React-node-building — agent content can't smuggle HTML), `DisclosureToggle`, `agent-logos`.
- Subdirectories: `ui/` (shadcn-style primitives on Base UI — button, dropdown, tooltip, sidebar, scroll-area…), `animate-ui/` (vendored animate-ui file-tree/highlight primitives), `prompt-editor/` (TipTap token + suggestion internals).

## Decisions

- Data flow is Telefunc-only: `on*` reads and `send*` writes from `../server/*.telefunc.js`, wrapped by tiny lib hooks (`usePolled`/`useLoaded`/`useAction`/`useStartRun`); components either poll their own reads or fold the live event stream (`@gemstack/the-framework/client` projections like `loopStatus`, `sessionInfo`, `handoffState`) — no client-side store beyond shell-owned props.
- Constants and prompts (presets, `AUTO_PM_ROUTINES`, agent labels, `composeRunSystem`, `runOptionsFromPreferences`) are imported from the browser-safe `@gemstack/the-framework/client` entry so screen and daemon cannot drift — never restated in the dashboard.
- Empty states must earn their surface: tabs/rails/panels render nothing rather than "nothing yet" (#1146), dead ends say why (#1173), and unavailable capabilities are shown disabled with their reason rather than hidden.
- Optimistic-until-echoed is the pattern for control writes that round-trip through files the run tails (HandoffArm `pending`, RunHistory "starting…" row with a 20s deadline, SessionActionsMenu `stopRequested`).
- Comments carry issue numbers (`#123`) as design rationale; specs and tests cite them — the test suites pin UX decisions (wording, ordering, who navigates) as much as logic.

## Facts

- Test convention: mocks stop at the module boundary — an unmocked `*.telefunc.js` anywhere in the import graph fails in jsdom as an `assertIsNotBrowser` "telefunc bug"; tooltips need no provider (zero delay since #1149); shadcn Sidebar renders need `SidebarProvider`.
- Preferences are tiered (global / per-project / repo `the-framework.yml`): `usePreferences`/`updatePreferences` scope by the URL's project; `/settings` writes the global tier; `ResolvedOptions` marks repo-tier values.
- Run `target` vocabulary crosses many components: `local | actions | remote | web`, each with its own notice/affordance rules (no browser tab on actions, "in cloud" not "done" for web, device glyph for remote).
- `useLoaded`/`usePolled` compare initial values by identity — shared `EMPTY`/`NO_*` module constants exist to avoid re-fetch loops from fresh literals.
