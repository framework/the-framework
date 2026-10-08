The project select: the menu at the top of the sidebar that picks the one project every page of the dashboard shows, or all of them. It filters; whether the page changes is the caller's (`App.tsx`).

## Context

**User story**: the user works on several projects. They open the menu, pick one, and the Overview, the modules' pages and the list of recent agents are about that project alone. They pick "All projects" to see everything again. From the same menu they see which project the daemon has trouble with, and register a new project.

## Glossary

[1] picked project: the one project the project select names. The sidebar then lists only the pages, and the Overview draws only the cards, added by the packages that project has, and every page shows only that project's data. When the select says "All projects", no project is picked, the sidebar lists the pages added by every project's packages and every page shows every project's data.

## Business logic — TL;DR

- **The button** - names the picked project [1] with its dot, or reads "All projects".
- **The menu** - "All projects", then every registered project with its state, then "Add project"; a tick marks the current pick.
- **A pick** - is reported to the caller, which changes what the pages show and which pages the sidebar lists.

## Business logic

### The button

#### Context

See `## Context`.

#### Business logic

The button is as wide as the sidebar and shows the picked project's [1] name after a dot: red when the daemon has recorded an error for the project, filled when the project is activated, muted otherwise. With no project picked it shows a stack icon and "All projects". Its accessible name is "Project: <name>" or "Project: All projects".

### The menu

#### Context

See `## Context`.

#### Business logic

The menu is as wide as the button and lists, top to bottom:

- "All projects".
- One entry per registered project, by name, with the same dot as the button. Under the name of a project in error, one red line per error names what is wrong, the error's title from `ProjectErrorBanner.tsx` (for a data-branch sync failure, "Not syncing with the remote"), and hovering that line shows the daemon's own message. Under the name of a project that is not activated and has no error: "Not activated". Under the name of an activated project with no error whose repository has no remote: "Local only, no remote", in grey; under one whose repository has a remote the person does not share the agents' records with: "Records kept on this machine", in grey; either way its dot stays that of a project with nothing wrong.
- "Add project", which opens the add-project panel (`AddProjectPanel.tsx`); once a project is added, the caller refreshes its list.

A tick marks the entry that is the current pick: the picked project, or "All projects".

### A pick

#### Context

See `## Context`.

#### Business logic

Choosing a project reports its id to the caller, and choosing "All projects" reports that none is picked. What changes on the pages, and where the pick is kept, is the caller's (`App.tsx`: the pick is in the address).
