What the tests cover, with every reading injected (the wiring to a real project is `scheduler.ts`'s):

- **A start** - a due command under its cap with quota to spare gets a running marker (the prompt `/<command>`, the state's model, the mark with the command and this host), is spawned with the same id, and the decision is `started <id>` with the run's id.
- **An interval** - a command never started is due and its check decides; a start younger than the interval is `not due (last start 2h ago, every 6h)` (`1m` for a minute) with no check run and no marker written; a start older than the interval is due again.
- **A schedule switch** - with nobody switching, a line listed `off` is `switched off on this machine` while the other command starts, and the tick records the schedule as the lines say it (name, check or interval, `on`); with this machine switching the first command off and the `off` line on, the first is `switched off on this machine` and the other starts, and no check runs for the command switched off.
- **Off** - the pull and the sweep still run, no check runs, the note is `off`.
- **A failed pull** - the note is `agent-data could not be pulled: <error>` and nothing is spawned.
- **No schedule** - the note is `no agent-schedule.md`.
- **The order of the checks** - `no such command in this project` runs no check; `check failed: <last stderr line>`; `not due`; `cap reached (1 in flight: <id> on <host>)` without reading the quota or writing a marker; `quota: <window> is 90% used, at or past day 4 of the week's N%` with nothing spawned.
- **A coding agent that cannot start** - with two due commands, each decision is `not ready: <the problem>`, the readiness is read once, the quota is not read and no marker is written; a command at its cap is decided before the readiness is read.
- **An unreadable quota** - `quota: the quota could not be read, so there is no way to tell what is spare`.
- **Two machines** - a marker ranked past the cap by an earlier id that landed meanwhile is withdrawn with `cap reached (…)` naming the other; with a cap of two the marker within the cap keeps its place; a marker whose push failed twice is withdrawn with `another machine got there first: …` and nothing spawned.
- **Unreadable schedule lines** - named as `line N` with `unreadable: …` while the readable command still starts.
- **One quota read per tick** - two commands start on one reading.
- **A stop during the tick** - a tick told the scheduler was stopped writes no marker and spawns nothing, with the line `not started: the scheduler was stopped`; the readings before it still ran.
