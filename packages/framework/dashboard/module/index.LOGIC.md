`framework/module`: what the dashboard offers a module [1]. It is at once the module author's contract (the shapes a module exports, the services it may call, the building blocks it may use) and, at runtime, the dashboard's own running module, which a module reaches by the bare name `framework/module`. A module adds pages, Overview cards, tabs in the side rail, what an agent's page shows, sections of the Settings page and a stop line [7] on the usage bar, offers actions on the links [3] the dashboard's pages show, and may read through its own server part.

## Context

**User story**: the `logs` package's module exports a definition saying "a page at `/logs`, labelled Logs, with this icon, rendering this component"; its page asks the dashboard to run `logs --limit 50` in each project and to open a run's page when a row is clicked, and it draws with the dashboard's own table styles and date formatting, so it looks like the rest of the dashboard.

**Problem**: a module ships in another package, built on its own, and is loaded into a dashboard that is already running. It must render inside the dashboard's own React, reach the dashboard's own services, and look the same, without bundling a second copy of any of them.

## Glossary

[1] module: a package that adds to the dashboard (pages, Overview cards, side-rail tabs, what an agent's page shows, actions on the links pages show, Settings sections, the usage bar's stop line): its browser part, named by the package's `exports["./dashboard"]`, reads its data through its own package's command [2], or through its own server part, named by `exports["./server"]`, which the daemon calls in its own process. A module comes from a project's dependencies, or is built into the dashboard and loaded for every project, as the Files module is.
[2] command: one of a package's executables, as its `package.json` `bin` lists them, run the way an agent runs it with `npx`.
[3] link: the name of some work and where it points, as a dashboard page shows it: a text, an optional target (a path inside the project's repository, or an absolute URL; absent for plain text that points nowhere) and an optional priority from 0 (only if capacity) to 10 (critical).
[5] run slot: a place on an agent's page a module fills: the summary, a few words in the bar above the message box, shown while that bar is drawn and until the agent has ended and its branch has been read (the handoff's own words take over then); and the details, a block under the action bar at the top of the page. Each is told the agent, whether it is still working, and whether the action bar is open.
[6] Context: the set of paths the user picked to focus an agent on: other registered projects, by their absolute path, and files of the current project, by their path relative to the repository's root.
[4] link action: one verb a module offers on any link [3], done by the module package's own command [2]: a label, an optional label for once it is done, an optional icon, and the act itself, on a list of links in one project.
[7] stop line: where a module's unattended work (agents its package starts on its own, with nobody at the keyboard) stops on the Overview's usage bar, as an offset from the quota boundary in percentage points of the week, negative before the boundary and positive past it. The quota boundary is the share of the account's quota week that may be spent by now.

## Business logic — TL;DR

- **What a module exports** - by default, a definition: its pages (each a URL segment, a sidebar label, an optional icon, the page component), its cards for the Overview (each an id, an optional order, the card component), its link actions [4], its side-rail tabs (each an id, a label, a tooltip, an optional count, the tab component), its run slots [5] (a summary and details component), its Settings sections (each an id, an optional order, the section component), an optional stop line [7] for the usage bar (a read and a save), and an optional stylesheet beside its module.
- **A project, as a module is given it** - its id, its name, and whether one of its packages provides a git host, since without one no pull request can be opened there.
- **The usage bar's stop line** - a module that starts unattended work may put on the Overview's usage bar the line that work stops at: the bar asks the module to read the offset in force and to save the one a drag picked, each given the projects that have its package; the first module that declares one, in package order, has the line.
- **What a Settings section is given** - the registered projects whose dependencies include the module's package; it is drawn after the Settings page's own sections, and not at all while no registered project has the package.
- **What a side-rail tab is given** - the project on screen, the agent whose page it is (if any), and the Context's [6] files with a way to add or remove one; it is offered on every project and agent page of a project that has the module, and says itself when it has nothing.
- **What a run slot is given** - the project, the agent, whether it is still working, and whether its action bar is open.
- **A link action** - a verb the dashboard shows as a button beside any link [3] whose project has the module's package; the module acts on the links, in order, through its own command, and a batch stops at its first failure with the reason.
- **What a page is given** - the registered projects whose dependencies include the module's package, and the URL segments after its own; a link into a project's files opens the page named by the link's first segment, with the project and the rest of the path as that page's segments.
- **What a page may ask the dashboard** - run one of its own package's commands [2] in one project and get the JSON, or act with one so what it wrote shows at once; call one of its own server part's reads in one project; open an agent's page or a module's page; start a run with a prompt and land on it, or not land when the module says so, or open the launcher with the prompt drafted; and list a project's runs. None of it names a skill: what a module composes out of them is its own.
- **What a module may draw with** - the dashboard's buttons, badge, card, skeleton, checkbox, input, popover, range slider, separator, scroll area, tooltip and dropdown menu, its markdown renderer, its split start button, its link-actions slot, its hover card, the dashboard's "+added −removed" pair, its class-name joiner, the Settings page's section, row and drop-down row, the list of coding agents with the models each lists, the reach of the usage bar's handle (50 points either side of the quota boundary), its date, age and duration formatting, its polling and loading hooks, and its action hook.

## Business logic

### What a module exports

#### Context

See `## Context`.

#### Business logic

The module's browser part's default export is its definition. `pages` lists the pages it adds; each has a `segment`, its URL `/<segment>`, which is a lowercase letter followed by lowercase letters and digits and so can never be a project's id (a project's id always carries a dash); a `label` for its sidebar row; an optional `icon` component for that row (a generic icon otherwise); and the `Page` component. `cards` lists the cards it adds to the Overview: each has an `id`, for the shell's key and its error line, never shown as a title; an optional `order`, its place among every installed package's cards, lower first, 50 when unsaid, ties by package name; and the `Card` component, given the registered projects that have the module's package (see "A project, as a module is given it"), and nothing else: a card has no URL and no sub-path. A project none of whose packages declares a card sees none. `settings` lists the sections it adds to the Settings page: each has an `id`, for the shell's key and its error line, never shown as a title (the section draws its own); an optional `order`, its place among every installed package's sections, lower first, 50 when unsaid, ties by package name; and the `Section` component. `linkActions` lists the link actions [4] it offers. `usageLimit` is the stop line [7] it puts on the usage bar (see "The usage bar's stop line"). `stylesheet` names a file relative to the module's browser part's own URL, loaded once with the module. `defineModule` only types the definition; it changes nothing.

### What a side-rail tab and a run slot are given

#### Context

**User story**: the Files module adds a "Files" tab beside the rail's own tabs and, on a working agent's page, the count of files the agent changed in the bar above the message box, with their list under the action bar at the top of the page.

#### Business logic

`panels` lists the tabs a module adds to the side rail. Each has an `id`, unique among the module's own; a `label`; a `help`, the tab's tooltip; an optional `count`, a number shown beside the label from what the tab is given (none when absent or zero); and the `Panel` component. A tab is rendered with the project on screen (`projectId`), the agent whose page it is (`agentId`, absent on the project's own page), `activity`, how many events the agent's feed has shown (it grows each time the agent does something, so a tab showing what the agent changes reads again then rather than on its next poll; absent on the project's own page), and `context`: the Context's [6] files as repo-relative paths, and `toggle(path)`, which adds the path to the Context or takes it out.

`run` holds a module's run slots [5]: an optional `summary` and an optional `details` component. Each is rendered with the project, the agent (`agentId`), `working`, true while the agent's coding agent is still working (an agent that ended or stopped on a question is not), and `expanded`, true while the action bar is open.

### A project, as a module is given it

#### Context

**User story**: a module's section offers "Open PR" only in a project where a pull request can be opened. A project with no git host package (a repository on a host no installed package speaks to) is offered what stops at the branch.

**Problem**: whether a project has a git host is the dashboard's knowledge (which package provides it is read from the project's own `package.json`); a module that needed it would otherwise have to learn how providers are declared.

#### Business logic

Wherever a module's page, card or Settings section, or its stop line's read and save, is given projects, each is the project's id, its name, and `gitHost`: whether one of the project's packages provides a git host. The fact comes from the daemon's project list (`../../src/dashboard/projects.ts`), so it is as fresh as that list.

### The usage bar's stop line

#### Context

**User story**: the scheduler package starts agents on its own while the account is under a line the user sets. The user sees that line on the Overview's usage bar and drags it, without the dashboard knowing the scheduler exists.

**Problem**: the line is one package's setting, drawn on the dashboard's own bar. The dashboard reading that package's file and writing through a hook line would make the dashboard know the package.

#### Business logic

`usageLimit` holds a `read` and a `save`. `read`, given the dashboard's services for the module (the same a page gets from `useModuleHost()`) and the registered projects that have the module's package, answers the offset in force across them, or nothing when none says one: the bar then draws no line. `save`, given the same and the offset a drag picked, in percentage points and within 50 either side of the boundary (`MAX_SPEND_OFFSET`, which the module may import to bound its own controls), answers done, or stopped with the reason, which the bar shows. Both go through the module package's own command [2]. The first module that declares a stop line, in package order, has it (`lib/use-modules.ts`); how the bar draws it, when it reads and when it saves are the bar's (`components/Quota.tsx`).

### What a Settings section is given

#### Context

**User story**: a project depends on the orchestration package, so the Settings page shows, after its own sections, that package's Subagents section; a dashboard where no project has the package shows no such section.

**Problem**: a package's settings that the Settings page drew itself would make the dashboard know each package's file and command, so every package's settings would be a change to the dashboard.

#### Business logic

A Settings section is rendered with `projects`: the registered projects whose dependencies include its package (see "A project, as a module is given it"), in the registry's order. The section reads and writes the package's own settings through its own package's command [2], as a page reads its data, and draws its own title and rows, usually with the building blocks below, so it looks like the page's own sections. Where the dashboard draws it is the dashboard's (`components/ModuleSettingsSections.tsx`).

### A link action

#### Context

**User story**: a ticket's page shows the ticket as a link [3]; the project has the queue package, whose module offers "Add to queue" on any link; the page shows an "Add to queue" button beside the ticket, and a project without the queue package shows none. No page names the queue, and the queue module names no ticket.

**Problem**: a feature that needs two skills (a ticket queued) must exist without either skill knowing the other; only the dashboard, which installed both, knows both.

#### Business logic

A link action [4] has a `label`, the button's short verb phrase ("Add to queue"); an optional `doneLabel`, what the button says once done ("Queued"; the label with a check mark otherwise); an optional `icon`; and `run(host, projectId, links)`, which acts on the given links, in the order given, all in the one project, through `host`: the same services a page gets from `useModuleHost`, bound to the module's package, so the action can only run its own package's commands. It answers done, or not done with the reason; a batch stops at its first failure. Where the dashboard shows the button, and how it phrases a batch, is the dashboard's (`components/LinkActions.tsx`).

### What a page is given

#### Context

**User story**: the Logs page shows the runs of the two projects that have the logs package and none of the third one that does not.

#### Business logic

A page receives `projects`, the registered projects whose dependencies include its package (see "A project, as a module is given it"), in the registry's order; and `path`, the URL's segments after its own, decoded (`/logs/a` gives `['a']`).

The link convention: a link [3] whose target is a path inside a project's repository, such as `tickets/2026-01-01_x.md`, is opened by the dashboard at `/<first segment>/<project id>/<rest…>`, the page named by the path's first segment getting `[projectId, ...rest]` as its `path`, when an installed module brings a page under that word; with none, the link is shown as text and opens nothing. So a page that shows one project's file under its own segment is where every such link in the dashboard lands, and the dashboard names no page (`lib/data-link.ts`).

### What a page may ask the dashboard

#### Context

**Problem**: the module runs in the browser and has no access to the project's files; its data comes from its own package's command, which the daemon runs in the project.

#### Business logic

`useModuleHost()`, called inside a module page, card, tab, run slot or Settings section, gives it:

- `package`, the name of the package the module came from;
- `runCommand(projectId, args, command?)`, which asks the daemon to run one of that package's commands in that project and answers the command's JSON output or the reason there is none (the rules are the daemon's, in `src/project-modules.ts`); a page can only ever run its own package's commands;
- `act(projectId, args, command?)`, the same for a command that changes the project's data (a claim released, an entry added): the daemon then syncs the project's data with origin and forgets what it had read, so the change shows at once instead of at the next sync;
- `openAgent(projectId, agentId)`, which navigates the dashboard to that agent's page;
- `openPage(segment, path?)`, which navigates to a module's page (this module's or another's) at a sub-path, such as `openPage('tickets', [projectId, file])`;
- `startRun(projectId, prompt, opts?)`, which starts a run in that project with the prompt and the user's own picks (which coding agent, which model, where it runs), lands the dashboard on the run unless `opts.land` is false (then the dashboard stays where it is and only the sidebar learns of the run: for a module that starts several runs in a row), and answers the run's id or in words why there is none;
- `configureRun(projectId, prompt)`, which opens that project's launcher with the prompt drafted in, so the user sets it up before sending ("Configure first, then run");
- `read(projectId, name, input?)`, which asks the daemon to call one of the module's own server part's reads (its package's `./server`) in that project with `input`, a JSON object whose `agentId` names the agent the read is about when it is about one, and answers the read's JSON or the reason there is none (the rules are the daemon's, in `src/dashboard-rpc/modules.ts`); answered in the daemon's own process, so it suits a read made every few seconds;
- `agents(projectId)`, the project's runs the dashboard knows — the running ones, and the recorded ones when the project records them — each as its id, its branch as its name when it has one, what it was asked, its status and when it started; enough for a page to say who holds a claim, or which run wrote a plan, and to link to it.

Called anywhere else, it fails with "useModuleHost is only available inside a module page". The services but the two commands and the reads come from the shell (`lib/host-services.ts`), bound to the module's package where its host is built; a test of a module page provides a whole host, commands and reads included, and gets it back as it is. `moduleHost(base, { acts })` builds the same services from a package name and the shell's services, for the dashboard to hand a link action [4] outside any page; with `acts`, every command it runs is marked as an action on the project, so the dashboard reads back what the action wrote at once (`src/dashboard-rpc/modules.ts`).

### What a module may draw with

#### Context

See `## Context`.

#### Business logic

The module also hands on the dashboard's own `Button` (with its variants), `Badge`, `Card` and its parts, `Skeleton`, `Checkbox`, `Input`, `Popover` and its parts, `RangeSlider`, `Separator`, `ScrollArea`, `Tooltip` and its parts, `DropdownMenu` and its parts, the `Markdown` renderer, the `StartAgentButton` split button (press to run, or open the chevron to configure first), the `LinkActions` slot (the other modules' actions on the links a page shows), the `PreviewCard` hover card and its parts, the `DiffStat` "+added −removed" pair, the `cn` class-name joiner, the Settings page's `SettingsSection` (a titled card of rows), `SettingsRow` (a setting's label and description beside its control) and `SettingsSelectRow` (a setting picked from a drop-down, not drawn when it has nothing to pick) with the `SettingsOption` shape of a choice (`components/SettingsRows.tsx`), the `useCodingAgents` hook (every coding agent with the models it lists: the launcher's own list, so a module's picks are ones a run can be given, `lib/models.ts`), the `formatRelative`, `formatDateTime`, `formatDuration` and `formatAge` formatters, the `usePolled` hook (read now, again on an interval, and again when its inputs change), the `useLoaded` hook and the `useAction` hook (one busy state and the reason a refusal gives). Since they are the dashboard's running copies, a module's page follows the dashboard's theme and behaviour exactly.
