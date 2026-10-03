Writes this tool's lines into a dashboard's hooks file, `.the-framework/hooks.yml` in the project, so the dashboard's check before a Start, the Start, and its answers to a run's question run through this tool. What `agent-runner init` runs, which is also what the dashboard runs when a project is added: the package declares `"framework": { "hooks": "agent-runner" }` in its `package.json`. The writer takes any tool's lines, one-line keys and lists alike, so the scheduler's `init` writes its own lines (`open`, `close`) through it.

## Context

**User story**: the user adds a project in the dashboard, an empty folder included, and Start works, with nothing typed into a file by hand and no command run. A user who deleted the lines runs `agent-runner init` in the project to get them back.

**Business logic story**: the dashboard runs whatever lines the hooks file names and holds no copy of any tool's lines, so the tool writes its own: the dashboard runs `init` of every package that declares it writes hook lines when a project is added. A project that wants another tool writes that tool's lines instead. The lines name the tool bare, with no `npx`: the dashboard runs a line with the project's installed tools first and then its built-in packages', this tool among them, so nothing is downloaded from npm to run a line.

**Problem**: the file may already hold a person's lines, with their comments. Overwriting it would silently throw their setup away.

## Business logic — TL;DR

- **The lines** - `start`: `agent-runner run --detach "$PROMPT" ${DRIVER:+--driver "$DRIVER"} ${MODEL:+--model "$MODEL"} ${THEN:+--then "$THEN"} ${PUBLISH:+--publish "$PUBLISH"}`; `resume`: `agent-runner run --detach --resume "$RUN_ID" ${TEXT:+"$TEXT"} ${ANSWER:+--answer "$ANSWER"}`; `check`: `agent-runner check ${DRIVER:+--driver "$DRIVER"}`; one line each.
- **Only where the dashboard is** - without a `.the-framework/` directory in the project nothing is written and the answer is `no-dashboard`: the dashboard makes the directory, and hides it from git, when the project is added.
- **A person's file is kept** - a one-line key already there keeps its line, whatever it says, and is named in `kept` when it differs from the tool's; a list gains the tool's line only when it lacks it; a key the tool writes as a list but the file holds as something else is kept; other keys and comments stay; no line wraps.
- **The answer** - the file, the keys that gained a line (`added`), and the ones kept. A second `init` adds nothing and writes nothing.
- **An unreadable file** - one YAML cannot parse, or that is not a map, is left as it is and the answer is `unreadable` with the parser's first line; an empty file, or one of comments only, reads as an empty map.
