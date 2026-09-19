The `logs` skill's widget [1] for the dashboard: one page, Logs, listing the recorded runs [2] of every project that has this package, each read with the same `logs` command an agent runs. The package exports it as `./dashboard` (`dist/dashboard/dashboard.js` and its stylesheet), which is how the dashboard finds it; the dashboard itself never names this package.

## Context

**User story**: the user clicks Logs in the dashboard's sidebar and sees every run agents made on their projects, newest first: how each ended, what was asked, the branch, the pull request, the cost, when it started. A click opens the run's own page. A project that does not depend on this package shows no runs here, and a dashboard with no project depending on it shows no Logs row at all.

## Glossary

[1] widget: a browser module one of a project's packages brings to the dashboard, named by the package's `exports["./dashboard"]`; it adds pages to the dashboard and reads its data through its own package's command.
[2] run: the `logs` skill's record of one agent on the `agent-data` branch: a card and a diary. Never the unit of work.

## Business logic — TL;DR

- **The widget's definition** (`index.tsx`) - one page at `/logs`, labelled Logs with a scroll icon, and the stylesheet beside the module.
- **The Logs page** (`LogsPage.tsx`) - each project's newest 50 runs from `logs --limit 50`, merged newest first, a failing project named with the command's reason, a row opening the run's page.
- **Built to share, not to bundle** (`vite.config.ts`, `dashboard.css`, `tsconfig.json`) - the module leaves React and `framework/widget` as bare imports the dashboard supplies, and its stylesheet holds only its own utilities, coloured by the dashboard's theme file; these files carry no business logic beyond that.
