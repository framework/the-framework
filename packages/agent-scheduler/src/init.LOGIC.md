Writes this tool's lines into a dashboard's hooks file, `.openagent/hooks.yml` in the project, so the dashboard's opening starts the scheduler and its closing stops it. What `agent-scheduler init` runs. The spend cushion, the schedule switches, the pace picks, the agents picks and the publish picks are no hook lines: the package's own dashboard part (`../dashboard/`) saves them through this tool's command line. The lines that check, start and continue a run are `agent-runner`'s, written by `agent-runner init`; the writer is `agent-runner`'s too, and this tool hands it its own lines.

## Context

**User story**: the user adds a project in the dashboard and runs `npx agent-scheduler init` in it; from then on the project's scheduler starts whenever the dashboard opens and stops when it closes (unless it keeps alive), with nothing typed into a file by hand.

**Business logic story**: the dashboard runs whatever lines the hooks file names and names no tool itself, so the tool writes its own lines. A project that wants another tool writes that tool's lines instead.

**Problem**: the file may already hold a person's lines, with their comments. Overwriting it would silently throw their setup away.

## Business logic — TL;DR

- **The lines** - `open`: `npx agent-scheduler start`; `close`: `npx agent-scheduler stop --unless-keep-alive`. Both are lists; nothing else is written.
- **Only where the dashboard is** - without a `.openagent/` directory in the project nothing is written and the answer is `no-dashboard`: the dashboard makes the directory, and hides it from git, when the project is added.
- **A person's file is kept** - `agent-runner`'s writer's rule: a one-line key already there keeps its line, whatever it says, and is named in `kept` when it differs from this tool's; a list gains this tool's line only when it lacks it; other keys and comments stay; no line wraps.
- **The answer** - the file, the keys that gained a line (`added`), and the ones kept. A second `init` adds nothing and writes nothing.
- **An unreadable file** - one YAML cannot parse, or that is not a map, is left as it is and the answer is `unreadable` with the parser's first line.
