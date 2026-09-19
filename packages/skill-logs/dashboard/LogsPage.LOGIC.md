The Logs page: the recorded runs [1] of every project that has this package, newest first.

## Context

**User story**: the user opens Logs and scans what agents did lately across their projects; a failed run stands out in red, and a click opens its page, where the dashboard replays what the agent said.

## Glossary

[1] run: the `logs` skill's record of one agent on the `agent-data` branch: a card and a diary. Never the unit of work.

## Business logic

For each project the dashboard lists as having this package, the page asks the dashboard to run `logs --limit 50` in that project: the newest 50 runs, exactly what `npx logs --limit 50` prints there. It reads again every minute, since each read fetches origin's copy of the records branch and a run lands only when it ends. The runs of all projects are merged and sorted by start time, newest first. A project whose command fails, or prints something that is not a list, is named in red with the reason ("Could not read the runs of `<project>`: `<reason>`"), and the other projects' runs still show. Once read, with no run and no failure, the page says "No runs recorded yet."

Each row shows the run's status, coloured (running, done, stopped, failed, waiting); what was asked, or the run's id when nothing was; its project, only when the page lists more than one project; its branch; its pull request as `#<number>`, linking to the pull request in a new tab without opening the run; its cost in dollars; and when it started, relative to now, with the exact time on hover. Clicking a row opens that run's page in the dashboard.
