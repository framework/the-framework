Writes this tool's lines into a dashboard's hooks file, `.the-framework/hooks.yml` in the project, so the dashboard's check before a Start, the Start, its answers to a run's question, its opening and closing, and its spend-offset slider run through this tool. What `agent-scheduler init` runs.

## Context

**User story**: the user adds a project in the dashboard; the launcher says the project has no start hook and to run `npx agent-scheduler init`; the user runs it in the project and Start works, with nothing typed into a file by hand.

**Business logic story**: the dashboard runs whatever lines the hooks file names and names no tool itself, so the tool writes its own lines. A project that wants another tool writes that tool's lines instead.

**Problem**: the file may already hold a person's lines, with their comments. Overwriting it would silently throw their setup away.

## Business logic — TL;DR

- **The lines** - `open`: `npx agent-scheduler start`; `close`: `npx agent-scheduler stop --unless-keep-alive`; `start`: `npx agent-scheduler run --detach "$PROMPT" ${DRIVER:+--driver "$DRIVER"} ${MODEL:+--model "$MODEL"}`; `resume`: `npx agent-scheduler run --detach --resume "$RUN_ID" ${TEXT:+"$TEXT"} ${ANSWER:+--answer "$ANSWER"}`; `check`: `npx agent-scheduler check ${DRIVER:+--driver "$DRIVER"}`; `offset`: `npx agent-scheduler offset -- "$POINTS"`. `open` and `close` are lists, the others one line each.
- **Only where the dashboard is** - without a `.the-framework/` directory in the project nothing is written and the answer is `no-dashboard`: the dashboard makes the directory, and hides it from git, when the project is added.
- **A person's file is kept** - a one-line key already there keeps its line, whatever it says, and is named in `kept` when it differs from this tool's; a list gains this tool's line only when it lacks it; other keys and comments stay; no line wraps.
- **The answer** - the file, the keys that gained a line (`added`), and the ones kept. A second `init` adds nothing and writes nothing.
- **An unreadable file** - one YAML cannot parse, or that is not a map, is left as it is and the answer is `unreadable` with the parser's first line.
