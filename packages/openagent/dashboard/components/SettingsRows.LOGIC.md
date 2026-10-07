The Settings page's building blocks: a section, a row, and a row picked from a drop-down. The page's own sections are made of them (`SettingsPage.tsx`), and so is a section a module [1] brings, through `@openagt/dashboard/module`, so every section of the page looks alike.

## Glossary

[1] module: a package that adds to the dashboard (pages, Overview cards, side-rail tabs, what an agent's page shows, actions on the links pages show, Settings sections): its browser part, named by the package's `exports["./dashboard"]`, reads its data through its own package's command, or through its own server part, named by `exports["./server"]`, which the daemon calls in its own process. A module comes from a project's dependencies, or is built into the dashboard and loaded for every project, as the Files module is.

## Business logic — TL;DR

- **A section** - a titled card, with an optional line under the title, holding its rows one under the other.
- **A row** - what the setting is and what it does on the left, its control on the right; a row the rules turned off is greyed but still shown with its reason.
- **A drop-down row** - a row whose control is a drop-down of choices, each a value and a label, some of which may be lines that cannot be picked; a row with no choice at all is not drawn.

## Business logic

### A drop-down row

#### Context

**Problem**: an empty drop-down is a control that can be opened and not used; it reads as broken rather than as "no choices here".

#### Business logic

The drop-down shows the row's value as picked, is named by the row's label for a screen reader, and hands the picked value to the row's owner the moment it is picked; a choice marked as a line that says something rather than a choice cannot be picked. A row whose list of choices is empty is left out entirely rather than shown as an empty drop-down.
