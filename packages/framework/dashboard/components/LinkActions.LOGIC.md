The slot where a page's links [1] meet the link actions [2] the installed widgets [3] offer: for every link action whose package the links' project has, one button that hands the links to the action, and nothing at all when no widget offers one.

## Context

**User story**: a ticket's page shows an "Add to queue" button because the project depends on the queue package, whose widget offers that action on any link; a project without that package shows no such button; a project that installs another package offering an action on links gets that button too, with no change to the ticket page.

**Problem**: a feature that needs two skills (a ticket queued) must exist without either skill knowing the other. The ticket page knows tickets and shows them as links; the queue widget knows the queue and acts on links; only the dashboard, which installed both, knows both, and it joins them here.

## Glossary

[1] link: the name of some work and where it points, as a dashboard page shows it: a text, an optional target (a path inside the project's repository, or an absolute URL; absent for plain text that points nowhere) and an optional priority from 0 (only if capacity) to 10 (critical).
[2] link action: one verb a widget offers on any link, done by the widget package's own command: a label, an optional label for once it is done, an optional icon, and the act itself, on a list of links in one project.
[3] widget: a browser module one of a project's packages brings to the dashboard, named by the package's `exports["./dashboard"]`; it adds pages to the dashboard, offers link actions, and reads and changes its data through its own package's command.

## Business logic — TL;DR

- **Which buttons** - one per mounted link action whose package at least one of the given projects has, in the widgets' order; none when no action applies.
- **A click** - resolves the links (at click time when the page gives a function, so the page can first read what already exists), then hands each project's links to the action in the order given, skipping a project that lacks the action's package, and stops at the first failure.
- **Done, failed, rested** - a finished action's button reads its done label with a check mark and stays disabled until the set changes; a failure shows its reason under the buttons and re-arms the button.

## Business logic

### Which buttons

#### Context

See `## Context`.

#### Business logic

The page gives the projects its links belong to, and what a click acts on: links grouped by project, either known up front or as a function that answers them when clicked. The mounted link actions come from the shell (`lib/use-widgets.ts`). A button is shown for each action whose package is in at least one of the given projects, in the order the widgets were mounted. When no action applies, nothing is rendered. Each button carries the action's icon and label, or the text the page's own phrasing gives the action (the tickets list phrases "Add to queue: all 5 tickets shown below"); the page may add one tooltip, the same for every action.

### A click

#### Context

**Problem**: a page that adds a set of tickets must first read what is already there, at the moment of the click, so nothing is added twice; and a cross-project list holds links of several projects, each of which must reach its own project.

#### Business logic

A click resolves the links: the function form is called then, never earlier. The action is then run once per project group, in the order given, with the links of that group, through a host bound to the action's own package, so the action can run only that package's commands; opening an agent through the host lands where the page says, or nowhere. A group whose project does not have the action's package, or with no links, is skipped. The first group the action refuses ends the batch with its reason. While a click runs, every button here is disabled.

### Done, failed, rested

#### Business logic

When every group succeeded, the button reads the action's done label ("Queued"), or its label when it has none, with a check mark, and is disabled: the same set is not acted on twice. It is armed again when the set changes, which the page signals by a key of its own (the identity of the set it acted on), or, without one, when the projects change. A failure shows the reason as an alert line under the buttons and leaves the button ready to try again. The page may disable the buttons while an action of its own is in flight.
