`framework/widget`: what the dashboard offers a widget [1]. It is at once the widget author's contract (the shapes a widget exports, the services it may call, the building blocks it may use) and, at runtime, the dashboard's own running module, which a widget reaches by the bare name `framework/widget`. A widget adds pages, and offers actions on the links [3] the dashboard's pages show.

## Context

**User story**: the `logs` package's widget exports a definition saying "a page at `/logs`, labelled Logs, with this icon, rendering this component"; its page asks the dashboard to run `logs --limit 50` in each project and to open a run's page when a row is clicked, and it draws with the dashboard's own table styles and date formatting, so it looks like the rest of the dashboard.

**Problem**: a widget ships in another package, built on its own, and is loaded into a dashboard that is already running. It must render inside the dashboard's own React, reach the dashboard's own services, and look the same, without bundling a second copy of any of them.

## Glossary

[1] widget: a browser module one of a project's packages brings to the dashboard, named by the package's `exports["./dashboard"]`; it adds pages to the dashboard and reads its data through its own package's command [2].
[2] command: one of a package's executables, as its `package.json` `bin` lists them, run the way an agent runs it with `npx`.
[3] link: the name of some work and where it points, as a dashboard page shows it: a text, an optional target (a path inside the project's repository, or an absolute URL; absent for plain text that points nowhere) and an optional priority from 0 (only if capacity) to 10 (critical).
[4] link action: one verb a widget offers on any link [3], done by the widget package's own command [2]: a label, an optional label for once it is done, an optional icon, and the act itself, on a list of links in one project.

## Business logic — TL;DR

- **What a widget exports** - by default, a definition: its pages (each a URL segment, a sidebar label, an optional icon, the page component), its link actions [4], and an optional stylesheet beside its module.
- **A link action** - a verb the dashboard shows as a button beside any link [3] whose project has the widget's package; the widget acts on the links, in order, through its own command, and a batch stops at its first failure with the reason.
- **What a page is given** - the registered projects whose dependencies include the widget's package, and the URL segments after its own.
- **What a page may ask the dashboard** - run one of its own package's commands [2] in one project and get the JSON, and open an agent's page.
- **What a widget may draw with** - the dashboard's button, badge, card and skeleton, its class-name joiner, its date and duration formatting, and its polling hook.

## Business logic

### What a widget exports

#### Context

See `## Context`.

#### Business logic

The widget module's default export is its definition. `pages` lists the pages it adds; each has a `segment`, its URL `/<segment>`, which is a lowercase letter followed by lowercase letters and digits and so can never be a project's id (a project's id always carries a dash); a `label` for its sidebar row; an optional `icon` component for that row (a generic icon otherwise); and the `Page` component. `linkActions` lists the link actions [4] it offers. `stylesheet` names a file relative to the widget module's own URL, loaded once with the module. `defineWidget` only types the definition; it changes nothing.

### A link action

#### Context

**User story**: a ticket's page shows the ticket as a link [3]; the project has the queue package, whose widget offers "Add to queue" on any link; the page shows an "Add to queue" button beside the ticket, and a project without the queue package shows none. No page names the queue, and the queue widget names no ticket.

**Problem**: a feature that needs two skills (a ticket queued) must exist without either skill knowing the other; only the dashboard, which installed both, knows both.

#### Business logic

A link action [4] has a `label`, the button's short verb phrase ("Add to queue"); an optional `doneLabel`, what the button says once done ("Queued"; the label with a check mark otherwise); an optional `icon`; and `run(host, projectId, links)`, which acts on the given links, in the order given, all in the one project, through `host`: the same services a page gets from `useWidgetHost`, bound to the widget's package, so the action can only run its own package's commands. It answers done, or not done with the reason; a batch stops at its first failure. Where the dashboard shows the button, and how it phrases a batch, is the dashboard's (`components/LinkActions.tsx`).

### What a page is given

#### Context

**User story**: the Logs page shows the runs of the two projects that have the logs package and none of the third one that does not.

#### Business logic

A page receives `projects`, the registered projects whose dependencies include its package, each as its id and name, in the registry's order; and `path`, the URL's segments after its own, decoded (`/logs/a` gives `['a']`).

### What a page may ask the dashboard

#### Context

**Problem**: the widget runs in the browser and has no access to the project's files; its data comes from its own package's command, which the daemon runs in the project.

#### Business logic

`useWidgetHost()`, called inside a widget page, gives the page:

- `package`, the name of the package the widget came from;
- `runCommand(projectId, args, command?)`, which asks the daemon to run one of that package's commands in that project and answers the command's JSON output or the reason there is none (the rules are the daemon's, in `src/project-widgets.ts`); a page can only ever run its own package's commands;
- `openAgent(projectId, agentId)`, which navigates the dashboard to that agent's page.

Called anywhere else, it fails with "useWidgetHost is only available inside a widget page". `widgetHost(base)` builds the same services from a package name and the navigation, for the dashboard to hand a link action [4] outside any page.

### What a widget may draw with

#### Context

See `## Context`.

#### Business logic

The module also hands on the dashboard's own `Button` (with its variants), `Badge`, `Card` and its parts, `Skeleton`, the `cn` class-name joiner, the `formatRelative`, `formatDateTime` and `formatDuration` formatters, and the `usePolled` hook (read now, again on an interval, and again when its inputs change). Since they are the dashboard's running copies, a widget's page follows the dashboard's theme and behaviour exactly.
