Loads the widgets [1] the registered projects bring and gives the shell their pages and their link actions [2], and hands both to every component of the shell.

## Context

**User story**: the user opens the dashboard; a moment later the sidebar shows a Logs row and a Tickets row under Overview, because one of the registered projects depends on the logs package and one on the tickets package, and a ticket's page shows an "Add to queue" button, because that ticket's project depends on the queue package. Installing a widget's package in a project adds its row and its buttons within half a minute, with no restart.

## Glossary

[1] widget: a browser module one of a project's packages brings to the dashboard, named by the package's `exports["./dashboard"]`; it adds pages to the dashboard, offers link actions, and reads and changes its data through its own package's command.
[2] link action: one verb a widget offers on any link a dashboard page shows, done by the widget package's own command.

## Business logic

The list of widgets is read from the daemon now and every 30 seconds. Each widget's module is imported once per page load, by its URL; a module that fails to load is skipped with a console warning and adds nothing; a module whose default export is not an object adds nothing. When a module's definition names a stylesheet, it is linked into the page once, resolved against the module's URL. The pages are the definitions' pages in the order of the widget list (package order), each carrying the package it came from and the projects that have it. A page whose segment is not a lowercase letter followed by lowercase letters and digits is dropped, and a segment already taken by an earlier page is dropped too: the first widget to claim it keeps it. The link actions [2] are every definition's link actions in the same order, each carrying its package and its projects; none is dropped. The result says whether loading is complete, meaning the list was read and every module in it was imported or skipped, so the shell can tell "no such page" from "not loaded yet".

The shell reads all of this once and provides it to every component in it (`WidgetsContext`, read with `useMountedWidgets`), so a page deep in the tree finds the link actions without being handed them; outside the shell, nothing is mounted and nothing is loaded.
