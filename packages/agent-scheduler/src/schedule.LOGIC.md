The schedule [1]: how `agent-schedule.md` is read into commands [2], each with its interval [5], its check [3] or both, its cap [4], and whether it runs where nobody switched it [6]; which lines are the person's and not read; how a line that cannot be read is named rather than silently skipped; what a check's output must say for a command to be due; and the prompt a command runs with.

## Context

**User story**: the user writes one line per command they want run unattended, `- work-queue: when \`npx queue\`, cap 1` for work that is due while something is queued, `- triage quick: every 6h` for a routine that runs at most that often, its skill `triage` handed the word `quick`, `- update-tickets: every 1h, when \`npx tickets meta | jq …\`` for one that runs at most hourly and only when the tracker has news, `- post-merge-cleanup: every 1d, off` for one that runs only on a machine where a person switched it on [6], commits the file, and every machine sharing the repository runs the same schedule; a typo on one line stands down that one command and is named in the state, while the other lines still run.

**Business logic story**: the tool names no command of its own. This file is where a command's name enters the system, and `.claude/skills/<name>` in the project is what runs. The tick (`tick.ts`) runs the check and asks this file whether the output says due. The file is tracked, so it is the team's default for every machine; whether a command runs on one machine is that machine's schedule switch [6], set with `agent-scheduler switch` or from a dashboard, and the line's `off` only sets the default the other way, for a command not every machine should run on its own (a clean-up after merges, say).

## Glossary

[1] the schedule: `agent-schedule.md` at the repository root, tracked, written by a person: one list line per command. Every other line is the person's and is not read.
[2] command: a schedule line's name, written as a person types the command without its slash: the name of a skill folder tracked in the project under `.claude/skills/`, then at most one word the skill takes as its argument (`triage quick`); the coding agent's harness expands the slash command `/<name>` from the folder and hands the skill the word. Each name is its own command: its own prompt, switch, interval, cap and run records.
[3] check: the shell command a schedule line puts after `when`, run at the repository root on every tick; its output says whether the command is due.
[4] cap: how many runs of one command may be in flight at once, across every machine that shares the repository; 1 when the line names none.
[5] interval: the `every` clause of a schedule line: the least time since the command's last recorded start before it may start again.
[6] schedule switch: a person's choice, on one machine, whether a scheduled command runs there; kept in the tool's state (`.agent-scheduler/state.json`), not in the schedule. The schedule line is the default where nobody switched the command.

## Business logic — TL;DR

- **A schedule line** - `- <name>:` then clauses in any order, each at most once: `every <N>m|h|d`, `when \`<check>\``, `cap <N>`, `off`; at least one of `every` and `when`; the name is a folder name of lowercase letters, digits and dashes, optionally followed by one space and one more such word, the skill's argument; a missing cap reads as 1, as does 0; `off` makes the command run only where a machine switched it on [6]; an `every` of 0, an unknown unit, a clause twice or a word the parser does not know make the line unreadable.
- **What is not read** - headings, blank lines, prose: anything not starting a list item is the person's.
- **An unreadable list line** - kept aside with its line number and text; the tick names it as `line N` with `unreadable: <text>`.
- **Due** - the check's output, parsed as JSON, is something other than empty; output that is not JSON is due when non-blank. The interval [5] is the tick's to apply, from the run records; a line with both clauses starts only when both hold.
- **The prompt** - a command's prompt is its slash command, `/<name>`, the whole name; the folder the command runs is the name's first word.

## Business logic

### A schedule line

#### Context

See `## Context`.

#### Business logic

A list line, one starting with `- `, names one command: `- <name>:` followed by clauses separated by commas outside backticks, in any order, each at most once. The name is a skill folder's name, one or more lowercase letters, digits and dashes starting with a letter or a digit, optionally followed by exactly one space and one more such word, the argument the skill gets: `triage quick` and `triage consensual` are two commands of one folder, each with its own pace, cap, switch and run records. Two words after the folder, two spaces, or a space before the colon make the line unreadable. `every <N><unit>` is the interval [5], a whole number above zero and a unit of `m` (minutes), `h` (hours) or `d` (days), remembered as a duration and as written (`6h`) for the tick's line. `when \`<check>\`` is the check [3], the text between the backticks, surrounding whitespace removed, a shell command line; a comma inside the backticks belongs to the check. `cap <N>` is the cap [4]: a line naming none has a cap of 1, and a cap of 0 reads as 1, since zero would spell "never", which is the line being absent. `off` says the command runs only on a machine where a person switched it on [6]; a line without it runs on every machine where nobody switched it off. A line needs at least one of `every` and `when`, else nothing says when it runs: `off` alone is unreadable. An `every` of 0 is refused rather than read as "always", which is the clause being absent; an unknown unit (`2w`), a clause given twice, and a word the parser does not know (`always`, `every day`) each make the line unreadable. Each command remembers the file's line number it came from, for a message. A file with no schedule at all (no `agent-schedule.md` at the repository root) is read as no schedule, which the tick reports as `no agent-schedule.md`.

### What is not read

#### Context

**Problem**: the file is a person's markdown, with a heading and whatever prose they want around the list.

#### Business logic

Only lines that start a list item (`- `) are read. Headings, blank lines and prose are left alone and never produce a command or a complaint.

### An unreadable list line

#### Context

**Problem**: a typo (`- Work Queue: every day`, `- triage: cap 3` with neither an interval nor a check, `- plan: when npx plan` with no backticks) must stand down that one command and say so, rather than silently doing nothing.

#### Business logic

A list line that does not read as a schedule line is kept aside with its line number and its text, surrounding whitespace removed, and the readable lines still count. The tick writes one decision per such line in the state, under the name `line <N>`, with the outcome `unreadable: <the line's text>`.

### Due

#### Context

**Problem**: every skill command prints JSON on stdout (`npx queue` prints the open entries as a JSON array), so a check should need no piping to say "there is work".

#### Business logic

A command is due when its check exited 0 and its output, surrounding whitespace removed, parsed as JSON, is something other than empty: `[]`, `{}`, `null`, `false`, `""`, `0` and no output at all are not due; a non-empty array, an object with at least one key, `true`, any other number and any other string are due. Output that is not JSON counts by its text: anything non-blank is due. A check that exited non-zero is not due either, but the tick reports that as `check failed: …` rather than `not due`.

### The prompt

#### Context

**Problem**: the coding agent's harness expands `/<name>` into the project's `.claude/skills/<name>`, so the whole instruction for a run is that slash command.

#### Business logic

A command's prompt is `/<name>`, the whole name as written: `triage quick` runs as `/triage quick`, and the harness hands the skill the word. The folder the command runs is the name's first word. Nothing else is added: no system prompt, no framing.
