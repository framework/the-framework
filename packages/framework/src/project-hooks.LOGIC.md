A project's hooks [1]: the shell lines the project's own `.the-framework/hooks.yml` names to run when the dashboard opens and when it closes, and the runner that runs them in the project, one after another, bounded and logged. The daemon names no tool: whatever the file says runs. Per user, since `.the-framework/` is ignored by git: a hook is this machine's, and a teammate's pull changes nothing.

## Context

**User story**: the user writes `open: [npx agent-scheduler start]` and `close: [npx agent-scheduler stop --unless-keep-alive]` in the project's `.the-framework/hooks.yml`; the project's scheduler then starts whenever the dashboard does and stops when it closes, with nothing of the scheduler known to The Framework. A user with no such file sees nothing change.

**Problem**: the tool that starts agents on a schedule should follow the dashboard's life, but The Framework must not depend on it or name it; and a line a person wrote can fail, hang or be missing without keeping the dashboard from coming up or from closing.

## Glossary

[1] hooks: the shell lines a project's own `.the-framework/hooks.yml` names under `open` and `close`, run in the project by the daemon when the dashboard opens and closes.

## Business logic — TL;DR

- **The file** - `.the-framework/hooks.yml` at the project root: a YAML map with the keys `open` and `close`, each a list of shell lines; no file means no hooks; a document that is not such a map, an unknown key, or a list that is not all non-empty strings is refused as a whole and reported with "ignoring" in front, and counts as no hooks.
- **Running the lines** - the lines of one kind run in order, each through `sh -c` with the project's root as working directory and the daemon's environment; one line failing or timing out does not stop the next; a line is killed after one minute; nothing ever throws to the caller.
- **What is logged** - one line per hook line, "[framework] <open|close> hook (<project>): <line>: exit <code>", or "timed out after 60s", or "could not start: <why>", followed by whatever the line printed on stderr, indented; a refused file is logged once as the reason it was ignored; a missing file logs nothing.

## Business logic

### The file

#### Context

See `## Context`.

#### Business logic

The hooks file is `.the-framework/hooks.yml` at the project's root. A missing file is no hooks. The file is a YAML map with two keys, `open` and `close`, each a list of shell lines; either may be absent or empty, and each line is trimmed. An empty document is no hooks. A document that is not a map (a list, a bare value) is refused with "hooks.yml must be a YAML map with "open" and "close" lists"; a key other than `open` and `close` is refused with "unknown key "<key>"; the keys are open and close", rather than ignored, because a misspelled `open` would otherwise be a hook that silently never runs; a value that is not a list of non-empty strings is refused with ""<key>" must be a list of shell lines"; a document YAML cannot parse is refused with the parser's first line. A refusal discards the whole file, is reported to the caller's warning channel with "ignoring " in front, and counts as no hooks.

### Running the lines

#### Context

**Problem**: a hook line is a person's shell line; it may fail, hang, or name a program that is not there.

#### Business logic

The lines of one kind (`open` or `close`) run one after another, in the order written. Each runs through `sh -c` with the project's root as working directory and the daemon's own environment, its stdin and stdout dropped and its stderr collected. A line that exits non-zero, that is still running after one minute (it is then killed), or that could not be started at all is logged and the next line still runs. Running the hooks never throws to the caller.

### What is logged

#### Context

**Problem**: the daemon's console is where a person learns why the scheduler did not start.

#### Business logic

Each line is logged once it ends as "[framework] open hook (<project directory name>): <the line>: exit <code>", "…: killed by <signal>" when a signal ended it, "…: timed out after 60s" when the bound did, or "…: could not start: <why>" when it never ran; then every non-empty line the hook printed on stderr, each as "[framework]   <what it said>", since a tool's one line for a person goes there. A file that was refused is logged once as "[framework] <kind> hook (<project>): ignoring <why>". A missing file logs nothing.
