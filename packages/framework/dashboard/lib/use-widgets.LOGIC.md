Loads the widgets [1] the registered projects bring and gives the shell their pages.

## Context

**User story**: the user opens the dashboard; a moment later the sidebar shows a Logs row under Tickets, because one of the registered projects depends on the logs package. Installing a widget's package in a project adds its row within half a minute, with no restart.

## Glossary

[1] widget: a browser module one of a project's packages brings to the dashboard, named by the package's `exports["./dashboard"]`; it adds pages to the dashboard and reads its data through its own package's command.

## Business logic

The list of widgets is read from the daemon now and every 30 seconds. Each widget's module is imported once per page load, by its URL; a module that fails to load is skipped with a console warning and adds nothing; a module whose default export is not an object adds nothing. When a module's definition names a stylesheet, it is linked into the page once, resolved against the module's URL. The pages are the definitions' pages in the order of the widget list (package order), each carrying the package it came from and the projects that have it. A page whose segment is not a lowercase letter followed by lowercase letters and digits is dropped, and a segment already taken by an earlier page is dropped too: the first widget to claim it keeps it. The result says whether loading is complete, meaning the list was read and every module in it was imported or skipped, so the shell can tell "no such page" from "not loaded yet".
