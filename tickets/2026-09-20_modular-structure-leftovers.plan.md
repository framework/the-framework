Effort: 7
Uncertainty: 4
Outdated: yes

# [Plan] Modular structure: what the four module PRs left behind

How to work the leftovers list of #1812, #1813, #1815 and #1817: five pull requests, in order, with the two open design questions decided here and the three items that belong to another ticket handed over.

## TLDR

The ticket is a list, not a task. This plan turns it into five pull requests, smallest risk first:

1. **The root build** — `pnpm build` builds every package the daemon runs. Cheap, and #1817's CI already failed without it.
2. **The #1817 regressions** — the session name in labels and pull request titles, the pull request's base, the sweep's widened branch rule. Three small fixes, one pull request.
3. **The Overview-card slot** — a widget may declare a card; the Overview draws the cards the installed packages declare. This is the piece everything else waits on.
4. **The two cards move** — the AI Queue card into the queue package, the hot tickets card into the tickets package; the framework's lane rules and their daemon reads go with them.
5. **The rest of housekeeping** — the skill copies, `lib/preferences.ts`, the Human Queue's unpushed rows, `FEATURES-SPEC.md`.

Decided here, so the build does not stop to ask: the clean rule stays the package's and the run page says so in words a person can act on; the queue keeps no memory of which entry is a plan ask, so a plan ask may be queued twice; "Plan truncated" does not come back.

Handed over, not planned here: the launcher's removed options and the browser belong to #1819, the forge questions to #1820, and Discord waits for both.

## Problems

Where the work has real alternatives, with why.

### P1. The Overview-card slot has to give a card what a page gets, without being a page

A widget page is mounted in the main pane with its projects, its sub-path, its host and a boundary (`dashboard/components/WidgetPageView.tsx`). A card has no URL and no sub-path, but needs everything else: its package's commands, the shell's navigation, the project list. Uncertainty 2 — the shape is nearly forced by what already exists.

### P2. Both cards poll every project, and moving them turns one daemon read into N commands

Today the Overview makes one read of the daemon per card: `onHotTickets` pools at most 60 tickets across every project every 10 seconds (`src/dashboard/overview.ts`), and the queue arrives in the same five-second board read (`src/dashboard/dashboard.ts`). A widget card has only `runCommand(projectId, …)`: one child process per project per poll, and the hot tickets card also needs `agents(projectId)` per project for its "in progress" lane. Five projects at 10 seconds is ten processes every ten seconds, where there was one read. Uncertainty 5 — this is the one place where the modular structure genuinely costs something, and the answer is a trade, not a derivation.

### P3. The fan-out cannot use the host's start

The AI Queue card starts one agent per top entry, one after another, **with no navigation** (`AiQueue.LOGIC.md`). The host's `startRun` lands the dashboard on the run it started (`App.tsx:225`, `agentStarted`). A fan-out through it would jump the user to the first agent and then start four more behind their back. Uncertainty 1 — the service needs one option; the only question is its name.

### P4. Open PR on a stopped run whose checkout is dirty

Before #1817 the dashboard pushed the commits anyway and left the uncommitted work alone. Now `publish` refuses over an unclean tree and the run page's bar shows the refusal. Whether that is a regression or the rule finally being right is a judgment call. Uncertainty 6 — see S4 for the decision and why.

### P5. `FEATURES-SPEC.md` does not exist, and AGENTS.md says every feature is listed there

Either the file gets written or the rule goes. Writing it means an inventory of every user-facing feature of the dashboard, the launcher, the four packages and the scheduler — days, not hours, and stale the week after unless something keeps it. Uncertainty 6.

## Solutions

### S1. The card slot (P1)

Add to `dashboard/widget/index.ts`, beside `pages` and `linkActions`:

```ts
export interface WidgetCardProps {
  /** The registered projects whose dependencies include the widget's package, in the registry's order. */
  projects: WidgetProject[]
}

export interface WidgetCard {
  /** Which card this is, for the shell's key and its tests; never shown. */
  id: string
  /** Its place among every installed package's cards on the Overview, lower first; 50 when unsaid, ties by package name. */
  order?: number
  Card: ComponentType<WidgetCardProps>
}
```

`WidgetDefinition` gains `cards?: WidgetCard[]`. `lib/use-widgets.ts` collects them exactly as it collects pages, each carrying its package and the projects that have it. The "render a widget's thing inside its host and a boundary" wrapper is factored out of `WidgetPageView.tsx` into one `WidgetSlot` that both the page view and the card use, so a broken card breaks only its card.

`DashboardPage.tsx` draws the declared cards in the right column, under "Agents", sorted by `order` then package name. A project with no package that declares a card sees no card there — which is the point: today the Overview draws "Nothing queued." for a project that has no queue package at all.

Order values: the AI Queue card takes 10, the hot tickets card 20. Numbers, not a list the framework keeps, so a third package can sit between them without the framework knowing it exists.

### S2. The polling cost (P2)

Take the trade rather than build a cache:

- The hot tickets card polls every **30 seconds**, not 10. It is a shortlist of what is hot, not a live feed; nothing on it changes in ten seconds that matters in thirty.
- The AI Queue card polls every **10 seconds**, not 5. Its entries change when an agent finishes, which is minutes.
- The "in progress" lane calls `agents(projectId)` on the same 30-second beat, not on its own.
- Both cards read every project in one `Promise.all`, so N projects is one wait, not N.

What is deliberately **not** built: a shared cross-widget read cache in the daemon. The framework already forgets a project's provided reads when a widget acts on it (`src/store/provided.ts`), and adding a second caching layer keyed by command line would put the framework back in the business of knowing what a command means.

If the cost is felt in practice, the next step is a `runCommand` that takes several projects at once — the daemon already runs the commands, and batching is its business, not the widget's. Not now.

### S3. A start that does not land (P3)

`startRun(projectId, prompt, opts?: { land?: boolean })`, `land` defaulting to true so every existing caller is unchanged. The fan-out passes `land: false` and stays on the Overview; the play button passes nothing and lands, as today.

### S4. The dirty stopped run (P4) — decided: the rule stays, the words change

The package's clean rule is right: pushing the commits of a tree with uncommitted work publishes half a run's work and silently leaves the rest on a machine the reviewer cannot see. That is exactly the "Unpushed" row the Human Queue exists to show.

So: no `--force`, no "push anyway". Instead the run page's bar, where it shows the refusal today, names the two things a person can actually do — open the checkout, or reclaim it with `--discard` — and says which files are in the way, which `show` already answers as `pendingFiles`.

Rejected: a `publish --commit` that commits the leftovers itself. It would write a commit nobody wrote, with a message nobody chose, into a branch about to become a pull request.

### S5. `FEATURES-SPEC.md` (P5) — decided: the rule goes, for now

Change AGENTS.md to say what is true: every user-facing feature is described in the LOGIC.md of the code that implements it. That is the file that actually exists, is actually maintained, and is regenerated by the `ldd` skill.

A separate `FEATURES-SPEC.md` is a second place to forget. If one is wanted as a reader's entry point, it should be **generated** from the LOGIC.md TLDRs rather than hand-kept — and that is its own ticket, not a line in this one.

### S6. The #1817 regressions

- **The session name.** `WidgetAgent.name` and the Human Queue's rows carry the branch as the provider gives it (`agent-fix-login`). The framework strips its own `agent-` prefix where it *shows* a name; it does not ask the provider for a second field. The prefix is the branches package's convention, but the string arrives in the framework's hands and the framework is what draws the label.
- **The pull request's base.** `publish` gains `--base <branch>`; the framework passes the project's default branch, which `show` already answers as `base`. Without `--base` the package keeps using the forge's default, so a provider that does not take the flag is not broken by it.
- **The sweep's widened rule.** The scratch sweep (`src/cloud-scratch-refs.ts`) now considers any branch a run's record names, not only `agent-<timestamp>`. Its four gates — old enough, holds no work, no open pull request, not busy — are unchanged and are what make it safe. Add a test for the case the widening created: a branch a run **renamed**, recorded, landed and not busy, which must still clear all four gates before it goes.

### S7. Accepted losses, written down so they are not rediscovered

- **A plan ask may be queued twice.** The page-wide "Add to queue: plans" no longer skips a ticket whose implementation is already queued, because a queue entry is a line and the queue cannot know a plan ask belongs to a ticket. Teaching it would mean the queue parsing ticket paths — the exact coupling both DECISIONS files refuse. A duplicate plan ask costs one agent one cheap run.
- **"Plan truncated" does not come back.** The plan arrives whole from `tickets show`; there is nothing to truncate and so nothing to warn about.

## Considerations

- **The order matters.** 3 before 4: the cards cannot move until there is somewhere to put them. 1 before everything: without a root build, every cutover in this list is a package someone forgot to build.
- **What can be deleted after 4, and what cannot.** The hot-ticket lane rules and the `onHotTickets` read go with the card. `collectQueue` does **not**: `src/dashboard/dashboard.ts` uses it for the onboarding checklist and the Overview keeps `queueOpen` as a single number. Check both before deleting anything.
- **The tickets page's own "Add to queue" stays exactly as it is.** It is a link action and is untouched by the card move. The hot tickets card's rows are links, so the same link-actions slot gives the queue package its button on them, and a project without the queue package shows none — which is how the card keeps working when only one of the two packages is installed.
- **Tickets and the queue stay independent**, as their DECISIONS say. After the move, the tickets package's card must render with no queue package present, and the queue package's card with no tickets package present. Two tests, not an assumption.
- **The AI Queue lane of the hot tickets card goes.** The AI Queue card sits beside it and is the queue's. The tickets card keeps two lanes: in progress, high priority.
- **The Overview must survive a project with no packages at all.** Today it draws two cards that say "nothing"; after the move it draws neither, and the Human Queue, Agents and Scheduler cards carry the page. That is a visible change to an empty install and should be looked at once in the real dashboard, not only in tests.
- **A card's failure is its own.** `WidgetSlot`'s boundary is what keeps a package's broken card from taking the Overview down with it.
- **The onboarding steps stay the framework's**, shown or hidden by whether the project has the package, as today. No slot for a package's own step until a package needs one.
- **The deferred slots stay deferred**: the run page's buttons, the tickets page's bulk buttons, the onboarding's "Update from GitHub". Each is the framework phrasing an action it performs; none has a second caller yet.
- **The five-second checkout cache is not a defect.** `list({ fresh: true })` already exists for the two callers that must see a checkout the moment it appears, and the dashboard polls several reads of every project every few seconds. Leave it.
- **Watch the sweep while this work runs.** During the writing of this plan a live run's checkout was reclaimed and its branch deleted about a minute after it started: its record says `failed` — "its process died before the run ended" — while the agent was still working in it. Three consecutive `/work-queue` runs were recorded the same way (`2026-09-20T19-18`, `19-19`, `19-20`). That is the scheduler's sweep (`packages/agent-scheduler/src/sweep.ts`), not the scratch sweep in this list, and its `lockHolder` gate is where to look. It is not this ticket's work, but no pull request in this plan can be committed by an agent while it holds: **file it separately and fix it first**.

## Implementation

### PR 1 — one root build

`package.json`: `build` builds every package the daemon runs, in dependency order, the way `test` and `clean` already list them (`agent-data`, `skill-branches`, `skill-tickets`, `skill-queue`, `skill-logs`, `agent-driver`, `agent-scheduler`, `framework`). Same for `typecheck`, which today covers the framework and the website only. Verify by running it on a clean checkout with every `dist` removed.

### PR 2 — the #1817 regressions

- Strip the `agent-` prefix where the framework draws a branch as a name: the run labels, the pull request title it proposes, the Human Queue's "Unpushed" rows.
- `--base` through the branches contract: `src/store/branches.ts` passes it, `packages/skill-branches` takes it, the contract comment in `branches.ts` gains the flag.
- The sweep test for a renamed, recorded, landed, not-busy branch.

### PR 3 — the Overview-card slot

- `dashboard/widget/index.ts`: `WidgetCard`, `WidgetCardProps`, `WidgetDefinition.cards`.
- `dashboard/lib/use-widgets.ts`: mount the cards beside the pages.
- `dashboard/components/WidgetPageView.tsx` → factor `WidgetSlot` (host + boundary), used by the page view and the cards.
- `dashboard/components/DashboardPage.tsx`: draw the declared cards in the right column, sorted by `order` then package.
- `startRun`'s `land` option, through `App.tsx` and `INERT_HOST_SERVICES`.
- The `framework/widget` LOGIC.md gains the card in "What a widget exports" and "What a widget may draw with".
- Tests: a card renders with its host; a card that throws shows only its own error; two packages' cards come out in `order`; `land: false` starts without navigating.

### PR 4 — the two cards move

- `packages/skill-queue/dashboard/`: the AI Queue card, from `framework/dashboard/components/AiQueue.tsx`, reading `queue` per project through `runCommand`, starting through `startRun` (play: land; fan-out: `land: false`) and `configureRun`. Declared at `order: 10`.
- `packages/skill-tickets/dashboard/`: the hot tickets card, from `framework/dashboard/components/HotTickets.tsx`, with two lanes — in progress (via `agents(projectId)`), high priority — reading `tickets list` per project and computing the lane rules in the browser, from `src/dashboard/overview.ts`'s rules. Rows are links, so the queue's "Add to queue" attaches itself. Declared at `order: 20`.
- Delete from the framework: `AiQueue.tsx`, `HotTickets.tsx`, the hot-ticket lane rules, the `onHotTickets` read and its RPC. Keep `collectQueue` (onboarding, `queueOpen`).
- The poll intervals of S2.
- Both packages' LOGIC.md gain their card; the framework's `DashboardPage.LOGIC.md` loses the two cards from the board's order and says instead that the packages' cards go there.

### PR 5 — the rest of housekeeping

- The `.claude/skills` copies: `tickets` and `queue` are each one line behind their package's `SKILL.md` (the `--local`/`--force` and `--local`/`--full` sentences from #1815 and #1813), and `branches` has no copy at all — a run's checkout gets it linked from the package (`skill-branches/src/skill-links.ts`) while the repository's own copy never existed. Make the repository's copies links to the packages too, the way a run's checkout does, so there is one text and it cannot drift. Anything that cannot be a link gets a check in CI.
- `lib/preferences.ts` parses `window.location.pathname` itself in four places; take the project from the router instead.
- The Human Queue's unpushed rows read only recorded runs, so a run that ended without a record shows nothing; read the checkouts the branches provider lists as well.
- The logs widget takes the dashboard's theme file by a repository-relative path at build time; it should take it from the package it builds in.
- AGENTS.md: the `FEATURES-SPEC.md` rule, per S5.

### Not in this plan

- The launcher's removed options, the run's browser panel and the web-run driver: #1819, as options of the run tool plus a run widget.
- No forge, GitLab, Bitbucket, a custom one: #1820.
- Discord as a module: after #1819 and #1820, since it is the first package that would take from the framework instead of providing to it.
- The run page's Open PR → Merge PR → Remove worktree flow: the ticket says what to change comes later, and nothing here changes it.
