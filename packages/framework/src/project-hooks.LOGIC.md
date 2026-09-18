A project's hooks [1]: the shell lines the project's own `.the-framework/hooks.yml` names to run when the dashboard opens and when it closes, the two lines that start an agent [2] and continue an ended one, the line that sets the project's spend offset [3], and the runner that runs them in the project, bounded. The daemon names no tool: whatever the file says runs. Per user, since `.the-framework/` is ignored by git: a hook is this machine's, and a teammate's pull changes nothing.

## Context

**User story**: the user writes `open: [npx agent-scheduler start]` and `close: [npx agent-scheduler stop --unless-keep-alive]` in the project's `.the-framework/hooks.yml`; the project's scheduler then starts whenever the dashboard does and stops when it closes, with nothing of the scheduler known to The Framework. A user with no such file sees nothing change. The user also writes `start: npx agent-scheduler run --detach "$PROMPT" --driver "$DRIVER"` and a `resume:` line; pressing Start in the dashboard then runs that line, and answering an ended agent's question runs the other, still with nothing of the tool known to The Framework. Likewise `offset: npx agent-scheduler offset -- "$POINTS"`: moving the usage panel's handle runs that line, and the project's scheduler then starts unattended work up to the new line (the `--` keeps a negative value from being read as an option).

**Problem**: the tool that starts agents on a schedule should follow the dashboard's life, but The Framework must not depend on it or name it; and a line a person wrote can fail, hang or be missing without keeping the dashboard from coming up or from closing.

## Glossary

[1] hooks: the shell lines a project's own `.the-framework/hooks.yml` names: the `open` and `close` lists, run in the project by the daemon when the dashboard opens and closes, and the `start`, `resume` and `offset` lines, one shell line each, run when the user starts an agent, continues an ended one, or sets the spend offset.
[2] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch. The Framework starts none itself: the tool the project's start hook names runs it, and the dashboard shows it from the files that tool keeps.
[3] spend offset: the user's adjustment of the quota boundary, in percentage points of the week: how far past it unattended work may start. Each project's scheduler holds its own, as `spendOffset` in its state file.

## Business logic — TL;DR

- **The file** - `.the-framework/hooks.yml` at the project root: a YAML map with the keys `open` and `close`, each a list of shell lines, and `start`, `resume` and `offset`, each one shell line; no file means no hooks; a document that is not such a map, an unknown key, or a list that is not all non-empty strings is refused as a whole and reported with "ignoring" in front, and counts as no hooks.
- **Running the lines** - the lines of one kind run in order, each through `sh -c` with the project's root as working directory and the daemon's environment; one line failing or timing out does not stop the next; a line is killed after one minute; nothing ever throws to the caller.
- **The start and resume lines** - one line each, run with the user's input in its environment; the line answers one JSON document on stdout whose `id` names the agent; no line, a failing line, a line that answers no id and a line that hangs are each an error in words.
- **The offset line** - one line, run with the points in `POINTS`; exit 0 is done; no line is an error marked as "no hook", so a caller can skip the project; a broken file, a failing line and a line that hangs are each an error in words.
- **What is logged** - one line per hook line, "[framework] <open|close> hook (<project>): <line>: exit <code>", or "timed out after 60s", or "could not start: <why>", followed by whatever the line printed on stderr, indented; a refused file is logged once as the reason it was ignored; a missing file logs nothing.

## Business logic

### The file

#### Context

See `## Context`.

#### Business logic

The hooks file is `.the-framework/hooks.yml` at the project's root. A missing file is no hooks. The file is a YAML map with five keys: `open` and `close`, each a list of shell lines, and `start`, `resume` and `offset`, each one non-empty shell line; any may be absent or empty, and each line is trimmed. An empty document is no hooks. A document that is not a map (a list, a bare value) is refused with "hooks.yml must be a YAML map; the keys are open, close, start, resume and offset"; any other key is refused with "unknown key "<key>"; the keys are open, close, start, resume and offset", rather than ignored, because a misspelled `open` would otherwise be a hook that silently never runs; an `open` or `close` value that is not a list of non-empty strings is refused with ""<key>" must be a list of shell lines"; a `start`, `resume` or `offset` value that is not one non-empty string is refused with ""<key>" must be one shell line"; a document YAML cannot parse is refused with the parser's first line. A refusal discards the whole file, is reported to the caller's warning channel with "ignoring " in front, and counts as no hooks.

### Running the lines

#### Context

**Problem**: a hook line is a person's shell line; it may fail, hang, or name a program that is not there.

#### Business logic

The lines of one kind (`open` or `close`) run one after another, in the order written. Each runs through `sh -c` with the project's root as working directory and the daemon's own environment, its stdin and stdout dropped and its stderr collected. A line that exits non-zero, that is still running after one minute (it is then killed), or that could not be started at all is logged and the next line still runs. Running the hooks never throws to the caller.

### The start and resume lines

#### Context

**User story**: the user presses Start and the new agent [2] opens at once; the user answers the question an ended agent waits on, or writes to an ended agent, and the same agent goes on.

**Problem**: the daemon must learn the agent's id the moment the line returns, and must tell the user why when there is no agent.

#### Business logic

The `start` line runs like an `open` line (through `sh -c`, in the project's root, with the daemon's environment, killed after one minute) with three variables added: `PROMPT`, the user's prompt; `DRIVER`, the coding agent the user picked; `MODEL`, the model the user picked. `DRIVER` and `MODEL` are set only when the pick was made, so the line's own defaults apply otherwise. The `resume` line gets `RUN_ID`, the agent's id, and either `TEXT`, the user's words, or `ANSWER`, the labels the user chose for the agent's question. Either line's stdout is read as one JSON document; when the line exits 0 and the document's `id` is a non-empty string, that id is the answer. Otherwise the answer is an error in words: "this project has no start hook" (or "… no resume hook") when the file has no such line; the reason the file was ignored when it is broken; "the start hook: <the last non-empty line the line printed on stderr>" when the line failed, since a tool's one line for a person goes there; "the start hook: it answered no run id" when it exited 0 without an id; "the start hook: timed out after 60s", "exit <code>" or "could not start: <why>" when it said nothing. Nothing is logged for these two lines: the outcome goes to the user who clicked.

### The offset line

#### Context

**User story**: the user drags the usage panel's handle, or types a number in Settings → Automation → "Spend offset", and every project's scheduler takes the new spend offset [3] (`dashboard-rpc/quota.ts` runs the line in each project).

**Problem**: the scheduler keeps the spend offset in its own state, and The Framework must not name the tool that does; the line is the project's, like the start line.

#### Business logic

The `offset` line runs like an `open` line (through `sh -c`, in the project's root, with the daemon's environment, killed after one minute) with one variable added: `POINTS`, the spend offset [3] in percentage points, as a decimal number that may be negative or fractional ("-12.5"). Exit 0 is done; the line's stdout is not read. Otherwise the answer is an error in words: "this project has no offset hook" when the file has no such line, marked as "no hook" so the caller can tell a project that opted out from one that failed; the reason the file was ignored when it is broken (not marked as "no hook"); "the offset hook: <the last non-empty line the line printed on stderr>" when the line failed; "the offset hook: timed out after 60s", "exit <code>" or "could not start: <why>" when it said nothing. Nothing is logged for this line: the outcome goes to the user who moved the handle.

### What is logged

#### Context

**Problem**: the daemon's console is where a person learns why the scheduler did not start.

#### Business logic

Each line is logged once it ends as "[framework] open hook (<project directory name>): <the line>: exit <code>", "…: killed by <signal>" when a signal ended it, "…: timed out after 60s" when the bound did, or "…: could not start: <why>" when it never ran; then every non-empty line the hook printed on stderr, each as "[framework]   <what it said>", since a tool's one line for a person goes there. A file that was refused is logged once as "[framework] <kind> hook (<project>): ignoring <why>". A missing file logs nothing.
