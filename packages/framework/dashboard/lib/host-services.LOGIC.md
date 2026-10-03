The dashboard's services for modules [1], provided once by the shell and read wherever a module's host is built: a module page and a link action [2] get the same services, bound to their own package. Every service is generic — a project, a run, a page — and none names a skill.

## Context

**User story**: the tickets package's page starts an agent on a ticket, opens the agent holding a claim, and opens its own detail page; the queue package's action queues a link. Each does so through the dashboard, which knows how to navigate, how a run is started with the user's picks, and which runs a project has, and none of them knows the others.

## Glossary

[1] module: a package that adds to the dashboard (pages, Overview cards, side-rail tabs, what an agent's page shows, actions on the links pages show, Settings sections): its browser part, named by the package's `exports["./dashboard"]`, reads its data through its own package's command, or through its own server part, named by `exports["./server"]`, which the daemon calls in its own process. A module comes from a project's dependencies, or is built into the dashboard and loaded for every project, as the Files module is.
[2] link action: one verb a module offers on any link a dashboard page shows, done by the module package's own command.

## Business logic

The shell provides, around the whole dashboard, the services every module's host is built from (`App.tsx`): open an agent's page; open a module's page at a sub-path; start a run in a project with a prompt and the user's picks, and land on it unless the module asks not to; open a project's launcher with a prompt drafted in; and list a project's runs. A module's host is those services plus the module's package name; the two commands (`runCommand`, `act`) are bound to that package by whoever builds the host (`module/index.ts`). Where no shell provides services — a component test rendering a page or the link-actions slot alone — inert services stand in: nothing navigates, a start answers "no dashboard to start a run from", and no project has runs.
