Effort: 8
Uncertainty: 7
# [Plan] Dashboard architecture

The implementation roadmap for #1768: a dashboard with no built-in skill pages, where the installed skills fill its slots. The design questions and their answers are in #1774 (ticket `2026-09-09_dashboard-architecture-plan.md`). This plan does not ask them again.

## TLDR

The design is decided. Only the contract is still open.

- A skill's widget ships in the skill's own package, on its own export path (#1774 Q1).
- The framework and the dashboard know no skill by name (Q2, capabilities).
- No skill knows another skill. Features that need two skills are the dashboard combining generic pieces: links, agent ids, actions (Q3).
- The dashboard reserves no route and no nav row. Each widget defines its own route, card and actions (Q4).
- A live run belongs to the framework. A finished run belongs to whichever skill keeps records, with no fallback archive (Q5).
- The order is daemon first, UI second (Q6). The daemon half is merged (#1777, #1778).

What is left is the dashboard half, which has four parts:

- the **slot contract**;
- **discovery**, meaning how the dashboard finds widgets;
- the **data path** for a widget;
- moving the four skills in, one PR each, **logs first**.

Before any of that, one human question needs an answer. Rom's 09-14 goal is "remove the daemon; the dashboard is a projection of files". That goal decides the data path, so it should be answered before step 1.

## Where main is (2026-09-15, 51a34ef8)

- The dashboard is still one React app in `packages/framework/dashboard/`.
  - `lib/route.ts:30` reserves `tickets`.
  - `App.tsx` (446 lines) holds the shell and the routes.
  - The sidebar rows are hand-written in `components/AgentHistory.tsx`.
  - The Overview is `components/DashboardPage.tsx`: seven sections in a fixed order.
- `packages/framework/package.json:50-54` depends on `@gemstack/routines` and all four skill packages. The build scripts build each skill package by name (`:36-43`).
- 23 non-test framework files still import a skill package. On the daemon side: `daemon-runtime.ts`, `daemon-services.ts`, `cli.ts`, `store/*`, `worktrees.ts`, `tickets.ts`. On the dashboard side: `src/dashboard-rpc/{reads,control,events}.ts`, `src/dashboard/{overview,tickets,interventions,docs,agent-handoff}.ts`, `dashboard/lib/agent-label.ts`.
- The tickets, queue, logs and work-queue SKILL.md files are tracked under `.agents/skills/` (#1778). So there is something to discover.
- The skill packages have no dashboard export yet. For example, `skill-logs` exports only `.` (its library) and `bin/logs`.
- `packages/framework-dashboard/` is an empty leftover directory with no tracked files. Delete it in the first PR.

## Problems (low confidence)

1. **Does the daemon survive? (uncertainty 8)**
   - Today every read reaches the browser through daemon RPCs (`rpc-serve.ts`, `reads.ts`, `control.ts`).
   - If the daemon goes, each widget needs a different data source, for example reading the `agent-data` branch through a small local server or the skill's own command.
   - If the daemon stays, widgets need a server-side hook in the daemon.
   - Building the slot contract before this is answered risks rebuilding it.
2. **How widgets reach the bundle (uncertainty 7).**
   - Vite needs imports at build time.
   - Discovery is per project and happens at runtime: which SKILL.md files the project tracks.
   - A third-party skill cannot be in the framework's build.
3. **The slot contract (uncertainty 6).** What a widget may use:
   - the RPC transport (or what replaces it);
   - navigation;
   - the UI primitives in `dashboard/components/ui/`;
   - the project list;
   - agent-id links.

   If the contract is too small, pages cannot be ported. If it is too big, the whole framework becomes the API.
4. **Discovery key (uncertainty 5).** Q6 step 1 says a SKILL.md names its package in its command line (`npx auto-package-manager <pkg>^N <cmd>`). The package's `exports["./dashboard"]` is then the widget. Open points:
   - That command-line form is not in the tracked SKILL.md files yet.
   - Behaviour when the package is not installed in the project is undefined.
5. **Cross-skill joins (uncertainty 6).** These combine data from more than one skill today:
   - `overview.ts` `buildOverview`, `buildHotTickets`;
   - `dashboard.ts` `buildDashboard`;
   - `tickets.ts` `resolveHolders`;
   - `interventions.ts` (unpushed runs from the records);
   - `control.ts` queue-a-ticket.

   Q3 says each becomes generic slots, but the generic shape of each is not designed. The hot-tickets card has two options: framework-owned, or split into a tickets card and a queue card.

## Solutions

- **Problem 1**
  - (a) Ask Rom/Suleiman first; this is the recommended option.
  - (b) Shortcut: design the widget's data access as "read files on `agent-data` through the shared branch library", behind one function the widget is handed. The daemon RPC and a daemon-less reader then both fit behind it.
- **Problem 2**
  - (a) Build-time plugin discovery. A Vite plugin reads the widget exports of the installed packages and generates `skills.generated.ts`. At runtime, entries are hidden per project by the tracked SKILL.md files. First-party only; this is the recommended option now.
  - (b) Runtime ESM loading. The server serves each package's prebuilt `dashboard` bundle, loaded with `import()`, with React shared through an import map. This allows third-party skills, but costs a build step per skill and version skew.
  - (c) Microfrontend via iframe per page. Strong isolation, poor UX. Reject.
- **Problem 3**
  - Derive the contract from porting logs, the smallest surface: the `/logs` (or `/agents`) page, the agents card and the sidebar's recorded rows.
  - Freeze it only after tickets, the largest surface, has also been ported.
- **Problem 4**
  - (a) Add the package line to the SKILL.md files (Q6 step 1, still owed).
  - (b) Shortcut: map the skill directory's `source.json` (from use-npm-skills) to the package name.
- **Problem 5**
  - Three generic slots:
    - `linkActions(link)`: queue fills "Add to queue" on ticket links.
    - `agentLink(agentId)`: the records widget fills it.
    - `cards`.
  - The hot tickets split into a tickets card and a queue card. The "working now" lane uses the lock holder as an agent id.

## Considerations

- There are zero users and no compatibility is needed: move pages, don't dual-path them (AGENTS.md).
- A project with no SKILL.md for a skill loses that skill's page, cards and actions. The union across projects drives the sidebar and the Overview; each project's own set drives its pages.
- A widget must name only its own skill. The dashboard must name none, including in empty states: say "no records skill", not "install @gemstack/skill-logs".
- When a skill's SKILL.md is removed but its package is still installed, the widget must be hidden. The #1774 experiment shows agents still find the command, so the dashboard should key on the SKILL.md, not on the package.
- React must be a peer or optional dependency of the skill package, so the agent-side CLI install does not pull in a UI stack. Watch the package size.
- Remove `route.ts`'s reserved segment. Route collisions between two widgets need a rule: first wins plus a console error, or refuse to mount.
- Tests: the dashboard's vitest suites for the tickets pages move with them. The daemon tests for `reads.ts` and `control.ts` shrink.
- Onboarding checklist steps that name the queue or tickets (`OnboardingChecklist.tsx:140-156`) become widget contributions or go.
- The design gallery (`dashboard/design/`) needs a line for each moved card.
- LOGIC.md files are regenerated or edited per the `logic-driven-development` skill in each PR. FEATURES-SPEC.md is gone on main, so AGENTS.md's rule about it is stale.
- The Rom slop rules apply: every PR shows its own proof on the rig (screenshots with and without the skill), and the pick is pinged only when finished.

## Implementation

0. **Human question (blocker).** Does the daemon stay as the dashboard's server? Post it on #1774 as a short 🤖-marked question with options 1(a) and 1(b). Pick before step 1.
1. **Slot shell PR.**
   - `dashboard/skills/registry.ts` holds the types: `route`, `navRow`, `card`, `linkActions`, `agentLink`, `runActions`.
   - Generated `skills.generated.ts` from a Vite plugin (2a).
   - The shell, the sidebar and the Overview render from the registry. `route.ts` reserves nothing.
   - Discovery: a daemon read of tracked `.agents/skills/*/SKILL.md` per project, on `ProjectSummary`, with the package from 4(a) or 4(b).
   - Delete `packages/framework-dashboard/`.
   - No skill moves yet; the four existing surfaces are temporarily registered from inside the framework, labelled temporary.
2. **Logs.**
   - `@gemstack/skill-logs` gains `exports["./dashboard"]`: the `/logs` page (every run, filters by branch and work link), the agents card, and `agentLink`.
   - The framework's runs list in the sidebar shows only live runs; recorded rows come from the widget.
   - Proof on the rig: a project without the logs SKILL.md shows no page, no card, and "no record of this agent" on a finished run.
3. **Tickets.**
   - Move `TicketsPage`, `TicketDetailPage`, `TicketPlanPage`, `TicketsPanel`, `TicketFilterBar`, `HotTickets` (tickets half) and `lib/ticket-filter.ts` into the `skill-tickets` package's dashboard export.
   - The Queue buttons leave these pages (they come back in step 4).
   - The holder becomes `agentLink(holder)`.
   - The reads in `src/dashboard/tickets.ts` and the `reads.ts` entries move behind the widget's data function.
4. **Queue.**
   - The AI Queue card, the queue half of hot tickets, and `linkActions` "Add to queue".
   - The Docs panel's queue file and `docs.ts:57` move here.
5. **Branches.** The run page's branch controls (`AgentHandoff`, `AgentActionsMenu`, `GitStatusBar`) become `runActions` from the branches widget.
6. **Cleanup.**
   - The framework's `package.json` drops the four skill dependencies and the per-skill build steps, once the daemon half's remaining imports (#1777's list: the rotation, checkout, record) are gone too.
   - Check with `grep -r '@gemstack/skill-' packages/framework/{src,dashboard}`; it should come back empty.

Each step is one PR, proven on the dogfood rig with the skill present and absent. Steps 2 to 5 depend on step 1, and are best run one after another, because the contract evolves as each one lands.
