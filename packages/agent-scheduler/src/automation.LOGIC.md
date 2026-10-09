A person's own automation [1], saved, found again, saved again and removed: why one cannot be saved as written, the save of its file, shared with the project or kept on this machine, the automation of a given name found where it is saved, or why the tool leaves what has that name alone, the save of an automation again under its name, its removal, and a check [2] tried once before anything is saved. The file itself, as it is written and read back, is `automation-file.ts`'s. The command line's `add`, `show`, `edit`, `remove` and `try` (`cli.ts`) go through here, and through them the package's dashboard part: the automation form (`../dashboard/AutomationForm.tsx`) and "Edit prompt" and "Remove" on the Automations page (`../dashboard/AutomationsPage.tsx`).

## Context

**User story**: a person wants an agent to answer each new comment on the project's issues. No skill of the project does that, and they do not want to write a skill file by hand. On the dashboard's Automations page they press "New automation", type a name (`answer-comments`), what the agent is told, "every 15 minutes" and a shell line that lists the comments posted since `$LAST_RUN`. They press "Try it" and read what the line prints today. They save, and the project has a new file, `.claude/skills/answer-comments/SKILL.md`, theirs to commit. At the next tick [5] the command `/answer-comments` is listed like any skill's, switched off. Once the file is on the start point [4] and the person switched the command on, an agent starts whenever a new comment came in, at most every 15 minutes. From a shell the same is `agent-scheduler add answer-comments --prompt … --every 15m --when …`, and `agent-scheduler try --when …` before it.

**User story**: another person wants an agent to look at a competitor's forum for them every hour. That is nobody else's business, and they want no file to commit. In the form they pick "Only on this machine" under "Who gets it", or they add `--private` to `agent-scheduler add`. Nothing is written into the project: the automation is one file in the tool's own folder, `.agent-scheduler/automations/watch-competitor.md`, which git does not show. At the next tick [5] `watch-competitor` is listed on their machine, switched off, and it can start as soon as they switch it on.

**User story**: weeks later the first person wants the agent to answer in one line, every hour. They press "Edit prompt" beside `/answer-comments` on the Automations page, change the words and the pace, and save; or they run `agent-scheduler show answer-comments` to read it as it stands and `agent-scheduler edit answer-comments --prompt … --every 1h --when …` to save it again. The file is written anew where it is, a change of theirs to commit. What they did not change stays as the file said it. The command keeps its name, so its past runs, its switch and their picks for it are still its own. When the second person no longer wants their automation, they press "Remove" beside `watch-competitor` and confirm, or run `agent-scheduler remove watch-competitor`: the file is deleted, and with it what their machine held for the command.

**Business logic story**: the tool names no command of its own: a scheduled command is read from a file a person wrote or saved, and when it is due from the `schedule` [3] in that file's front matter (`schedule.ts`). So an automation is saved as a skill's file (`automation-file.ts`), of one of two kinds. A shared automation [1] is a skill of the project: it is read, listed, switched and started like a skill a person wrote by hand. An automation kept on this machine [1] is the same file in the tool's own folder, which `schedule.ts` reads after the project's skills: it is no skill, so a run of it is handed its text with its prompt, which is the automation's name and no slash command (`tick.ts`). Either way the tick reads its `schedule` from its file, lists its command, and the command has its switch, its pace, its number of agents and its publish level on each machine like any other. The tool keeps no list of what it saved: an automation is told from a skill somebody wrote only by its file, which reads as the tool writes one (`automation-file.ts`). The schedule is the one place that says so, command by command (`schedule.ts`), and only a command it marks can be found here, saved again and removed. This file makes, finds, rewrites and deletes that file and tries a check; the contract around them, and what happens to this machine's state, is the command line's (`cli.ts`).

**Problem**: the file of a shared automation is written into the person's own checkout, and a scheduled run works in a checkout made from the start point [4]. So saving alone starts nothing: the file has to be committed and brought to the start point first (`start-point.ts`, `tick.ts`). The same holds for a change to the file and for its deletion: a run is told the new words only once the change is on the start point, and until the deletion is on origin's default branch, everyone else who has the project keeps the command. The tool commits nothing for the person, so it must say where the file is and where it, its change or its deletion has to get to. An automation kept on this machine has no such way to go: a run is handed its text, so the text has to be in no checkout.

**Problem**: not every prompt of a person's is the project's business. Saved as a skill of the project, a prompt a person wants for themselves alone would be a file they have to commit, and a command every teammate then gets.

**Problem**: a check typed into a form is a shell line nobody has run yet. Saved wrong, it fails every minute or never prints anything. A person must be able to run it once before saving. A command that does not exist yet has no last start to give the check as `$LAST_RUN`, and asking what is new "since now" would show the person nothing.

**Problem**: a project's skills folder holds skills people wrote, skills that are links to a package's folder, and the shared automations saved from here. Saving again writes a whole file anew and removing deletes it. Done to a skill a person or a package wrote, either would lose their work.

## Glossary

[1] automation: a person's own prompt saved as a scheduled command, with the `schedule` [3] the person picked, an interval [6], a check [2] or both. Written by `agent-scheduler add` or the "New automation" form of the Automations page, as one of two kinds, the person's choice. While its file reads as the tool writes one, the tool shows it, saves it again under its name and removes it (`agent-scheduler show`, `edit` and `remove`, or "Edit prompt" and "Remove" on the Automations page); an automation whose file was changed by hand into something the tool does not write is edited and removed by hand. A shared automation is a command skill of the project (a skill run as the slash command `/<name>`, never picked up by the coding agent on its own): the file `.claude/skills/<name>/SKILL.md`, whose text is the prompt and whose front matter carries that `schedule`; the person commits it, and from then on it is a skill like any other, and its command a scheduled command like any other. An automation kept on this machine is one file written the same way, `.agent-scheduler/automations/<name>.md`, in the tool's own folder, which is hidden from git: nothing is to commit and nobody else gets its command, though its text is in the record of each of its runs, which is shared where the project shares its records. It is no skill and no slash command: its command is listed, switched and started like any other scheduled command, a run of it has the automation's name as its prompt, with no slash, and is handed the file's text with it, its runs are counted on this machine alone (where a command's runs in flight or its last start are said to be counted on any machine, for it that is this machine's), and what is said of a command's skill (the interval and the check its skill gives, its skill's number of agents, what its skill says it does) is, for it, said of that file.
[2] check: the shell command line a skill's `schedule` [3] gives a command as `when`, run at the repository root on every tick [5]; its output says whether the command is due. It may read `$LAST_RUN`: the time of its command's last start, or the time the command was switched on on this machine when that is later.
[3] the skill's `schedule`: the key `schedule` in the front matter of a skill's `SKILL.md`, where the skill says which commands it schedules and when each is due.
[4] start point: the commit a scheduled run's checkout starts from: origin's default branch (`origin/main`), or, in a repository with no remote, the commit the person's own checkout is on (`HEAD`). Never the files in a person's own checkout: a skill written there and not committed, or committed and not yet on origin's default branch, is not on the start point.
[5] tick: one pass of the scheduler: pull the `agent-data` branch, sweep, then one decision per scheduled command, each decision one line in the state.
[6] interval: the `every` key of a skill's `schedule` [3]: the least time since the command's last start before it may start again, on a machine where no person set another pace.

## Business logic — TL;DR

- **Why an automation cannot be saved** - the first of: a name that is no command's name (`bad-name`), a name longer than 64 characters (`bad-name`), a blank prompt (`no-prompt`), a `schedule` the tick's own reader cannot read, with that reader's reason (`bad-schedule`), a file that would not read back as typed (`bad-schedule`, `it would not read back as typed`).
- **Saving an automation** - shared with the project, or kept on this machine when whoever asks says so; refused `taken` when the name is taken, whatever its capitals and for both kinds alike: by anything of that name in either skills folder of the project, or by an automation kept on this machine; otherwise, shared, `.claude/skills/<name>/SKILL.md` is written in the person's own checkout and nothing is committed, and, kept on this machine, `.agent-scheduler/automations/<name>.md` is written, the tool's folder hidden from git first; the answer names the command, the file and where a run's checkout starts (`origin/main`, or `HEAD`), and says `onThisMachine: true` for one kept on this machine; kept on this machine, a prompt longer than 32,000 characters is refused `long-prompt`; a refusal writes nothing, and a save whose write fails leaves no empty folder behind.
- **Finding a saved automation** - given a name, the schedule is read and asked: for a command it marks as an automation the tool can show, save again and remove, the answer is the automation as its file says it at that moment, its file, and whether it is kept on this machine; anything else is refused `not-an-automation`, with one sentence saying why the tool leaves the name alone: the schedule lists nothing of that name, the schedule's own reason for an automation or a skill it could not list, a file kept on this machine that was changed by hand, a skill of the project.
- **Saving an automation again** - the automation of that name is found, or the save is refused as the finding is; a change of up to four parts is laid over what the file says: a part given takes the place of the file's, a part taken out is gone, a part left out stays, and what a check waits for goes out with the check unless it is given; what could not be saved new is refused the same way, and so is a prompt longer than 32,000 characters for one kept on this machine; otherwise the file is written anew, whole, where it is, beside the file first and then moved over it, so a write that fails leaves the automation as it was; its name and its kind stay; nothing is committed and the state is not touched; the answer is a save's.
- **Removing an automation** - the automation of that name is found, or the removal is refused as the finding is; its file is deleted, and the folder that held it alone, with a `.DS_Store` beside it; nothing is committed and nothing git holds is changed; the answer names the command and the file, and says, for one kept on this machine, that it was, and, for a shared one, what git still holds of the file, `committed`, `staged`, `nothing` or, when git could not be asked, `unknown`, and where a run's checkout starts.
- **Trying a check** - the check runs once through the tick's own runner, within 20 seconds, given the time a day ago as `$LAST_RUN`; the answer says that time, whether the check ran, whether an agent would start, what it printed, cut as a run is handed it, and, when it did not run, that it took too long or the last line of its error; nothing is saved and nothing is started.

## Business logic

### Why an automation cannot be saved

#### Context

**Problem**: a file that the tick could not read would be saved, listed nowhere as a command, and named on every tick as a skill whose `schedule` cannot be read. And a file that reads back as another check than the one typed would run a shell line nobody wrote. What is saved must be what the tick reads and what was typed, so the same reader decides.

#### Business logic

An automation [1], as a person fills it in (`automation-file.ts`: a name, a prompt, an interval [6], a check [2], one plain line saying what the check waits for), cannot be saved for the first of these that holds, each with its reason:

1. The name is not lower-case letters, digits and dashes, starting with a letter or a digit, with no three dashes in a row (`names.ts`): `bad-name`, with `a name is lower-case letters, digits and single or double dashes, and starts with a letter or a digit`. So `Answer comments`, `-x` and `a---b` are refused, and `a--b` is a name. Three dashes in a row would end the file's front matter for a coding agent, and the name is the one text written there unquoted.
2. The name is longer than 64 characters (`names.ts`): `bad-name`, with `a name is 64 characters at most`.
3. The prompt is empty or only whitespace, NUL characters not counting as text: `no-prompt`.
4. The skill file the automation would become (`automation-file.ts`) is read by `schedule.ts`'s reader, the one the tick reads every skill with. When that reader cannot read its `schedule`: `bad-schedule`, with the reader's own reason. So an automation with neither an interval nor a check says `neither every nor when says when`; an interval the tool does not read (`often`) says `every is a number from 1 to 9999 and a unit, m, h, d, w or mo (15m, 6h, 7d, 2w, 1mo)`; a plain line with no check says `waits-for says what when waits for, and there is no when`; a plain line of several lines says `waits-for is one line of text`; a check that is only whitespace says `when is a shell command line`.
5. The file would not read back as typed: `bad-schedule`, with `it would not read back as typed`. That is when the check or the plain line the reader read back is not the one typed (surrounding whitespace removed, a broken character pair replaced), or when the front matter as written holds three dashes in a row anywhere. Every text typed is written so that neither happens, and a name with three dashes is refused before this (1), so this is a last guard: no file is written that the two readers would read differently.

An automation none of these holds for can be saved. The same five decide for an automation saved new and for one saved again, asked of the whole automation once the change is laid over what its file says ("Saving an automation again", below).

### Saving an automation

#### Context

See the first **Problem** in `## Context`.

**Problem**: a person's automation must never replace a skill the project already has, whichever coding agent's folder that skill is in. On a disk that ignores capitals, `Loud` and `loud` are one folder. Two saves of one name may also come at the same moment.

**Problem**: a folder left behind by a save that failed would count as a skill of that name, and the name could never be saved again.

**Problem**: an automation kept on this machine [1] is a person's own writing, in a folder of the tool's, and exists nowhere else. It must never show in `git status` or ride a sweeping `git add -A`. And a name must be one command's: a shared automation and one kept on this machine under one name would be two commands of that name.

#### Business logic

Saving takes the automation and whether it is kept on this machine; when nothing says so, it is shared with the project. It first asks why the automation cannot be saved (above) and answers that refusal when there is one.

Then the name must be free, for both kinds alike. The two folders a coding agent reads a project's skills from, `.claude/skills` and then `.agents/skills` at the repository root, are listed. When either holds anything whose name is the automation's name, capitals ignored, the save is refused `taken`, naming that place from the repository root as it is spelled there (`.agents/skills/plan`, `.claude/skills/Loud` for an automation named `loud`). Anything counts: a skill's folder, an empty folder, a link to one, a link whose target is gone, a shared automation saved before. Then the folder of the automations kept on this machine, `.agent-scheduler/automations` at the repository root (`names.ts`), is listed. When it holds a file named `<name>.md`, capitals ignored, the save is refused `taken` too, naming that file as it is spelled there (`.agent-scheduler/automations/answer-comments.md`, `.agent-scheduler/automations/Loud.md` for an automation named `loud`). So an automation kept on this machine never takes the name of a skill, a shared automation never takes the name of one kept on this machine, and saving the same name twice, either way, keeps the first file as it is: another prompt under a name that is saved goes through "Saving an automation again" (below).

What comes next depends on the kind.

A shared automation: `.claude/skills`, the folder the coding agent of scheduled runs, Claude Code, reads, is made in the person's own checkout when it is missing. The skill's own folder, `.claude/skills/<name>`, is then made, and only if it is not there: when another save made it since the look above, this one is refused `taken` (`.claude/skills/<name>`) and writes nothing. The skill file (`automation-file.ts`) is written into the folder as `SKILL.md`. When that write fails (a full disk), the folder just made is taken away again and the save fails with the write's error, so the name is free for the next save. Nothing is staged and nothing is committed: the file is an untracked file of the person's.

An automation kept on this machine: first its prompt, surrounding whitespace removed, must be 32,000 characters at most (`names.ts`), the most a run can be handed as one command-line argument. A longer one is refused `long-prompt`, with `the prompt is <N> characters, and one kept on this machine has 32000 at most`, and nothing is written. A shared automation has no such limit: its text is a skill's, which the coding agent reads from the checkout. Then the folder `.agent-scheduler/automations` is made when it is missing. The tool's folder is then hidden from git, before anything of the person's is in it: the line `/.agent-scheduler` is added to the repository's exclude file when it is not there, as a write of the state adds it (`state.ts`), and a failure to add it is ignored. The same skill file is then written into the folder as `<name>.md`, and only if it is not there: when another save made it since the look above, this one is refused `taken`, naming the file, and writes nothing. A write that fails for any other reason fails the save with the write's error, and the folder `automations` is taken away again when nothing is in it: the failed save of a first automation leaves no empty folder behind, only the tool's own folder, hidden and empty. No file of the project is written, and `git status` shows nothing.

The answer names the command (the automation's name), the file as a path from the repository root (`.claude/skills/answer-comments/SKILL.md`, or `.agent-scheduler/automations/answer-comments.md`), and where a run's checkout starts: origin's default branch as this clone names it (`origin/main`), found by the `agent-data` package's rule and read from the clone, nothing fetched; or `HEAD` when the clone has none, as in a repository with no remote, or when it cannot be read. That is the start point [4] by name, so whoever asked can tell the person where a shared automation's file has to get to. For an automation kept on this machine the answer also says `onThisMachine: true`. Its file has to get nowhere; the start point is named in its answer all the same.

A refusal writes nothing and makes no folder. The schedule is read from the files on disk (`schedule.ts`), so the project schedules the command from the moment the file is written: the next tick [5] lists it, and its switch can be flipped at once. A shared automation still starts no run before its file is on the start point [4] (`tick.ts`); one kept on this machine can start at the first tick after it was switched on.

### Finding a saved automation

#### Context

See the last **Problem** and the business logic story in `## Context`.

**Problem**: which commands are automations the tool may rewrite and delete must be said in one place. Were it worked out here as well as where the schedule is read, the page could offer "Edit prompt" on a row the command line then refuses, or the other way round.

#### Business logic

Finding takes a name and answers the automation [1] saved under it, or why the tool leaves what has that name alone. It is what showing an automation answers (`cli.ts`), and the first step of saving one again and of removing one (below).

The project's schedule is read as the tick reads it (`schedule.ts`), from the files on disk at that moment, and the name is looked for among its commands, by the whole name. The name is never opened as a path: one that is a path (`../../README`) is no command of the schedule. The answer is the first of these that holds:

1. The schedule lists no command of that name, and names no skill or automation of that name as one it could not list: refused, with `the schedule lists nothing named <name>`. That is the answer for a name nothing has, and for a skill of the project that schedules nothing.
2. The schedule lists no command of that name, and names an automation kept on this machine of that name as not listed: refused, with `the automation <name>, kept on this machine, is not listed: <the schedule's reason>` (`…: a skill of the project has this name too: rename or remove .agent-scheduler/automations/work-queue.md, then switch on what you want`).
3. The schedule lists no command of that name, and names a skill of that name whose `schedule` [3] cannot be read: refused, with `the schedule of <name> cannot be read: <the schedule's reason>`.
4. The schedule lists the command and marks it as an automation the tool can show, save again and remove (`schedule.ts`: its file reads as the tool writes one and is no link, and a shared one stands alone in its folder). Its file is read again, at that moment, and read back as an automation (`automation-file.ts`). The answer is that automation, its file as a path from the repository root (`.agent-scheduler/automations/<name>.md` for one kept on this machine, else the skill's file, `.claude/skills/<name>/SKILL.md`), and, for one kept on this machine, that it is.
5. The schedule lists the command without that mark, or the file no longer reads back as an automation when it is read again. For a command that is an automation kept on this machine: refused, with `.agent-scheduler/automations/<name>.md is a link, or was changed by hand since it was saved: edit or remove the file itself`. For a skill's command: refused, with `<the skill's folder> is a skill of the project, or an automation changed by hand since it was saved: edit or remove its files yourself`, the folder being the one the skill was read from (`.claude/skills/triage`, `.agents/skills/plan`).

Every refusal carries the reason `not-an-automation` and its sentence as the detail. Finding changes nothing: no file is written.

So the tool finds only what the schedule marks. A skill a person wrote, a skill that comes from a package as a link, a skill with a script beside its `SKILL.md`, a skill that is only under `.agents/skills`, an automation kept on this machine whose file is a link, and an automation whose file was changed by hand into something the tool does not write are all left alone, each with a sentence that says to edit or remove the files by hand. An automation the schedule does not list is left alone too, in the schedule's own words. Whoever saved the file, and on which machine, is not asked: a shared automation that a teammate saved, once it is in this checkout, is found like one saved here.

### Saving an automation again

#### Context

See the third user story and the first **Problem** in `## Context`.

**Problem**: a run is counted by the name its prompt carries (`records.ts`), and this machine's switch and picks are kept under the command's name (`state.ts`). An automation saved under another name would be another command: no last start, switched off, at its own pace.

**Problem**: a person who wants to change one thing, the prompt or the interval, should not have to say everything else again, and must not lose what they did not say.

#### Business logic

Saving again takes the name of the automation and a change. The change has up to four parts, the prompt, the interval [6], the check [2] and the plain line saying what the check waits for, and each part says one of three things:

- Given: it takes the place of what the file says.
- Taken out, which only the interval, the check and the plain line can be: the file has it no more.
- Left out: it stays as the file says it.

One part follows another: when the check is taken out and the change says nothing of the plain line, the plain line goes out with it, since it says what a check waits for. When the check stays or is given, the plain line stays unless the change says otherwise.

In this order:

1. The automation of that name is found (above). When it is not, the save is refused as the finding is, `not-an-automation` with its sentence, and nothing is written.
2. The change is laid over what the file says, by the rules above, into one whole automation as a person fills one in (`automation-file.ts`).
3. That automation is asked why it cannot be saved ("Why an automation cannot be saved", above), and refused with that reason when there is one. So taking out the check of an automation that has no interval is refused `bad-schedule` with `neither every nor when says when`, and giving a plain line while the check is taken out with `waits-for says what when waits for, and there is no when`.
4. For an automation kept on this machine, the prompt, surrounding whitespace removed, must be 32,000 characters at most: a longer one is refused `long-prompt`, with `the prompt is <N> characters, and one kept on this machine has 32000 at most`. A shared one has no such limit.
5. The skill file of that automation (`automation-file.ts`) takes the place of the file that was found, where it is: the whole file is written anew, its description from the prompt's first line. It is first written beside the file, as `<the file>.new`, and then moved over it. A write that fails, also midway on a full disk, fails the save with the write's error: what was written beside the file is taken away, and the automation is as it was, not a cut file.

A refusal leaves the file as it was. The name is not changed, since the name is what finds the file. Neither is the kind: a shared automation stays a skill file of the project and one kept on this machine stays in the tool's folder, and nothing here moves one to the other. A save again is never refused `taken`: the name is its own. Nothing is staged and nothing is committed: for a shared automation whose file git already holds, the rewrite shows in `git status` as a change of the person's. This machine's state is neither read nor written.

The answer is the one a save gives: the command, the file as a path from the repository root, where a run's checkout starts (`origin/main`, or `HEAD`), and `onThisMachine: true` for one kept on this machine.

What follows from it, which whoever asked tells the person (`cli.ts`, `../dashboard/automation-form.ts`):

- The command keeps its name, so the runs it had are still counted as its own, and its switch, its pace, its number of agents and its publish level on each machine stay as they are.
- The schedule is read from the files on disk (`schedule.ts`), so the next tick [5] reads the new interval and the new check, for both kinds.
- A run of a shared automation works in a checkout made from the start point [4], where the skill's text is the one that is committed there: the agent is told the new words only once the change is committed and on the start point. A run of an automation kept on this machine is handed the text from the file, so the next run has the new one.

### Removing an automation

#### Context

See the third user story and the first **Problem** in `## Context`.

**Problem**: a removal deletes a file, and git can bring back only what was committed of it. An automation kept on this machine is in no git at all. A shared one may never have been committed, or may have been staged and not committed: then a commit the person makes afterwards would still add the file they just removed. Whoever asks must be able to say before a removal what can be brought back, and after it exactly what is left for the person to do.

#### Business logic

Removing takes a name. The automation of that name is found (above); when it is not, the removal is refused as the finding is, `not-an-automation` with its sentence, and nothing is deleted.

An automation kept on this machine: its file is deleted. The folder `.agent-scheduler/automations` is then taken away when nothing is left in it, so the folder made for the first automation goes with the last one. The answer names the command and the file that was deleted, as a path from the repository root (`.agent-scheduler/automations/tidy.md`), and says `onThisMachine: true`. It names no start point and says nothing of git: the file was in no git, and nothing of it is left anywhere.

A shared automation: its `SKILL.md` is deleted, then a `.DS_Store` beside it when a file manager left one, and then the skill's folder, which held nothing else, so the name is free again. The skills folder `.claude/skills` stays, also when it is left empty. Git is then asked what it still holds of that one file, asked by the path where the file really was: where `.claude/skills` is a link to another folder, that is a path under the other folder (`.agents/skills/daily/SKILL.md`). The answer says it as `git`, one of four:

- `committed`: the file is in a commit. Its deletion is a change of the person's to commit, and git can bring the file back as it was committed.
- `staged`: the file was added to git's index and never committed. The index is left as it is, so a commit made now would still add the file.
- `nothing`: git reports nothing for the file, one that was saved and never added. Nothing is to commit, and the file cannot be brought back.
- `unknown`: git could not be asked. The file is deleted all the same, and the answer says that what git holds of it is not known.

The answer of a shared automation names the command, the file that was deleted, as a path from the repository root (`.claude/skills/answer-comments/SKILL.md`, through `.claude/skills` also where that is a link), `git`, and where a run's checkout starts (`origin/main`, or `HEAD`).

Nothing is staged, nothing is committed and nothing git holds is changed. The run records of the automation's past runs are not touched. This machine's state is neither read nor written here: taking out what the machine held for the command is the command line's (`cli.ts`).

What follows from it, which whoever asked tells the person: the schedule is read from the files on disk, so this machine lists the command no more. A shared automation that was on origin's default branch is still a skill there: every other machine that has the project keeps the command, and a run's checkout would still hold the skill, until the deletion is committed and brought there. What was never committed cannot be brought back: all of an automation kept on this machine, and a shared one's file, or the last changes to it, that no commit holds.

### Trying a check

#### Context

See the third **Problem** in `## Context`.

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
