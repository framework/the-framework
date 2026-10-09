The schedule [1]: how a skill's `schedule` [9], in the front matter of its `SKILL.md`, is read into commands [2], each with its interval [5], its check [3] or both, one plain line saying what its check waits for, its cap [4], what its skill says it does, and the skills folder its skill was read from; which skills of a project are read; which commands are marked as an automation [14] the tool can show, save again and remove; how the automations kept on this machine [14] are read after them, each one command carrying its text, which a run is handed with its prompt; the path of the file a command's skill is; how a skill's `schedule` that cannot be read is named rather than silently skipped; what a check's output must say for a command to be due; how the time a check is given as `$LAST_RUN` is written; the prompt a command runs with; the attached text [12] a run is handed when a check started it; and the attached text a run of an automation kept on this machine is handed, its text first.

## Context

**User story**: the author of a skill meant to run unattended says in the front matter of its `SKILL.md` when it is due: `schedule:` with `when: npx queue` for work that is due while something is queued, with `every: 6h` for a routine that runs at most that often, with both for one that runs at most that often and only when its check finds work, and with one row [8] per mode for a skill with several (`word: quick` in the skill `triage` makes the command `triage quick`, the skill handed the word `quick`). A check that looks for what is new, new comments for instance, asks for what came in since `$LAST_RUN`, the time its command last started, or was switched on on that machine when that is later: once a run was started for what the check found, the check goes quiet until something newer comes in. A project that has the skill has its scheduled commands, the same on every machine that shares the repository, each switched off on a machine until a person switches it on there [6]. A typo in one skill's `schedule` stands down that skill's commands and is named in the state, while the other skills' commands still run.

**User story**: a person saved an automation kept on this machine [14], `watch-competitor`, every hour. Its command is listed after the commands of the project's skills, on their machine only, and a run of it is handed the text they typed. Later a teammate adds a skill named `watch-competitor` to the project. From then on the person is told that their automation is not listed, and to rename or remove its file. While both are there, the skill's `watch-competitor` commands are not listed on their machine either, so the skill never starts on the switch they gave their own automation. What they gave the automation on this machine, its switch and its picks, is taken back at once, so whatever is listed under the name afterwards starts switched off.

**Business logic story**: the tool names no command of its own. A skill's front matter is where a command's name enters the system, and the skill is what runs: a skill that is not in the project has no command. That holds for a shared automation [14] too: it is saved as a skill file (`automation.ts`), and this file reads it like any other, and marks its command while that file still reads as the tool wrote it ("An automation the tool can save again", below). An automation kept on this machine [14] is the one command that is no skill's: it is the same file, saved in the tool's own folder, read here with the same reader, and what runs is its text, which this file reads and a run is handed with its prompt, the automation's name. Before an automation of either kind is saved, its file is read with this file's reader, and it is refused with the reader's reason when its `schedule` cannot be read, so what is saved is what the tick reads. The tick (`tick.ts`) runs the check, giving it the time it asks from as `$LAST_RUN`, written as this file says, and asks this file whether the output says due. A skill says when its command is due and how many may run at once, the same for every machine. Whether the command runs on one machine is that machine's schedule switch [6], and how far its runs publish there is that machine's publish pick [7]; both are a person's, set with `agent-scheduler switch` and `agent-scheduler publish` or from a dashboard, and kept in the tool's state. A skill's `schedule` says neither, and this file reads only what the skill says. The interval a skill gives is a starting pace: a person may set another for their own machine, their pace pick [10], with `agent-scheduler pace` or from a dashboard, and the tick follows the pace in force (`pace.ts`). The tick starts a run of a skill's command only when the command's skill is on the start point [13] (`tick.ts`, `start-point.ts`), and looks there for the skill's file, whose path this file gives; it asks no such thing of an automation kept on this machine, whose text is in no checkout. Beside the `schedule` key, it reads one more key of the same front matter: `description`, what the skill says it does, which a dashboard shows beside each of the skill's commands. The body of a skill's file, the prompt the coding agent reads, is not read here. The body of an automation kept on this machine is: a run is handed it.

## Glossary

[1] the schedule: all the scheduled commands of a project: those the skills of the project bring, then the automations kept on this machine [14], one command each. A skill with no `schedule` key [9] brings none.
[2] command: a scheduled command, one command a skill schedules, named as a person types the command without its slash: the skill's folder name, then at most one word the skill takes as its argument (`triage quick`); the coding agent's harness expands the slash command `/<name>` from the skill's folder and hands the skill the word. Each name is its own command: its own prompt, switch, interval, cap and run records. An automation kept on this machine [14] is a scheduled command too, named as its file, with no word after the name: no skill schedules it, and a run of it has that name as its prompt, with no slash, and is handed its text with it. Its runs are counted on this machine alone.
[3] check: the shell command a row [8] gives as `when`, run at the repository root on every tick; its output says whether the command is due. It may read `$LAST_RUN`: the time of its command's last start, or the time the command was switched on on this machine when that is later.
[4] cap: how many runs of one scheduled command a machine lets be in flight at once: the machine starts another run of the command only while fewer than its number are in flight on any machine that shares the repository. Its number is the agents pick [11] made on it, a person's own number for the command there, else the number the command's skill gives, 1 when the skill gives none. The skill gives its number as `agents` in a row [8].
[5] interval: the `every` key of a row [8]: the least time since the command's last start before it may start again, on a machine where no person set another pace.
[6] schedule switch: a person's choice, on one machine, whether a scheduled command runs there; kept in the tool's state (`.agent-scheduler/state.json`), not in the skill. Every scheduled command is off on a machine until a person switches it on there. A switch that is on holds the time it was switched on.
[7] publish pick: a person's choice, on one machine, of how far a scheduled command's runs publish there: `nothing`, `commit`, `branch`, `pr` or `merge`; kept in the state, not in the skill. It is `commit` until the person picks.
[8] row: one entry of a skill's `schedule` [9]: a YAML map of keys that makes one scheduled command.
[9] the skill's `schedule`, also the `schedule` key: the key `schedule` in the front matter of a skill's `SKILL.md`, where the skill says which commands it schedules. Its value is one row [8], or a list of rows.
[10] pace pick: a person's choice, on one machine, of a pace for one scheduled command there: "whenever there is work", or an interval with an optional time of day; kept in the state, not in the skill. A command with no pace pick runs at its skill's pace.
[11] agents pick: a person's choice, on one machine, of that machine's number for one scheduled command: the machine starts another run of the command only while fewer than that number are in flight on any machine that shares the repository. A whole number from 1 to 99; kept in the state, not in the skill. A command with no agents pick has its skill's number.
[12] attached text: a text handed to a run's agent with the run's first prompt, apart from the prompt (`agent-runner run --attach`): the agent reads it after the prompt, and no later prompt of the run carries it. A run that a check started is handed what the check printed this way. A run of an automation kept on this machine [14] is handed the automation's text this way, before what its check printed.
[13] start point: the commit a scheduled run's checkout starts from: origin's default branch (`origin/main`), or, in a repository with no remote, the commit the person's own checkout is on (`HEAD`). Never the files in a person's own checkout: a skill written there and not committed, or committed and not yet on origin's default branch, is not on the start point.
[14] automation: a person's own prompt saved as a scheduled command [2], with the `schedule` [9] the person picked, an interval [5], a check [3] or both. Written by `agent-scheduler add` or the "New automation" form of the Automations page, as one of two kinds, the person's choice. While its file reads as the tool writes one, the tool shows it, saves it again under its name and removes it (`agent-scheduler show`, `edit` and `remove`, or "Edit prompt" and "Remove" on the Automations page); an automation whose file was changed by hand into something the tool does not write is edited and removed by hand. A shared automation is a command skill of the project (a skill run as the slash command `/<name>`, never picked up by the coding agent on its own): the file `.claude/skills/<name>/SKILL.md`, whose text is the prompt and whose front matter carries that `schedule`; the person commits it, and from then on it is a skill like any other, and its command a scheduled command like any other. An automation kept on this machine is one file written the same way, `.agent-scheduler/automations/<name>.md`, in the tool's own folder, which is hidden from git: nothing is to commit and nobody else gets its command, though its text is in the record of each of its runs, which is shared where the project shares its records. It is no skill and no slash command: its command is listed, switched and started like any other scheduled command, a run of it has the automation's name as its prompt, with no slash, and is handed the file's text with it, its runs are counted on this machine alone (where a command's runs in flight or its last start are said to be counted on any machine, for it that is this machine's), and what is said of a command's skill (the interval and the check its skill gives, its skill's number of agents, what its skill says it does) is, for it, said of that file.

## Business logic — TL;DR

- **A skill's `schedule`** - the `schedule` key [9] holds one row [8] or a list of rows, each one command [2]. A row's keys, in any order: `every: <N><m|h|d|w|mo>`, `when: <check>`, `waits-for: <one line>`, `agents: <N>`, `word: <one word>`; at least one of `every` and `when`, and `waits-for` only beside `when`. The command's name is the skill's folder name, followed by the row's `word` when it has one. A row with no `agents` has a cap [4] of 1. Every command of the skill carries what the skill says it does, the front matter's `description`, when that is text. A skill with no `schedule` key, or a `SKILL.md` with no front matter, has no command.
- **Which skills are read** - every skill under `.claude/skills`, the folder the coding agent of scheduled runs reads, and then under `.agents/skills`, at the repository root; a skill in both folders is read once, from the first of the two that holds its `SKILL.md`; each command carries the folder its skill was read from; the skills in name order, a skill's rows in the order written.
- **The automations kept on this machine** - after the skills, every file `<name>.md` under `.agent-scheduler/automations`, in name order, read like a skill's file: one command named as the file, carrying the file's text after its front matter. Not listed, and kept aside with its name, the reason and a mark saying it is an automation: one whose file is named with something other than lower-case letters, digits and dashes; one whose file cannot be read; one whose name a skill of the project has too, in which case that skill's commands are not listed either and the name is noted as a clash; one whose `schedule` cannot be read; one with no `schedule`; one with several rows or a `word`; one with no text; one whose text is longer than 32,000 characters.
- **An automation the tool can save again** - a command is marked when it is a person's own automation [14] whose file reads as the tool writes one: a skill's command whose `SKILL.md` reads back as an automation and stands alone in a folder of `.claude/skills` that is no link, and an automation kept on this machine that is listed, whose file reads back as one and is a file itself, no link; no other command is marked: a skill a person or a package wrote, and an automation changed by hand into something the tool does not write, are listed without the mark; the schedule is the one place that says which commands those are, and the command line asks it.
- **A command's skill's file** - the skills folder the command's skill was read from, then the command's first word, then `SKILL.md` (`.claude/skills/triage/SKILL.md` for `triage quick`): what the tick looks for on the start point [13] before it starts a run of a skill's command.
- **An unreadable `schedule`** - an unknown key, a bad value, a row with neither `every` nor `when`, `waits-for` without `when`, two rows with one name, no row at all, or a front matter that is not YAML and holds a `schedule:` line, makes the skill's whole `schedule` unreadable: the skill gives no command and is kept aside with its name and the reason; the tick names the skill with `unreadable schedule: <reason>`.
- **Due** - the check's output, parsed as JSON, is something other than empty; output that is not JSON is due when non-blank. The interval [5] is the tick's to apply, from the run records, where no pace pick [10] stands in for it; a row with both keys starts only when both hold.
- **The time a check is given** - a check reads `$LAST_RUN`: the time of its command's last start on any machine, or the time a person switched the command on on this machine when that is later or the command never started; written in UTC to the whole second (`2026-10-09T10:00:00Z`), the fraction of a second dropped, never rounded up; inside a single-quoted `jq` program it is read as `env.LAST_RUN`.
- **The prompt** - a skill's command has its slash command as its prompt, `/<name>`, the whole name; an automation kept on this machine [14] has its name alone, with no slash; a prompt that opens with a slash is counted under the skill's command it names, else under the one its first word is; a prompt with no slash is counted under an automation kept on this machine only when it is that automation's name and nothing else; any other prompt is counted under no command.
- **The attached text of a run a check started** - opening words saying that the command's check printed what follows and that it says why the run started, not what the work is; then what the check printed, without NUL characters, cut when it is longer than 8000 characters at the end of the last whole line that fits, a line that ends exactly at the limit kept, with a last line saying how much was printed and the time the check was given; the attached text [12] the tick hands the run, the prompt staying the command alone.
- **The attached text of a run of an automation kept on this machine** - the automation's text; and, when a check started the run, an empty line, opening words saying that the check printed what follows and that the text above says what the work is, then what the check printed, cleaned and cut as for any run.

## Business logic

### A skill's `schedule`

#### Context

See `## Context`.

#### Business logic

A skill schedules commands with the `schedule` key [9] in the front matter of its `SKILL.md`: the YAML block between the file's first line, `---`, and the next `---` line. The value is one row [8] or a list of rows, and each row is one command [2]. A `SKILL.md` with no front matter, and a front matter with no `schedule` key, give no command and no complaint.

A row is a YAML map of these keys, in any order:

- `every` is the interval [5]: a whole number from 1 to 9999 and a unit of `m` (minutes), `h` (hours), `d` (days), `w` (weeks of 7 days) or `mo` (months of 30 days), written together (`15m`, `6h`, `7d`, `2w`, `1mo`). It is read by `pace.ts`'s rule, the same one a person's pace pick [10] is read by, and remembered as a duration and as written, without a leading zero, for the tick's line. A skill's `schedule` takes no time of day: only a pace pick does.
- `when` is the check [3]: a shell command line, surrounding whitespace removed. It is YAML text, so a check that holds quotes, commas or colons, or that spans several lines, is written as a block (`when: |-` and the lines under it) and is read as written. The check may read `$LAST_RUN`, the time it asks what is new from ("The time a check is given", below).
- `waits-for` is one plain line for a person saying what the check waits for (`when the queue holds a task`), surrounding whitespace removed. A check is a shell line that nothing can turn into a sentence, so the skill says it. It says what `when` waits for, so a row has it only beside `when`. This file only carries the line; the package's dashboard part shows it.
- `agents` is the skill's number for the cap [4]: a whole number from 1 to 99 (`names.ts`). A row naming none has a cap of 1. A person may set another number for their own machine, their agents pick [11], with `agent-scheduler agents` or from a dashboard; the tick holds the runs in flight against the cap in force (`state.ts`, `tick.ts`).
- `word` is the one word the skill gets as its argument: lowercase letters, digits and dashes, starting with a letter or a digit.

A row needs at least one of `every` and `when`, else nothing says when its command runs. The command's name is the skill's folder name, and for a row with a `word` the folder name, one space and the word: the skill `triage` with the rows `word: quick` and `word: consensual` schedules two commands, `triage quick` and `triage consensual`, each with its own interval, cap, switch, pace pick and run records. A list may hold a row with a word beside a row without one (`triage` and `triage quick`). Each command also carries the skills folder its skill was read from (below).

Each command of a skill carries what the skill says it does: the `description` key of the same front matter, surrounding whitespace removed. It is the skill's, not a row's, so every command of the skill carries the same words. A skill with no `description`, a blank one, or one that is not text (a list) gives its commands none, and its `schedule` is read all the same. This file only carries the words; the package's dashboard part shows them.

A row says nothing about whether its command runs on a machine, or about how far its runs publish: each person sets both on their own machine [6] [7]. A key such as `off` or `publish` in a row is an unknown key, which makes the skill's `schedule` unreadable (below).

### Which skills are read

#### Context

**Problem**: a project keeps its skills in the folder its coding agent reads them from, `.claude/skills` for Claude Code and `.agents/skills` for Codex, often as one copy linked from the other folder. Each skill must be read once, wherever it is. And every scheduled run is on Claude Code, which expands a slash command only from a skill under `.claude/skills`: a command whose skill is only under `.agents/skills` would hand Claude Code a slash command it cannot expand.

#### Business logic

A project's schedule is read from two folders at the repository root, as they are on disk: first `.claude/skills`, the folder the coding agent of scheduled runs reads, and then `.agents/skills`. What one of these folders holds is a skill when its name is lowercase letters, digits and dashes, starting with a letter or a digit, and it holds a readable `SKILL.md`; a plain folder and a link to a folder read alike. Anything else there (a file, a folder with no `SKILL.md`, a name of another shape) is passed over without a complaint. A skill in both folders is read once, from the first of the two folders that holds its `SKILL.md`: its `.claude/skills` copy when there is one, else its `.agents/skills` copy. Each command carries the folder its skill was read from. A skill found only under `.agents/skills` still brings its commands to the schedule, so they are listed; the tick never starts them and says why (`tick.ts`). A skill that is on disk and not on the start point [13] brings its commands to the schedule all the same, so they are listed; the tick starts no run of them until the skill is there, and says why when one of them would otherwise start (`tick.ts`). The skills are taken in name order, whichever folder each came from, and a skill's rows in the order written: that is the order of the schedule's commands, before those of the automations kept on this machine [14] (below). A project with neither folder, and with no automation kept on this machine, schedules nothing. Reading a project always answers a schedule, which may hold no command.

### The automations kept on this machine

#### Context

See the second user story in `## Context`.

**Problem**: an automation kept on this machine [14] is written like a skill's file, but it is no skill: it is in no folder a coding agent reads, and in no checkout a run works in. A slash command of its name would expand to nothing there, so a run has to be handed the text itself.

**Problem**: a name must be one command's. `agent-scheduler add` refuses a name that is taken (`automation.ts`), but a skill of the same name can arrive later, from a teammate, and the file can be edited by hand into something a save would have refused. Neither may pass in silence: the person would wait for runs that never start. Nor may a file that is there and cannot be listed at all, for its name or because it cannot be read.

**Problem**: a run is counted by the name its prompt carries (`records.ts`), and this machine's schedule switch [6] and picks are kept under a command's name (`state.ts`). An automation kept on this machine and a skill's command of one name could not be told apart: the skill's command would start on the switch the person gave their automation, at the pace and the publish pick they gave it, and each would count the other's runs.

**Problem**: the text reaches its run as one command-line argument, which a system holds to a length.

#### Business logic

After the skills, the folder `.agent-scheduler/automations` at the repository root (`names.ts`) is read, as it is on disk. Whatever it holds under a name that ends in `.md` is taken for an automation kept on this machine, named as the file without that ending. Anything else there (`notes.txt`) is passed over without a complaint. A project with no such folder has none. The files are taken in name order, and their commands come after every skill's in the schedule.

Each file is read by the same reader as a skill's `SKILL.md` ("A skill's `schedule`", above), as if it were the `SKILL.md` of a skill named as the file. The `schedule` [9] in its front matter gives its command its interval [5], its check [3], the plain line saying what the check waits for, and its cap [4]; the `description` beside it is what the command says it does. The command also carries the file's text: everything after the front matter, NUL characters dropped and surrounding whitespace removed. The front matter ends where the reader of the `schedule` ends it: at the first line, after the opening one, that starts with three dashes, whatever follows the dashes on that line. A `---` line further down is part of the text and is kept, and a file with no front matter is all text. And the command carries `.agent-scheduler/automations` as the folder it was read from.

An automation kept on this machine is one command, named as its file. It is not listed, and is kept aside with its name and a reason, in each of these cases, the first that holds:

1. Its file's name, without the `.md`, is not lowercase letters, digits and dashes, starting with a letter or a digit (`Loud Name.md`): `its file is named with something other than lower-case letters, digits and dashes`.
2. Its file cannot be read, a folder of that name and a link that leads nowhere included: `its file cannot be read`.
3. A skill of the project has its name too, in either skills folder: `a skill of the project has this name too: rename or remove .agent-scheduler/automations/<name>.md, then switch on what you want`. When that skill schedules commands, they are taken off the schedule as well, every command whose first word is that name (`triage quick` and `triage consensual` for an automation named `triage`), and the reason says so: `a skill of the project has this name too, so neither is listed: rename or remove .agent-scheduler/automations/<name>.md, then switch on what you want`. The name is also noted in the schedule as a clash. So the skill does not start on the switch the automation was given: while both are there neither is listed, and every tick takes this machine's switch and picks under a clash's name out of the state (`state.ts`, `scheduler.ts`). Once the file is renamed or removed the skill's commands are listed again, switched off, which is why the reason ends as it does.
4. Its `schedule` cannot be read ("An unreadable `schedule`", below): the reader's own reason (`unknown key evry`).
5. It has no `schedule` key, or no front matter: `it has no schedule`. A skill that schedules nothing is passed over in silence, but a file kept in this folder is meant to run, so it is named.
6. Its `schedule` gives several rows, or one row with a `word`: `it has one row, with no word`.
7. It has no text after its front matter: `it has no text after its front matter`.
8. Its text is longer than 32,000 characters (`names.ts`): `its text is <N> characters, and 32000 is the most`. A text of exactly 32,000 characters is listed.

Each is kept aside with the automation's name, the reason, and a mark saying it is an automation kept on this machine and no skill. The tick names it on every tick, under the automation's name, with `unlisted automation: <reason>` (`tick.ts`), apart from a skill whose `schedule` cannot be read. The other automations, and the commands of the other skills, still count.

### An automation the tool can save again

#### Context

**User story**: on the dashboard's Automations page, the row of an automation [14] a person saved has "Edit prompt" and "Remove", and the row of a skill of the project has neither. The page reads no file of the project: it lists the schedule as the tick recorded it (`tick.ts`).

**Problem**: a shared automation is a skill file among the project's skill files, and the tool keeps no list of the ones it saved. Rewriting or deleting a skill a person or a package wrote would lose their work, so something has to say, command by command, which ones the tool may rewrite and delete. It is said here and nowhere else: the page reads it off the tick's record, and the command line asks the schedule (`automation.ts`), so the two never disagree about a command.

#### Business logic

A command of the schedule is marked as one the tool can show, save again and remove (`editable`) in two cases:

- A skill's command, when both hold: the skill's `SKILL.md`, the text the skill was read from (above), reads back as an automation named as the skill's folder (`automation-file.ts`: the file reads as the tool writes one, every line the tool's but for what its description says); and the skill's folder stands alone under `.claude/skills` (`automation-file.ts`: a folder that is no link, holding its `SKILL.md`, no link either, and nothing else but a `.DS_Store`). Such a file has one row and no `word`, so the skill has one command, and it is the one marked. A skill read from `.agents/skills` because `.claude/skills` holds no such skill is never marked.
- An automation kept on this machine that is listed ("The automations kept on this machine", above), when both hold: its file reads back as an automation named as the file; and the file is a plain file (`automation-file.ts`), not a link to a file kept somewhere else.

No other command is marked. A skill a person or a package wrote, a skill whose folder is a link, a skill with a script beside its `SKILL.md`, an automation kept on this machine whose file is a link, and an automation of either kind whose file was changed by hand into something the tool does not write (one more key, a description written another way than as one quoted text) are listed, switched and started all the same: only the mark is missing. An automation whose prompt a person changed in the file by hand, its first line too, keeps the mark: its description is then a line behind the prompt, until the next save writes it anew. An automation kept on this machine that is not listed is no command, so it has no mark either.

The mark changes nothing about when a command is due or how it runs. It says that `agent-scheduler show`, `edit` and `remove` take the command's name: the command line reads the schedule and takes only a command that carries the mark (`automation.ts`). The tick records the mark with the command (`tick.ts`), and the Automations page offers "Edit prompt" and "Remove" on the rows that carry it.

### A command's skill's file

#### Context

**Business logic story**: a scheduled run works in a checkout made from the start point [13], not in the person's own checkout, where the schedule was read. Before it starts a run of a command, the tick asks whether the command's skill is on the start point, and asks it by the path of the skill's file: a skill's folder without its `SKILL.md` is no command to the coding agent (`tick.ts`, `start-point.ts`).

#### Business logic

The file a command's skill is, as a path from the repository root, is the skills folder the skill was read from (above), the command's first word, which is the skill's folder name, and `SKILL.md`, joined by `/`: `.claude/skills/work-queue/SKILL.md` for `work-queue`, `.claude/skills/triage/SKILL.md` for `triage quick`, `.agents/skills/plan/SKILL.md` for a command `plan` whose skill was read from `.agents/skills`. The word after the folder name is not part of it, so every command of one skill has the same file.

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
- `every` has an unknown unit (`2y`), no unit (`15`), a number of 0 or a number above 9999 (`100000000d`): `every is a number from 1 to 9999 and a unit, m, h, d, w or mo (15m, 6h, 7d, 2w, 1mo)`. An `every` of 0 is refused rather than read as "always", which is the key being absent.
- `when` is not text, or is blank: `when is a shell command line`.
- `waits-for` is not text, is blank, or spans several lines: `waits-for is one line of text`.
- `agents` is not a whole number from 1 to 99 (`0`, `many`, `100`): `agents is a whole number from 1 to 99`.
- A row has neither `every` nor `when`: `neither every nor when says when`.
- A row has `waits-for` and no `when`: `waits-for says what when waits for, and there is no when`.
- Two rows give the same command name: `two rows are named <name>`.

When the skill's `schedule` is a list of several rows, a reason about one row starts with that row's place in the list: `row 2: unknown key evry`. The skill is kept aside with its name and the reason, and the commands of the other skills still count. The tick writes one decision per such skill in the state, under the skill's name, with the outcome `unreadable schedule: <reason>`. An automation kept on this machine [14] that is not listed ("The automations kept on this machine", above) is kept aside too, with a mark that tells it from such a skill: the tick names it with `unlisted automation: <reason>`.

### Due

#### Context

**Problem**: every skill command prints JSON on stdout (`npx queue` prints the open entries as a JSON array), so a check should need no piping to say "there is work".

#### Business logic

A command is due when its check exited 0 and its output, surrounding whitespace removed, parsed as JSON, is something other than empty: `[]`, `{}`, `null`, `false`, `""`, `0` and no output at all are not due; a non-empty array, an object with at least one key, `true`, any other number and any other string are due. Output that is not JSON counts by its text: anything non-blank is due. A check that exited non-zero is not due either, but the tick reports that as `check failed: …` rather than `not due`.

### The time a check is given

#### Context

**User story**: the author of a skill that answers new comments writes a check that lists the comments posted since `$LAST_RUN`. While nothing new came in, the check prints nothing and no agent starts. A new comment makes the check print it, and a run starts. From the next tick on, `$LAST_RUN` is that run's start, the comment is older than it, and the check is quiet again: the same comment starts no second run. A person who switches the command on, for the first time or after a month with it off, gets no run for what came in before they switched it on.

**Problem**: a check that asks what is new needs a time to ask from: the same on every machine that shares the repository, moving on once a run was started for what the check found, and written in a shape the tools a check is written with can read.

#### Business logic

A check is run with the environment variable `$LAST_RUN` set, beside the environment of the scheduler's process. Which time it holds is the tick's to say (`tick.ts`): the command's last start on any machine (`records.ts`), whatever became of that run, or the time a person switched the command on on this machine (`state.ts`) when that is later, or when the command never started. So the first check of a command asks what is new since it was switched on, not since the beginning of time, and so does the first check of a command switched on again after a time with it off.

This file says how the time is written: an ISO 8601 time in UTC to the whole second, ending in `Z` (`2026-10-09T10:00:00Z`), the shape `gh`'s `--search`, a GitHub `since` and `jq`'s `fromdate` all read. A time in another time zone is converted (`2026-10-09T13:00:00+03:00` → `2026-10-09T10:00:00Z`). The fraction of a second is dropped, never rounded up (`10:00:00.999` → `10:00:00`): a thing that came in during that same second is then found twice rather than never.

The shell fills `$LAST_RUN` in only outside single quotes. A check that pipes into a single-quoted `jq` program reads the time there as `env.LAST_RUN`.

### The prompt

#### Context

**Problem**: the coding agent's harness expands `/<name>` into the project's skill of that name, so the whole instruction for a run is that slash command.

**Problem**: an automation kept on this machine [14] is no skill in a run's checkout, so no slash command reaches its text. And a run record carries only the run's prompt: the runs of such an automation must be counted as its own, for its interval, its cap [4] and the time its check is given, whatever its text says and however the person changes the text.

#### Business logic

The prompt of a skill's command is `/<name>`, the whole name: `triage quick` runs as `/triage quick`, and the harness hands the skill the word. The prompt of an automation kept on this machine [14] is its name alone, with no slash (`answer-comments`): it is no command the coding agent could expand, and its text is handed to the run with the prompt, as attached text [12] (below). The prompt itself is the command alone, or that name alone, with no system prompt and no framing. What else the agent is sent comes with the prompt, apart from it: from the scheduler, the run's attached text [12] (below), which is what a check printed and, for an automation kept on this machine, its text before that; from `agent-runner`, the sentence of the publish level in force, last. The other way round, a run's prompt, as its run record carries it, is counted under one scheduled command or under none, by how it opens:

- A prompt that opens with a slash names a skill's command and nothing else: the skill's scheduled command whose name it is without the slash (`/triage quick` → `triage quick`), else the skill's scheduled command its first word is (`/work-queue now` → `work-queue`, `/post-merge-cleanup <id>` → `post-merge-cleanup`), else none (`/triage`, where every command of the skill carries a word; `/review the open pull requests`, where nothing schedules `review`). So a run counts against that command's cap and interval whoever started it (the tick, a dashboard's launcher, `agent-runner run` in a shell; `records.ts`).
- A prompt with no slash names no skill's command (`work-queue` → none, `Read the docs` → none). It is a run of an automation kept on this machine [14] only when it is that automation's name and nothing else, surrounding whitespace ignored (`answer-comments`).

The two never cross: the name of an automation typed with a slash (`/answer-comments`) is no run of it, and a skill's command typed with no slash is no run of the skill's. A prompt that names no scheduled command is counted under none: in a project with no scheduled command, every prompt. So the runs of an automation kept on this machine count for it by its name, whatever its text was when they ran. The text itself typed as a plain prompt, and a prompt that only starts with the name (`answer-comments is broken, fix it`), are no runs of it. Whose runs count, every machine's or this machine's alone, is `records.ts`'s to say.

### The attached text of a run a check started

#### Context

**User story**: a command's check prints the new work, the comments nobody answered or the queue's open entries, and the scheduler starts a run of the command. The agent reads with its prompt what the check printed, so a command that asks for the new thing has it.

**Problem**: what the check printed cannot go into the prompt: a run is counted under the scheduled command its prompt names (above), so the prompt stays the command alone. The agent has never seen the check, and a check may print only a sign that there is work (one issue of five that changed), so the text has to say what the output is, and that the command, not the output, says what the work is. And a check may print far more than an agent should be handed with its prompt.

#### Business logic

The attached text [12] of a run that a check [3] started opens with these words: "The scheduler starts this command when its check prints something, and this time the check printed what is below. It says why this run started; what the work is, the command says." On the next line comes the check's standard output, with every NUL character dropped (the text reaches the run as a command-line argument, which can hold none) and its surrounding whitespace removed. Output of at most 8000 characters (`names.ts`) is whole. Longer output is cut at the end of the last whole line within its first 8000 characters (a line that ends exactly at the 8000th character is whole, and is kept), or after 8000 characters, mid-line, when its first line alone is longer than that; one more line then says how much there was and what the check asked: "(cut: the check printed <N> characters, these are the first <M>; it asked what is new since <T>)", N being the length of the output, M the length of what is shown and T the time the check was given as `$LAST_RUN`. The next check asks from this run's start, so it does not print what was cut again: only an agent that asks from that earlier time itself finds it. The tick (`tick.ts`) hands the text to the run it starts; a command with no check, started by its interval alone, has no such text.

What comes after the opening words, the check's output cleaned and cut this way with its "(cut: …)" line, is also what a person who only tries a check is shown as what it printed (`agent-scheduler try`, `automation.ts`): the same text a run would be handed, without the opening words.

### The attached text of a run of an automation kept on this machine

#### Context

**Problem**: the text of an automation kept on this machine [14] is in no checkout, so its run has to be handed it. Were it the prompt, it would be what the run is counted by (above): a person who changed one word of their text would lose the automation's last start and its runs in flight.

**Problem**: the opening words of a check's output (above) say that the command says what the work is. A run of an automation kept on this machine has no command: its text says it.

#### Business logic

The attached text [12] of a run of an automation kept on this machine is the automation's text, as read above ("The automations kept on this machine"). A run that its interval alone started is handed the text and nothing after it. A run that a check [3] started is handed, after the text and an empty line, these words: "The scheduler starts this when its check prints something, and this time the check printed what is below. It says why this run started; what the work is, the text above says." On the next line comes what the check printed, cleaned and cut exactly as for any run a check started (above), with the same "(cut: …)" line when it is long. The tick (`tick.ts`) hands the text to the run it starts.
