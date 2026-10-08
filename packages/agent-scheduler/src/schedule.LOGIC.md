The schedule [1]: how a skill's `schedule` [9], in the front matter of its `SKILL.md`, is read into commands [2], each with its interval [5], its check [3] or both, one plain line saying what its check waits for, its cap [4], what its skill says it does, and the skills folder its skill was read from; which skills of a project are read; how a skill's `schedule` that cannot be read is named rather than silently skipped; what a check's output must say for a command to be due; and the prompt a command runs with.

## Context

**User story**: the author of a skill meant to run unattended says in the front matter of its `SKILL.md` when it is due: `schedule:` with `when: npx queue` for work that is due while something is queued, with `every: 6h` for a routine that runs at most that often, with both for one that runs at most that often and only when its check finds work, and with one row [8] per mode for a skill with several (`word: quick` in the skill `triage` makes the command `triage quick`, the skill handed the word `quick`). A project that has the skill has its scheduled commands, the same on every machine that shares the repository, each switched off on a machine until a person switches it on there [6]. A typo in one skill's `schedule` stands down that skill's commands and is named in the state, while the other skills' commands still run.

**Business logic story**: the tool names no command of its own. A skill's front matter is where a command's name enters the system, and the skill is what runs: a skill that is not in the project has no command. The tick (`tick.ts`) runs the check and asks this file whether the output says due. A skill says when its command is due and how many may run at once, the same for every machine. Whether the command runs on one machine is that machine's schedule switch [6], and how far its runs publish there is that machine's publish pick [7]; both are a person's, set with `agent-scheduler switch` and `agent-scheduler publish` or from a dashboard, and kept in the tool's state. A skill's `schedule` says neither, and this file reads only what the skill says. The interval a skill gives is a starting pace: a person may set another for their own machine, their pace pick [10], with `agent-scheduler pace` or from a dashboard, and the tick follows the pace in force (`pace.ts`). Beside the `schedule` key, it reads one more key of the same front matter: `description`, what the skill says it does, which a dashboard shows beside each of the skill's commands. The body of the skill file, the prompt the coding agent reads, is not read here.

## Glossary

[1] the schedule: all the scheduled commands of a project, each brought by a skill of the project. A skill with no `schedule` key [9] brings none.
[2] command: a scheduled command, one command a skill schedules, named as a person types the command without its slash: the skill's folder name, then at most one word the skill takes as its argument (`triage quick`); the coding agent's harness expands the slash command `/<name>` from the skill's folder and hands the skill the word. Each name is its own command: its own prompt, switch, interval, cap and run records.
[3] check: the shell command a row [8] gives as `when`, run at the repository root on every tick; its output says whether the command is due.
[4] cap: how many runs of one command may be in flight at once, across every machine that shares the repository; the number a row [8] gives as `agents`, 1 when it gives none.
[5] interval: the `every` key of a row [8]: the least time since the command's last recorded start before it may start again, on a machine where no person set another pace.
[6] schedule switch: a person's choice, on one machine, whether a scheduled command runs there; kept in the tool's state (`.agent-scheduler/state.json`), not in the skill. Every scheduled command is off on a machine until a person switches it on there.
[7] publish pick: a person's choice, on one machine, of how far a scheduled command's runs publish there: `nothing`, `commit`, `branch`, `pr` or `merge`; kept in the state, not in the skill. It is `commit` until the person picks.
[8] row: one entry of a skill's `schedule` [9]: a YAML map of keys that makes one scheduled command.
[9] the skill's `schedule`, also the `schedule` key: the key `schedule` in the front matter of a skill's `SKILL.md`, where the skill says which commands it schedules. Its value is one row [8], or a list of rows.
[10] pace pick: a person's choice, on one machine, of a pace for one scheduled command there: "whenever there is work", or an interval with an optional time of day; kept in the state, not in the skill. A command with no pace pick runs at its skill's pace.

## Business logic — TL;DR

- **A skill's `schedule`** - the `schedule` key [9] holds one row [8] or a list of rows, each one command [2]. A row's keys, in any order: `every: <N><m|h|d|w|mo>`, `when: <check>`, `waits-for: <one line>`, `agents: <N>`, `word: <one word>`; at least one of `every` and `when`, and `waits-for` only beside `when`. The command's name is the skill's folder name, followed by the row's `word` when it has one. A row with no `agents` has a cap [4] of 1. Every command of the skill carries what the skill says it does, the front matter's `description`, when that is text. A skill with no `schedule` key, or a `SKILL.md` with no front matter, has no command.
- **Which skills are read** - every skill under `.claude/skills`, the folder the coding agent of scheduled runs reads, and then under `.agents/skills`, at the repository root; a skill in both folders is read once, from the first of the two that holds its `SKILL.md`; each command carries the folder its skill was read from; the skills in name order, a skill's rows in the order written.
- **An unreadable `schedule`** - an unknown key, a bad value, a row with neither `every` nor `when`, `waits-for` without `when`, two rows with one name, no row at all, or a front matter that is not YAML and holds a `schedule:` line, makes the skill's whole `schedule` unreadable: the skill gives no command and is kept aside with its name and the reason; the tick names the skill with `unreadable schedule: <reason>`.
- **Due** - the check's output, parsed as JSON, is something other than empty; output that is not JSON is due when non-blank. The interval [5] is the tick's to apply, from the run records, where no pace pick [10] stands in for it; a row with both keys starts only when both hold.
- **The prompt** - a command's prompt is its slash command, `/<name>`, the whole name; a run's prompt is counted under the scheduled command it names, else under its first word.

## Business logic

### A skill's `schedule`

#### Context

See `## Context`.

#### Business logic

A skill schedules commands with the `schedule` key [9] in the front matter of its `SKILL.md`: the YAML block between the file's first line, `---`, and the next `---` line. The value is one row [8] or a list of rows, and each row is one command [2]. A `SKILL.md` with no front matter, and a front matter with no `schedule` key, give no command and no complaint.

A row is a YAML map of these keys, in any order:

- `every` is the interval [5]: a whole number above zero and a unit of `m` (minutes), `h` (hours), `d` (days), `w` (weeks of 7 days) or `mo` (months of 30 days), written together (`15m`, `6h`, `7d`, `2w`, `1mo`). It is read by `pace.ts`'s rule, the same one a person's pace pick [10] is read by, and remembered as a duration and as written, without a leading zero, for the tick's line. A skill's `schedule` takes no time of day: only a pace pick does.
- `when` is the check [3]: a shell command line, surrounding whitespace removed. It is YAML text, so a check that holds quotes, commas or colons, or that spans several lines, is written as a block (`when: |-` and the lines under it) and is read as written.
- `waits-for` is one plain line for a person saying what the check waits for (`when the queue holds a task`), surrounding whitespace removed. A check is a shell line that nothing can turn into a sentence, so the skill says it. It says what `when` waits for, so a row has it only beside `when`. This file only carries the line; the package's dashboard part shows it.
- `agents` is the cap [4]: a whole number, 1 or more. A row naming none has a cap of 1.
- `word` is the one word the skill gets as its argument: lowercase letters, digits and dashes, starting with a letter or a digit.

A row needs at least one of `every` and `when`, else nothing says when its command runs. The command's name is the skill's folder name, and for a row with a `word` the folder name, one space and the word: the skill `triage` with the rows `word: quick` and `word: consensual` schedules two commands, `triage quick` and `triage consensual`, each with its own interval, cap, switch, pace pick and run records. A list may hold a row with a word beside a row without one (`triage` and `triage quick`). Each command also carries the skills folder its skill was read from (below).

Each command of a skill carries what the skill says it does: the `description` key of the same front matter, surrounding whitespace removed. It is the skill's, not a row's, so every command of the skill carries the same words. A skill with no `description`, a blank one, or one that is not text (a list) gives its commands none, and its `schedule` is read all the same. This file only carries the words; the package's dashboard part shows them.

A row says nothing about whether its command runs on a machine, or about how far its runs publish: each person sets both on their own machine [6] [7]. A key such as `off` or `publish` in a row is an unknown key, which makes the skill's `schedule` unreadable (below).

### Which skills are read

#### Context

**Problem**: a project keeps its skills in the folder its coding agent reads them from, `.claude/skills` for Claude Code and `.agents/skills` for Codex, often as one copy linked from the other folder. Each skill must be read once, wherever it is. And every scheduled run is on Claude Code, which expands a slash command only from a skill under `.claude/skills`: a command whose skill is only under `.agents/skills` would hand Claude Code a slash command it cannot expand.

#### Business logic

A project's schedule is read from two folders at the repository root, as they are on disk: first `.claude/skills`, the folder the coding agent of scheduled runs reads, and then `.agents/skills`. What one of these folders holds is a skill when its name is lowercase letters, digits and dashes, starting with a letter or a digit, and it holds a readable `SKILL.md`; a plain folder and a link to a folder read alike. Anything else there (a file, a folder with no `SKILL.md`, a name of another shape) is passed over without a complaint. A skill in both folders is read once, from the first of the two folders that holds its `SKILL.md`: its `.claude/skills` copy when there is one, else its `.agents/skills` copy. Each command carries the folder its skill was read from. A skill found only under `.agents/skills` still brings its commands to the schedule, so they are listed; the tick never starts them and says why (`tick.ts`). The skills are taken in name order, whichever folder each came from, and a skill's rows in the order written: that is the order of the schedule's commands. A project with neither folder schedules nothing. Reading a project always answers a schedule, which may hold no command.

### An unreadable `schedule`

#### Context

**Problem**: a typo (`evry: 6h`, `every: day`, a row with only `agents: 3`) must stand down that skill's commands and say so, rather than silently doing nothing, and a key the tool does not know must not be a rule it silently ignores. A skill that schedules nothing is none of this tool's business: a coding agent reads front matter more loosely than YAML does, so a skill whose front matter is not YAML may still work for the agent and must not be reported here.

#### Business logic

A skill's `schedule` is read as a whole: when one row cannot be read, the skill gives no command at all, not even from its readable rows. Each case has its reason:

- The front matter is not YAML and one of its lines starts with `schedule:`: `the front matter is not YAML`. A front matter that is not YAML and has no such line makes the skill one that schedules nothing, with no complaint.
- The `schedule` key has nothing after it, or an empty list: `the schedule lists no row`.
- A row is not a map of keys (`schedule: daily`): `a row is a list of keys`.
- A row holds a key other than the five: `unknown key <key>`.
- `word` is not one word of the shape above: `word is one word of lower-case letters, digits and dashes`.
- `every` has an unknown unit (`2y`), no unit (`15`) or a number of 0: `every is a number above 0 and a unit, m, h, d, w or mo (15m, 6h, 7d, 2w, 1mo)`. An `every` of 0 is refused rather than read as "always", which is the key being absent.
- `when` is not text, or is blank: `when is a shell command line`.
- `waits-for` is not text, is blank, or spans several lines: `waits-for is one line of text`.
- `agents` is not a whole number of 1 or more (`0`, `many`): `agents is a whole number, 1 or more`.
- A row has neither `every` nor `when`: `neither every nor when says when`.
- A row has `waits-for` and no `when`: `waits-for says what when waits for, and there is no when`.
- Two rows give the same command name: `two rows are named <name>`.

When the skill's `schedule` is a list of several rows, a reason about one row starts with that row's place in the list: `row 2: unknown key evry`. The skill is kept aside with its name and the reason, and the commands of the other skills still count. The tick writes one decision per such skill in the state, under the skill's name, with the outcome `unreadable schedule: <reason>`.

### Due

#### Context

**Problem**: every skill command prints JSON on stdout (`npx queue` prints the open entries as a JSON array), so a check should need no piping to say "there is work".

#### Business logic

A command is due when its check exited 0 and its output, surrounding whitespace removed, parsed as JSON, is something other than empty: `[]`, `{}`, `null`, `false`, `""`, `0` and no output at all are not due; a non-empty array, an object with at least one key, `true`, any other number and any other string are due. Output that is not JSON counts by its text: anything non-blank is due. A check that exited non-zero is not due either, but the tick reports that as `check failed: …` rather than `not due`.

### The prompt

#### Context

**Problem**: the coding agent's harness expands `/<name>` into the project's skill of that name, so the whole instruction for a run is that slash command.

#### Business logic

A command's prompt is `/<name>`, the whole name: `triage quick` runs as `/triage quick`, and the harness hands the skill the word. Nothing else is added: no system prompt, no framing. The other way round, a run's prompt, as its run record carries it, is counted under the scheduled command whose name it is without its slash (`/triage quick` → `triage quick`), so a run counts against that command's cap and interval whoever started it (the tick, a dashboard's launcher, `agent-runner run` in a shell; `records.ts`), else under its first word without the slash (`/triage` → `triage`, `/work-queue now` → `work-queue`, `Read the docs` → `Read`); in a project where no skill schedules a command, always the first word.
