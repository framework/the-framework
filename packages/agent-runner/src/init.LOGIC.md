Writes this tool's lines into a dashboard's hooks file, `.the-framework/hooks.yml` in the project, so the dashboard's check before a Start, the Start, and its answers to a run's question run through this tool. What `agent-runner init` runs. The writer takes any tool's lines, one-line keys and lists alike, so the scheduler's `init` writes its own lines (`open`, `close`, `offset`, `switch`) through it.

## Context

**User story**: the user adds a project in the dashboard; the launcher says the project has no start hook and to run `npx agent-runner init`; the user runs it in the project and Start works, with nothing typed into a file by hand.

**Business logic story**: the dashboard runs whatever lines the hooks file names and names no tool itself, so the tool writes its own lines. A project that wants another tool writes that tool's lines instead.

**Problem**: the file may already hold a person's lines, with their comments. Overwriting it would silently throw their setup away.

## Business logic — TL;DR

- **The lines** - `start`: `npx agent-runner run --detach "$PROMPT" ${DRIVER:+--driver "$DRIVER"} ${MODEL:+--model "$MODEL"} ${THEN:+--then "$THEN"}`; `resume`: `npx agent-runner run --detach --resume "$RUN_ID" ${TEXT:+"$TEXT"} ${ANSWER:+--answer "$ANSWER"}`; `check`: `npx agent-runner check ${DRIVER:+--driver "$DRIVER"}`; one line each.
- **Only where the dashboard is** - without a `.the-framework/` directory in the project nothing is written and the answer is `no-dashboard`: the dashboard makes the directory, and hides it from git, when the project is added.
- **A person's file is kept** - a one-line key already there keeps its line, whatever it says, and is named in `kept` when it differs from the tool's; a list gains the tool's line only when it lacks it; a key the tool writes as a list but the file holds as something else is kept; other keys and comments stay; no line wraps.
- **The answer** - the file, the keys that gained a line (`added`), and the ones kept. A second `init` adds nothing and writes nothing.
- **An unreadable file** - one YAML cannot parse, or that is not a map, is left as it is and the answer is `unreadable` with the parser's first line; an empty file, or one of comments only, reads as an empty map.
