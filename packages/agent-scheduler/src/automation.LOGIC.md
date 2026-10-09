A person's own automation [1]: the skill file it becomes, why one cannot be saved as written, the save of that file into the project, and a check [2] tried once before anything is saved. The command line's `add` and `try` (`cli.ts`) and the "New automation" form of the package's dashboard part (`../dashboard/NewAutomation.tsx`) both go through here.

## Context

**User story**: a person wants an agent to answer each new comment on the project's issues. No skill of the project does that, and they do not want to write a skill file by hand. On the dashboard's Automations page they press "New automation", type a name (`answer-comments`), what the agent is told, "every 15 minutes" and a shell line that lists the comments posted since `$LAST_RUN`. They press "Try it" and read what the line prints today. They save, and the project has a new file, `.claude/skills/answer-comments/SKILL.md`, theirs to commit. At the next tick [5] the command `/answer-comments` is listed like any skill's, switched off. Once the file is on the start point [4] and the person switched the command on, an agent starts whenever a new comment came in, at most every 15 minutes. From a shell the same is `agent-scheduler add answer-comments --prompt … --every 15m --when …`, and `agent-scheduler try --when …` before it.

**Business logic story**: the tool names no command of its own: a scheduled command is always a skill's, read from the skill's `schedule` [3] (`schedule.ts`). So an automation is saved as a skill, and from then on nothing in the tool knows it apart from a skill a person wrote by hand: the tick reads its `schedule` from its file, lists its command, and the command has its switch, its pace, its number of agents and its publish level on each machine like any other. This file only makes the file and tries a check; the contract around both is the command line's (`cli.ts`).

**Problem**: the file is written into the person's own checkout, and a scheduled run works in a checkout made from the start point [4]. So saving alone starts nothing: the file has to be committed and brought to the start point first (`start-point.ts`, `tick.ts`). The tool commits nothing for the person, so it must say where the file is and where it has to get to.

**Problem**: a check typed into a form is a shell line nobody has run yet. Saved wrong, it fails every minute or never prints anything. A person must be able to run it once before saving. A command that does not exist yet has no last start to give the check as `$LAST_RUN`, and asking what is new "since now" would show the person nothing.

## Glossary

[1] automation: a person's own prompt saved as a command skill of the project (a skill run as the slash command `/<name>`, never picked up by the coding agent on its own): the file `.claude/skills/<name>/SKILL.md`, whose text is the prompt and whose front matter carries the `schedule` [3] the person picked, an interval [6], a check [2] or both. Written by `agent-scheduler add` or the "New automation" form of the Automations page; from then on a skill like any other, and its command a scheduled command like any other.
[2] check: the shell command line a skill's `schedule` [3] gives a command as `when`, run at the repository root on every tick [5]; its output says whether the command is due. It may read `$LAST_RUN`: the time of its command's last start, or the time the command was switched on on this machine when that is later.
[3] the skill's `schedule`: the key `schedule` in the front matter of a skill's `SKILL.md`, where the skill says which commands it schedules and when each is due.
[4] start point: the commit a scheduled run's checkout starts from: origin's default branch (`origin/main`), or, in a repository with no remote, the commit the person's own checkout is on (`HEAD`). Never the files in a person's own checkout: a skill written there and not committed, or committed and not yet on origin's default branch, is not on the start point.
[5] tick: one pass of the scheduler: pull the `agent-data` branch, sweep, then one decision per scheduled command, each decision one line in the state.
[6] interval: the `every` key of a skill's `schedule` [3]: the least time since the command's last start before it may start again, on a machine where no person set another pace.

## Business logic — TL;DR

- **What an automation is made of** - a name, a prompt, and at least one of an interval [6] and a check [2], with one optional plain line saying what the check waits for.
- **The skill file of an automation** - the front matter, then the prompt: `name`, `description` (the prompt's first line, cut at 150 whole characters), `disable-model-invocation: true`, and a `schedule` [3] of one row with `every`, `waits-for` and `when`, each only when given. Every text the person typed is written as a quoted value in which whatever could end the value, the line or the front matter is an escape, three dashes in a row among them. The check alone stands as a block, line for line as typed, where a block holds it as typed; otherwise it is quoted too.
- **Why an automation cannot be saved** - the first of: a name that is no command's name (`bad-name`), a name longer than 64 characters (`bad-name`), a blank prompt (`no-prompt`), a `schedule` the tick's own reader cannot read, with that reader's reason (`bad-schedule`), a file that would not read back as typed (`bad-schedule`, `it would not read back as typed`).
- **Saving an automation** - refused `taken` when either skills folder of the project holds anything of that name, whatever its capitals; otherwise `.claude/skills/<name>/SKILL.md` is written in the person's own checkout and nothing is committed; the answer names the command, the file and where a run's checkout starts (`origin/main`, or `HEAD`); a refusal writes nothing, and a write that fails leaves no empty folder behind.
- **Trying a check** - the check runs once through the tick's own runner, within 20 seconds, given the time a day ago as `$LAST_RUN`; the answer says that time, whether the check ran, whether an agent would start, what it printed, cut as a run is handed it, and, when it did not run, that it took too long or the last line of its error; nothing is saved and nothing is started.

## Business logic

### What an automation is made of

#### Context

See `## Context`.

#### Business logic

An automation [1], as a person fills it in, is:

- A name: the command's name without its slash, which is also the name of the skill's folder.
- A prompt: what the agent is told, the skill's whole text.
- An interval [6], optional, as a skill writes it (`15m`, `1d`).
- A check [2], optional: a shell line.
- One plain line saying what the check waits for (`when someone commented`), optional.

It has no word after its name and no number of agents at once: its skill schedules one command, named as the automation, that one agent runs at a time until a person sets another number for their machine.

### The skill file of an automation

#### Context

**Problem**: the front matter is read twice, by two readers. The tick reads it as YAML. A coding agent's harness finds it more loosely: for it the front matter ends at the first three dashes in a row it meets anywhere, even in the middle of a line. A person types free text into it: a prompt's first line, plain words, a shell line with quotes, colons, pipes and sometimes several lines. Written as typed, such a text could end the front matter early for the agent, add or change another key (`disable-model-invocation: false`, `allowed-tools: …`), or read back as something else than was typed.

**Problem**: the Automations page says beside each command what its skill says it does, which is the `description` of the skill's front matter. A person who typed only a prompt gave none.

#### Business logic

The file is the front matter between two `---` lines, an empty line, the prompt with its surrounding whitespace removed, and a final line break. The front matter holds, in this order:

- `name`: the automation's name, as it is.
- `description`: the first line of the prompt, surrounding whitespace removed, written quoted (below). A first line longer than 150 characters is cut to its first 149 and "…". The cut counts whole characters, so it never goes through an emoji. Only the description is cut: the prompt below is whole.
- `disable-model-invocation: true`, which makes the skill a command: the coding agent runs it only when told `/<name>`.
- `schedule`, one row with these keys, each only when the automation has it:
  - `every`: the interval [6]. One of the tool's own shape, digits and a unit (`15m`), stands as it is; anything else typed there (`often`) is written quoted, and the reader then says what is wrong with it.
  - `waits-for`: the plain line, surrounding whitespace removed, written quoted.
  - `when`: the check [2], surrounding whitespace removed, as a block or quoted (below).
  
  An automation with none of the three is written `schedule: {}`, an empty row, which the reader refuses in its own words (below).

A quoted value is the text between double quotes on one line, with every character that could end the value, the line or the front matter written as an escape: a double quote, a backslash, a line end, a tab and every other control character, the two Unicode line ends, the byte order mark. Three dashes in a row are written with the third as an escape (`---`), so no three dashes stand in the value. A quoted value reads back as exactly the text. So a description of "Review open PRs --- only mine" keeps its dashes for whoever reads the value, and the agent's reader still sees the whole front matter.

The check stands as a block (`when: |-` and the check's lines under it, indented, an empty line left empty) where a block holds it line for line as typed, the way the skills write theirs: it holds no character a quoted value would escape but plain line ends (no tab, no other control character, neither Unicode line end, no byte order mark), no line that ends in a blank, and no three dashes in a row. A check with a tab, a line ending in a blank or `echo "---"` is written quoted on one line instead. Either way it reads back through `schedule.ts` as the check that was typed.

Half of a broken character pair (half an emoji, which no file holds as text) is replaced by the replacement character, in the prompt, the description, the plain line and the check.

The prompt is not quoted: it is the skill's text, after the front matter, and a `---` line of its own there is kept as it is.

### Why an automation cannot be saved

#### Context

**Problem**: a file that the tick could not read would be saved, listed nowhere as a command, and named on every tick as a skill whose `schedule` cannot be read. And a file that reads back as another check than the one typed would run a shell line nobody wrote. What is saved must be what the tick reads and what was typed, so the same reader decides.

#### Business logic

An automation cannot be saved for the first of these that holds, each with its reason:

1. The name is not lower-case letters, digits and dashes, starting with a letter or a digit, with no three dashes in a row (`names.ts`): `bad-name`, with `a name is lower-case letters, digits and single or double dashes, and starts with a letter or a digit`. So `Answer comments`, `-x` and `a---b` are refused, and `a--b` is a name. Three dashes in a row would end the file's front matter for a coding agent, and the name is the one text written there unquoted.
2. The name is longer than 64 characters (`names.ts`): `bad-name`, with `a name is 64 characters at most`.
3. The prompt is empty or only whitespace: `no-prompt`.
4. The skill file the automation would become (above) is read by `schedule.ts`'s reader, the one the tick reads every skill with. When that reader cannot read its `schedule`: `bad-schedule`, with the reader's own reason. So an automation with neither an interval nor a check says `neither every nor when says when`; an interval the tool does not read (`often`) says `every is a number from 1 to 9999 and a unit, m, h, d, w or mo (15m, 6h, 7d, 2w, 1mo)`; a plain line with no check says `waits-for says what when waits for, and there is no when`; a plain line of several lines says `waits-for is one line of text`; a check that is only whitespace says `when is a shell command line`.
5. The file would not read back as typed: `bad-schedule`, with `it would not read back as typed`. That is when the check or the plain line the reader read back is not the one typed (surrounding whitespace removed, a broken character pair replaced), or when the front matter as written holds three dashes in a row anywhere. Every text typed is written so that neither happens, and a name with three dashes is refused before this (1), so this is a last guard: no file is written that the two readers would read differently.

An automation none of these holds for can be saved.

### Saving an automation

#### Context

See the first **Problem** in `## Context`.

**Problem**: a person's automation must never replace a skill the project already has, whichever coding agent's folder that skill is in. On a disk that ignores capitals, `Loud` and `loud` are one folder. Two saves of one name may also come at the same moment.

**Problem**: a folder left behind by a save that failed would count as a skill of that name, and the name could never be saved again.

#### Business logic

Saving first asks why the automation cannot be saved (above) and answers that refusal when there is one. Then the two folders a coding agent reads a project's skills from, `.claude/skills` and then `.agents/skills` at the repository root, are listed. When either holds anything whose name is the automation's name, capitals ignored, the save is refused `taken`, naming that place from the repository root as it is spelled there (`.agents/skills/plan`, `.claude/skills/Loud` for an automation named `loud`). Anything counts: a skill's folder, an empty folder, a link to one, a link whose target is gone, an automation saved before. So saving the same name twice keeps the first file as it is.

Otherwise `.claude/skills`, the folder the coding agent of scheduled runs, Claude Code, reads, is made in the person's own checkout when it is missing. The skill's own folder, `.claude/skills/<name>`, is then made, and only if it is not there: when another save made it since the look above, this one is refused `taken` (`.claude/skills/<name>`) and writes nothing. The skill file (above) is written into the folder as `SKILL.md`. When that write fails (a full disk), the folder just made is taken away again and the save fails with the write's error, so the name is free for the next save. Nothing is staged and nothing is committed: the file is an untracked file of the person's.

The answer names the command (the automation's name), the file as a path from the repository root (`.claude/skills/answer-comments/SKILL.md`), and where a run's checkout starts: origin's default branch as this clone names it (`origin/main`), found by the `agent-data` package's rule and read from the clone, nothing fetched; or `HEAD` when the clone has none, as in a repository with no remote, or when it cannot be read. That is the start point [4] by name, so whoever asked can tell the person where the file has to get to.

A refusal writes nothing and makes no folder. The schedule is read from the skill files on disk (`schedule.ts`), so the project schedules the command from the moment the file is written: the next tick [5] lists it, and its switch can be flipped at once.

### Trying a check

#### Context

See the second **Problem** in `## Context`.

**Problem**: whoever tries a check waits for the answer. A dashboard gives a command it runs 30 seconds, less than the minute a tick gives a check, so a try given the tick's minute would be cut off by the dashboard with no answer at all.

#### Business logic

A check [2] is tried by running it once the way a tick [5] runs one, through the tick's own runner (`tick.ts`): through `sh -c` at the repository root, its input closed at once. It needs no command and no automation: the shell line is tried by itself. It runs in the environment of the process that tries it, which is not the scheduler's process. It has 20 seconds (`names.ts`), not the minute a tick gives a check: a check that takes longer than 20 seconds cannot be tried, though a tick would run it.

The time it is given as `$LAST_RUN` is 24 hours before now, written as `schedule.ts` writes that time: in UTC to the whole second (`2026-10-08T10:00:00Z`). So a check that asks what is new shows the person what came in during the last day.

The answer holds:

- The time the check was given as `$LAST_RUN`.
- Whether the check ran: it exited 0 within its time.
- Whether an agent would start: what the check printed says due by `schedule.ts`'s rule (something other than empty). Never for a check that did not run.
- What the check printed on its standard output, exactly as a run is handed it (`schedule.ts`): without NUL characters, its surrounding whitespace removed, and, when it is longer than 8000 characters, cut at the end of the last whole line that fits, with the last line "(cut: the check printed <N> characters, these are the first <M>; it asked what is new since <the time it was given>)".
- Only for a check that did not run, why. When the 20 seconds were up: `it took longer than 20 seconds`. Otherwise the last line of what it printed on its standard error, cut after 500 characters with "…".

Trying saves nothing and starts nothing: no file is written, the state is neither read nor written, and no run is marked.
