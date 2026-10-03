Effort: 3
Uncertainty: 3

# [Plan] Project dropdown

Concrete plan to turn the single-pick project select of PR #1923 into a multi-select: what the pick becomes in the URL and in the shell, how the menu's rows behave, and what each surface does when several projects are picked.

## TLDR

PR #1923 (branch `project-dropdown`, open, not merged when this plan was written) already made the calls the previous plan left open: the pick lives in the URL as `?project=<id>`, it filters and never navigates, and the Tickets page's own project facet is gone. What is left is widening one id to a set:

- `Route.scope?: string` becomes `Route.scope?: string[]` (`dashboard/lib/route.ts`), still one `project` parameter, ids joined by commas. Absent or empty = all projects.
- `ProjectSelect` gets a checkbox per project: the checkbox toggles the project in the set and keeps the menu open; the rest of the row picks that project alone and closes. "All projects" clears the set.
- Every consumer that compares `=== scope` compares against the set. Consumers that need *one* project (the "New agent" button, the sidebar's per-project agents poll, the tab title, the launcher's open questions) use it only when exactly one is picked, and fall back to their "all projects" behaviour otherwise.
- One server change: `onRecentAgents` takes the picked ids, because the pooled list is cut to `RECENT_RUNS_LIMIT` before the browser could filter it.

**Prerequisite**: PR #1923 is merged. Every path below is as on its branch; do not start from `main` without it.

## Problems

1. **What "the picked project" means for code that needs exactly one — uncertainty 3.** #1923 leans on a single id in several places: `go` forces `scope` to the page's own project (`App.tsx:95`), `parseRoute`/`formatRoute` collapse the scope to the path's project (`route.ts:69,74-75`), `selectScope` moves you off another project's page (`App.tsx:101-108`), `useAgents(projectId ?? scope)` fills the sidebar (`App.tsx:119`), `NewButton` starts in `scope` (`AgentHistory.tsx:430-431`), the tab title names it (`App.tsx:156`).
2. **The pooled recents are capped on the server — uncertainty 2.** `buildRecentAgents` (`src/dashboard/overview.ts:79-92`) sorts all projects' agents and slices to `RECENT_RUNS_LIMIT`. Filtering that list in the browser for two quiet projects next to a busy one shows few or no rows.
3. **Two click targets in one menu row — uncertainty 3.** `DropdownMenuCheckboxItem` makes the whole row the checkbox (`ui/dropdown-menu.tsx:69-77`); the ticket wants the checkbox to toggle and the rest of the row to pick only that project.
4. **Selected projects on top — uncertainty 1.** Sorting on every toggle moves rows under the cursor while the menu is open.

## Solutions

1. **One rule: a set of ids; "single pick" is the set of size one.** Derive in `App.tsx`: `scope: string[]` (registered ids only, in registry order; empty = all) and `onlyProject = scope.length === 1 ? scope[0] : null`.
   - *A project's own pages*: the rule of #1923 ("the pick is that project or none, never another") becomes "the pick contains that project, or is empty". `parseRoute`/`formatRoute`/`go`: when a scope is set and the path's project is not in it, the scope becomes that project alone (same as today's collapse); when it is in it, the set is kept as is.
   - *`selectScope(next: string[])`*: empty → keep the page (today's `null` branch). On a project's page whose project is not in `next`: its launcher becomes the launcher of `next[0]` when `next` has one id, else the Overview; its agent's page becomes the Overview. A module's page drops `pagePath` as today.
   - *Sidebar agents*: `useAgents(projectId ?? onlyProject)`; the pooled recents are polled whenever `onlyProject === null`, and filtered to the set (Solution 2). `AgentHistory`'s `crossProject` becomes `onlyProject === null && recentAgents !== undefined`.
   - *`NewButton`*: one picked → start there. Several picked → the existing picker, listing only the picked projects. None picked → as today.
   - *Tab title*: the selected project's name, else the single picked project's name, else nothing.
   - Alternative rejected: a second "primary project" among the picked ones, to keep single-project consumers fed. It adds a concept the ticket does not ask for.
2. **`onRecentAgents(projectIds?: string[])`** (`src/dashboard-rpc/reads.ts:227`): filter the registered projects to the ids before `buildRecentAgents`, so the cap applies to the picked projects' runs. The shell passes the set (and nothing when it is empty) and keys the poll on it. Alternative rejected: one `onAgents` poll per picked project merged in the browser; N polls every 2 seconds and a second merge rule next to the server's de-duplication (#1648).
3. **Stay on `DropdownMenu`, with a checkbox inside a plain `DropdownMenuItem`.** The row is a `DropdownMenuItem` (`onClick` = pick only this project, closes). Its leading `Checkbox` (`ui/checkbox.tsx`) stops the click's propagation, toggles the project, and the menu stays open. Keeps #1923's trigger, width, error lines and "Add project" row untouched. Verify in the browser that Base UI's `Menu.Item` does not close on a click whose propagation was stopped inside it and that Space on the focused checkbox toggles; if either fails, fall back to `Popover` + rows modelled on `OptionRow` (`skill-tickets/dashboard/TicketFilterBar.tsx:50-72`), which costs the menu's keyboard navigation and so is second choice.
4. **Order computed when the menu opens**: `onOpenChange(true)` snapshots "picked first, then the rest, each in registry order" into state; toggles do not re-sort until the next open.

## Considerations

- **URL shape**: `?project=a,b`. Project ids are `<slug>-<base36 hash>` (`route.ts:19-20`), so a comma never occurs in one; a single id reads exactly as #1923's links do. `keepPageQuery` already deletes and re-adds the one parameter, no change. Write the ids in registry order so the same set is always the same URL (going where you already are adds no history entry, `use-route.ts:45-46`).
- **Empty set = all**: unchecking the last picked project returns to "All projects"; there is never a "nothing shown" state. Checking every project one by one is kept as an explicit set, not folded into "all": a project added later should not appear in a view the user built by hand.
- **Unregistered ids** are dropped from the set once the projects are read (today's rule for the single id, `App.tsx:90`); a set left empty by that is "all".
- **Trigger label**: "All projects" with the stack icon; one picked → its dot and name (as today); several → "N projects" with the stack icon, and a red dot when any picked project has errors. Accessible name `Project: <name>` / `Project: N projects` / `Project: All projects`.
- **"All projects" row**: a checkbox that is checked exactly when the set is empty; clicking the row or its checkbox clears the set. It stays first, above the ordering of Solution 4.
- **Tooltips** (`ui/tooltip.tsx`; tests use `hoverTooltip`, `test-utils.ts:10`): checkbox, "Also show <name>" / "Stop showing <name>"; row, "Show only <name>"; "All projects", "Show every project"; trigger with several picked, the picked names. #1923 puts the daemon's error message in a `title` on the error line; leave it.
- **Consumers to widen** (each is a `=== scope` today):
  - `App.tsx:91` `scopedProjects`, `:155` interventions (badge, Overview card, tab title count).
  - `DashboardPage.tsx:54-55` agents at work and the packages' cards.
  - `OpenQuestions.tsx:40-46,59` `projectId: string | null` → `projectIds: string[]`; `ProjectHome.tsx:72` passes the set.
  - `AgentHistory.tsx` props `scope`/`onScope`, the `[scope]` effect at `:151` (key it on the joined ids), `onSelect` at `App.tsx:443` (`onlyProject ?? projectId`).
  - Modules need nothing: a module's page is handed `scopedProjects` (`App.tsx:315`), so Tickets, Queue and Logs follow.
- **Not filtered**, unchanged from #1923: the usage bar, Settings, notifications, the tab icon.
- **Left from #1923, worth taking here**: the Tickets page still says "Every project's backlog" and "No project has the tickets package" with a pick; reword both to say "the picked projects" when the page is handed fewer projects than are registered. Skip if it needs a new prop through the module API.
- **`only-if-quick-win`**: with #1923 merged this is one type widened through about eight files plus one menu; it fits the label. If Solution 3's fallback to `Popover` is needed, it stops being quick: say so in the pull request rather than shipping half the click behaviour.
- **LOGIC.md**: read the `logic-driven-development` skill first. `ProjectSelect.LOGIC.md` (glossary [1] "picked project" → "picked projects", the menu, a pick), `App.LOGIC.md` ([21], "The picked project filters every page", the polls list), `AgentHistory.LOGIC.md`, `route.LOGIC.md`, `OpenQuestions.LOGIC.md`, `DashboardPage.LOGIC.md`, `ProjectHome.LOGIC.md`, and the `*.test.LOGIC.md` beside each changed test.

## Implementation

1. **Route** (`lib/route.ts`, `route.test.ts`): `scope?: string[]`; parse `project` by splitting on commas and dropping empties; format joined; own-page rule per Solution 1. Tests: one id round-trips as before, several round-trip, a project's page with a set that contains it keeps the set, one that does not collapses to that project.
2. **Server** (`src/dashboard-rpc/reads.ts`, its test): `onRecentAgents(projectIds?)`.
3. **Shell** (`App.tsx`, `App.test.tsx`): `scope: string[]`, `onlyProject`, `scopedProjects`, `go`, `selectScope`, `useAgents`, the recents poll with the ids, interventions, title, `homeHref`. Tests: two picked filters badge, Overview and module projects together; picking a set that leaves the current project's launcher / agent page lands as Solution 1 says; an unregistered id in a set is dropped.
4. **Select** (`components/ProjectSelect.tsx`, new `ProjectSelect.test.tsx` + `.test.LOGIC.md`; #1923 tests it only through `AgentHistory.test.tsx`): props `scope: string[]`, `onScope(next: string[])`; checkbox rows, All row, order on open, trigger label, tooltips. Tests: checkbox adds and removes and the menu stays open; row picks only that one and closes; unchecking the last reports the empty set; All clears; order is fixed while open and picked-first on the next open; each tooltip.
5. **Sidebar** (`AgentHistory.tsx`, its test): prop types, `crossProject`, `NewButton` with the picked projects in its picker.
6. **Pages** (`DashboardPage.tsx`, `OpenQuestions.tsx` + test, `ProjectHome.tsx`): set membership instead of equality.
7. **Tickets wording** (`packages/skill-tickets/dashboard/TicketsPage.tsx`), if it stays inside the module's current props.
8. **LOGIC.md** files as listed, then root build, typecheck and tests over all packages; by hand in the browser with three projects: toggle two, row-click one, All, reload, Back, a copied link, "New agent" with two picked.
