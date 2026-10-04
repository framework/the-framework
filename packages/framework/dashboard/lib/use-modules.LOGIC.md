Loads the modules [1] the registered projects have and gives the shell their pages, their Overview cards, their link actions [2], their side-rail tabs, their run slots [3], their sections of the Settings page and the usage bar's stop line [4], and hands all of them to every component of the shell.

## Context

**User story**: the user opens the dashboard; a moment later the sidebar shows a Logs row and a Tickets row under Overview, because one of the registered projects depends on the logs package and one on the tickets package, and a ticket's page shows an "Add to queue" button, because that ticket's project depends on the queue package. Installing a module's package in a project adds its row and its buttons within half a minute, with no restart.

## Glossary

[1] module: a package that adds to the dashboard (pages, Overview cards, side-rail tabs, what an agent's page shows, actions on the links pages show, Settings sections, the usage bar's stop line): its browser part, named by the package's `exports["./dashboard"]`, reads its data through its own package's command, or through its own server part, named by `exports["./server"]`, which the daemon calls in its own process. A module comes from a project's dependencies, or is built into the dashboard and loaded for every project, as the Files module is.
[2] link action: one verb a module offers on any link a dashboard page shows, done by the module package's own command.
[3] run slot: a place on an agent's page a module fills: the summary, a few words in the bar above the message box, shown until the agent has ended and its branch has been read (the handoff's own words take over then); and the details, a block under the action bar at the top of the page. Each is told the agent, whether it is still working, and whether the action bar is open.
[4] stop line: where a module's unattended work stops on the Overview's usage bar, as an offset from the quota boundary in percentage points; the module reads the offset and saves a new one, the bar draws the line and its handle.

## Business logic

The list of modules is read from the daemon now and every 30 seconds. Each module's browser part is imported once per page load, by its URL; a module that fails to load is skipped with a console warning and adds nothing; a module whose default export is not an object adds nothing. When a module's definition names a stylesheet, it is linked into the page once, resolved against the module's URL. The pages are the definitions' pages in the order of the module list (package order), each carrying the package it came from and the projects that have it. A page whose segment is not a lowercase letter followed by lowercase letters and digits is dropped, and a segment already taken by an earlier page is dropped too: the first module to claim it keeps it. The link actions [2] are every definition's link actions in the same order, each carrying its package and its projects; none is dropped. The result says whether loading is complete, meaning the list was read and every module in it was imported or skipped, so the shell can tell "no such page" from "not loaded yet".

The cards are the definitions' cards, each carrying the package it came from and the projects that have it, sorted by their `order` (50 when unsaid), then by package name: numbers rather than a list the shell keeps, so a third package's card sits between two others without the shell knowing it exists.

The Settings sections are the definitions' sections, each carrying the package it came from and the projects that have it, sorted exactly as the cards are: by `order` (50 when unsaid), then by package name.

The usage bar's stop line [4] is the first definition's that declares one, in package order, carrying the package it came from and the projects that have it; a later module's stop line is not mounted, since the bar has one handle. With no definition declaring one, none is mounted and the bar shows the account only (`components/Quota.tsx`).

The side-rail tabs are every definition's tabs, and the run slots one entry per module that brings a summary or details, both in package order, each carrying the package it came from and the projects that have it: the rail and an agent's page offer them only for a project among those.

The shell reads all of this once and provides it to every component in it (`ModulesContext`, read with `useMountedModules`), so a page deep in the tree finds the link actions without being handed them; outside the shell, nothing is mounted and nothing is loaded.
