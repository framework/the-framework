The dashboard's services for widgets [1], provided once by the shell and read wherever a widget's host is built: a widget page and a link action [2] get the same services, bound to their own package. Every service is generic — a project, a run, a page — and none names a skill.

## Context

**User story**: the tickets package's page starts an agent on a ticket, opens the agent holding a claim, and opens its own detail page; the queue package's action queues a link. Each does so through the dashboard, which knows how to navigate, how a run is started with the user's picks, and which runs a project has, and none of them knows the others.

## Glossary

[1] widget: a browser module one of a project's packages brings to the dashboard, named by the package's `exports["./dashboard"]`; it adds pages to the dashboard, offers link actions, and reads and changes its data through its own package's command.
[2] link action: one verb a widget offers on any link a dashboard page shows, done by the widget package's own command.

## Business logic

The shell provides, around the whole dashboard, the services every widget's host is built from (`App.tsx`): open an agent's page; open a widget's page at a sub-path; start a run in a project with a prompt and the user's picks, and land on it; open a project's launcher with a prompt drafted in; and list a project's runs. A widget's host is those services plus the widget's package name; the two commands (`runCommand`, `act`) are bound to that package by whoever builds the host (`widget/index.ts`). Where no shell provides services — a component test rendering a page or the link-actions slot alone — inert services stand in: nothing navigates, a start answers "no dashboard to start a run from", and no project has runs.
