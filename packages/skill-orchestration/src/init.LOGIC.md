Writes this tool's line into a dashboard's hooks file, `.the-framework/hooks.yml` in the project, so the dashboard's Settings → Subagents saves the person's subagent settings [1] through this tool. What `orchestration init` runs. The writer is `agent-runner`'s, and this tool hands it its own line.

## Context

**User story**: the user adds a project in the dashboard and runs `npx orchestration init` in it; from then on a pick in Settings → Subagents reaches that project's settings, with nothing typed into a file by hand.

**Business logic story**: the dashboard runs whatever line the hooks file names and names no tool itself, so the tool writes its own line.

**Problem**: the file may already hold a person's lines, with their comments. Overwriting it would silently throw their setup away.

## Glossary

[1] subagent settings: the person's choice, on one machine, of the coding agent and model a task the main agent calls simple runs on, the same for a task it calls hard, and how many of one main agent's subagents run at once (`settings.ts`).

## Business logic — TL;DR

- **The line** - `subagents`: `npx orchestration settings "$SUBAGENTS"`, the dashboard putting the settings as one JSON value in `SUBAGENTS`.
- **Only where the dashboard is** - without a `.the-framework/` directory in the project nothing is written and the answer is `no-dashboard`: the dashboard makes the directory when the project is added.
- **A person's file is kept** - `agent-runner`'s writer's rule: a `subagents` line already there keeps its line, whatever it says, and is named in `kept` when it differs from this tool's; other keys and comments stay.
- **The answer** - the file, the keys that gained a line (`added`), and the ones kept. A second `init` adds nothing.
- **An unreadable file** - one YAML cannot parse, or that is not a map, is left as it is and the answer is `unreadable` with the parser's first line.
