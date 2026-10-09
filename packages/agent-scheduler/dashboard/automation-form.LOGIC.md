The automation form [7] of the Automations page as data, and the words the page says around a removal: the draft [3] of an automation [1] while a person types it, new or opened from its page row [6] with what `agent-scheduler show` printed, whether a new one will be shared with the project or kept on this machine, what still keeps a draft from being saved, the words of the command that saves it (`agent-scheduler add` for a new one, `agent-scheduler edit` for one opened from its page row), whether a draft opened from a page row says anything else than its file, the sentence its page row would say for when it runs, the words beside its interval, whether anything was typed yet, what trying its check [2] answered (`agent-scheduler try`), what a save answered and what the person has to do with an automation saved, or saved again, the words that say where a draft is or will be saved, when the page row shows what was saved, and what the page says before an automation is removed and after (`agent-scheduler remove`). The form itself (`AutomationForm.tsx`) and the page (`AutomationsPage.tsx`) draw what this file says.

## Context

**User story**: on the Automations page the user presses "New automation" and types a name, what the agent is told, and when it runs: every so many minutes, hours, days, weeks or months, by a shell line that prints what is new, or both. Under the fields, one line says what is still missing, and once nothing is, when the automation would run, in the words its page row will use ("Every 15 minutes at most, when someone commented"). "Try it" says whether the shell line would start an agent now. After Save the user reads where the file is and where it has to get to. A user who wants the automation for themselves alone picks "Only on this machine": the note under the form then says it is kept outside git, and after Save they read that nothing is to commit.

**User story**: later the user presses "Edit prompt" on the page row of an automation they saved. The same form opens in the page row, holding what the file says: the name, which cannot be changed, the prompt, the interval and the shell line. The one line says when it runs and "Nothing is changed yet." until they change something. After Save they read that the change is theirs to commit and that an agent is told the new words only once the change is where an agent's checkout starts.

**User story**: the user presses "Remove" on such a page row. Before anything is deleted the page row says what will be deleted, what of it can be brought back and what stays. After they confirm, a note under the project's name says what was deleted and what is left for them to do.

**Problem**: a name and a count are typed a key at a time. A half-typed one must not be sent to the command, and must not be said as if it were a time the automation runs.

**Problem**: a prompt may open with a dash, as a list does, and the command line would read such a text as a flag of its own.

**Problem**: the module reads another process's output. An answer that is not what the command promises must not break the form.

**Problem**: the dashboard takes at most 4096 characters in one argument of a command it runs for a module, and the prompt, the check and the plain words each travel as one argument. A longer one would be refused only after Save, in the dashboard's own words.

**Problem**: the page lists what a project's scheduler last recorded, so a saved automation's page row shows only once that scheduler has ticked. Where the scheduler is not running, it does not show at all.

**Problem**: saving an automation again writes its whole file anew from what the form holds. A form that could not show everything the file says, an interval it has no fields for, would write the file without it.

## Glossary

[1] automation: a person's own prompt saved as a scheduled command, with the `schedule` the person picked (the key where a skill says when its command is due), an interval [4], a check [2] or both. Written by `agent-scheduler add` or the "New automation" form of the Automations page, as one of two kinds, the person's choice. While its file reads as the tool writes one, the tool shows it, saves it again under its name and removes it (`agent-scheduler show`, `edit` and `remove`, or "Edit prompt" and "Remove" on the Automations page); an automation whose file was changed by hand into something the tool does not write is edited and removed by hand. A shared automation is a command skill of the project (a skill run as the slash command `/<name>`, never picked up by the coding agent on its own): the file `.claude/skills/<name>/SKILL.md`, whose text is the prompt and whose front matter carries that `schedule`; the person commits it, and from then on it is a skill like any other, and its command a scheduled command like any other. An automation kept on this machine is one file written the same way, `.agent-scheduler/automations/<name>.md`, in the tool's own folder, which is hidden from git: nothing is to commit and nobody else gets its command, though its text is in the record of each of its runs, which is shared where the project shares its records. It is no skill and no slash command: its command is listed, switched and started like any other scheduled command, a run of it has the automation's name as its prompt, with no slash, and is handed the file's text with it, its runs are counted on this machine alone (where a command's runs in flight or its last start are said to be counted on any machine, for it that is this machine's), and what is said of a command's skill (the interval and the check its skill gives, its skill's number of agents, what its skill says it does) is, for it, said of that file.
[2] check: the shell line a skill's `schedule` gives a scheduled command as `when`: the scheduler runs it in the project, every minute at most, while the command is switched on and the time between two of its starts has passed, when it has one, and starts an agent when it prints something. The form calls it "a shell line".
[3] draft: what the automation form [7] holds of an automation while a person types it, before it is saved or saved again.
[4] interval: how often at most a scheduled command starts as its skill says it, the `every` of the skill's `schedule`: a count from 1 to 9999 and a unit of minutes, hours, days, weeks or months (`15m`, `1d`).
[5] start point: the commit a scheduled run's checkout starts from: origin's default branch (`origin/main`), or, in a repository with no remote, the commit the person's own checkout is on (`HEAD`). Never the files in a person's own checkout: a skill written there and not committed, or committed and not yet on origin's default branch, is not on the start point.
[6] page row: one line of the Automations page: one scheduled command of one project, with its checkbox and its "Edit".
[7] automation form: the form of the Automations page in which a person types an automation [1]. Opened by "New automation" beside a project's name, it is empty, is named "New automation" and saves a new automation. Opened by "Edit prompt" on a page row [6], it holds that page row's automation as its file says it, is named "Prompt of <the page row's name>" and saves that automation again under its name.

## Business logic — TL;DR

- **A draft** - a name, a prompt, whether it runs on an interval [4], the interval's count as the text typed and its unit, a check [2], plain words for what the check waits for, and whether it is kept on this machine; a new form opens on no name, no prompt, an interval of 1 day, no check, shared with the project.
- **The draft's interval** - the count and the unit as a skill writes them (`15m`); none while the interval is unticked, or while the count is no whole number from 1 to 9999.
- **An automation opened from its page row** - what `agent-scheduler show` printed, read into the draft the form opens on and the automation's file: the interval as a count and a unit, unticked when the automation has none; nothing opens when the answer lacks the name, the prompt or the file, or holds an interval the form cannot show.
- **What keeps a draft from being saved** - one sentence for the person, the first thing first: no name, a name that is no command's name, a name longer than 64 characters, no prompt, a prompt, a check or plain words longer than 4000 characters, a count that is no number yet, nothing that says when it runs; nothing when it can be saved. For an automation opened from its page row, a prompt too long for the form is to be changed in its file, which the sentence names.
- **The words beside the interval** - "by time alone", "at most, and only when the shell line below prints something", "not on a pace: the shell line below alone says when" or "not on a pace", by whether the interval is ticked and whether there is a check.
- **A draft nothing was typed into** - no name, no prompt, no check and no plain words, whatever the interval holds and whoever gets it: closing a new form with such a draft loses nothing.
- **The command that saves a draft** - for a new automation, `add <name> --prompt=<prompt>`, then `--every=<interval>` when the interval is ticked, `--when=<check>` when there is a check, `--waits-for=<plain words>` only beside a check, and `--private` last when the draft is kept on this machine; for one opened from its page row, `edit <name>` with all four flags, `--prompt=`, `--every=`, `--when=` and `--waits-for=`, a part the draft does not have going as an empty flag, which takes it out of the file, and never `--private`; each text one argument together with its flag; none while something keeps the draft from being saved.
- **Whether a draft says something else** - two drafts say the same when the name, the prompt, the interval, the check and the plain words they would save are the same, who gets it left aside: a draft opened from a page row has nothing to save, and loses nothing when its form is closed, until it says something else than the one it opened on.
- **When a draft would run** - the sentence its page row [6] would say, made by the same rule as every page row's (`schedulers.ts`); none while nothing says when, or while the count is half typed.
- **What a try answered** - what `agent-scheduler try` printed, as the form shows it: what the check printed, the time it was given, and a verdict with its tone: an agent would start, nothing to do, or the line failed and why; an answer that is not what the command promises reads as a line that failed.
- **What a save answered** - what `agent-scheduler add` or `edit` printed: the file it wrote, where a run's checkout starts and whether the automation is kept on this machine; what the person has to do with a new one: for a shared automation, that the file is theirs and where it has to get to before its page row [6] can start, for one kept on this machine, that nothing is to commit and its page row can start as soon as it is switched on; with one saved again: for a shared automation, that the change is theirs to commit and that an agent is told the new words only once the change is on the start point [5], for one kept on this machine, that nothing is to commit, and for both that its past runs, its switch and the person's picks stay; and the sentence that says when the page row shows it, by whether the project's scheduler is running.
- **Where a draft is saved** - the note under the form: for a new draft, by its choice, a skill file in the project that the person commits, or kept on this machine alone, outside git; for one opened from its page row, where its file is, which the form cannot change.
- **A removal, before and after** - what a page row says before its automation is removed: what is deleted, that one kept on this machine cannot be brought back, that git can bring back only what was committed of a shared one, that everyone else keeps a shared one until the deletion reaches them, and what goes and what stays; and what `agent-scheduler remove` printed, said as what was deleted and what is left for the person to do, by what git still holds of the file: nothing for one kept on this machine or one git never had, to commit the deletion and bring it to the start point [5] for one that is in a commit, to take the file out of the next commit for one that was staged and never committed, and to look with git where what git holds could not be read.

## Business logic

### A draft

#### Context

See `## Context`.

#### Business logic

A draft [3] holds:

- The name: the command's name, without its slash.
- The prompt: what the agent is told.
- Whether the automation runs on an interval [4], and that interval as a count, kept as the text typed, and a unit (minutes, hours, days, weeks or months).
- The check [2]: empty for none.
- Plain words for what the check waits for, which the page row [6] will say.
- Whether it is kept on this machine [1], and not shared with the project.

A new form opens on an empty name and an empty prompt, the interval ticked with a count of 1 and days, no check and no plain words, shared with the project: once a day. A form opened from a page row opens on the draft read from that automation's file (below).

The draft's interval, as a skill writes one, is the count and the unit read by the tool's own rule (`../src/pace.ts`): `15m` for 15 and minutes, spaces around the count ignored. It has none while the interval is unticked, and none while the count is not a whole number from 1 to 9999 written in digits alone (empty, `0`, `1.5`).

### An automation opened from its page row

#### Context

See the second user story and the last **Problem** in `## Context`.

#### Business logic

What `agent-scheduler show` printed for an automation [1] (`../src/cli.ts`) is read into two things: the draft [3] the form opens on, and the automation's file as a path from the project's root. The draft is:

- The name and the prompt, as printed.
- The interval [4]: when the answer holds one that the tool's own rule reads (`../src/pace.ts`: `15m`, `2w`), the interval is ticked, with that count and that unit. When the answer holds none, the interval is unticked, on the count of 1 and days a new form opens with.
- The check [2] and the plain words, when the answer holds each as text, else empty.
- Kept on this machine only when the answer says so, exactly true.

Nothing opens, in two cases. The answer is not what the command promises: it is no object, or it lacks the name, the prompt or the file as text. Or the answer holds an interval the form has no fields for: one that is no text, or text the tool's rule does not read (`often`). In both the form would save something other than what the file says, so it is not opened at all, and the page says so on the page row (`AutomationsPage.tsx`).

A form opened this way and saved with nothing changed would run `edit` with what the file says, part for part.

### What keeps a draft from being saved

#### Context

See the first **Problem** in `## Context`.

#### Business logic

One sentence for the person typing, the first of these that holds; spaces around the name are ignored:

1. The name is empty: "Give it a name. It becomes the command, like /answer-comments."; or, for a draft kept on this machine, which becomes no command a person types, "Give it a name, like answer-comments."
2. The name is not lower-case letters, digits and dashes, starting with a letter or a digit, with no three dashes in a row (`../src/names.ts`; `Answer comments`, `a---b`): "A name is lower-case letters, digits and dashes, never three dashes in a row, like answer-comments."
3. The name is longer than 64 characters (`../src/names.ts`): "A name is 64 characters at most."
4. The prompt is empty or only whitespace: "Write what the agent is told."
5. The prompt, its surrounding whitespace removed, is longer than 4000 characters: "What the agent is told is <N> characters, and this form takes 4000 at most.", followed, for a new automation, by "Save a shorter one, then write the rest into the file.", and, for one opened from its page row, by "Change it in its file, <file>.", the file being the one the automation was opened from.
6. The check, its surrounding whitespace removed, is longer than 4000 characters: "The shell line is <N> characters, and this form takes 4000 at most."
7. There is a check, and the plain words for what it waits for, their surrounding whitespace removed, are longer than 4000 characters: "What the line waits for is <N> characters, and this form takes 4000 at most." Plain words beside no check are never sent, so their length does not count.
8. The interval is ticked and the draft has no interval yet (above): "Type a whole number, from 1 to 9999."
9. The interval is unticked and there is no check: "Say when it runs: on a pace, by a shell line, or both."

A draft none of these holds for can be saved, and has nothing to tell. A count left half typed does not count once the interval is unticked and a check says when. The two rules for a name are the ones the command itself refuses by (`../src/automation.ts`). The 4000 characters are the form's own limit, under the 4096 the dashboard takes in one argument with the flag before the text: the command line itself takes a longer prompt, which is why the sentence says to write the rest into the file. So an automation whose prompt is longer than that, saved from a shell, opens from its page row with the fifth sentence, and cannot be saved again from the form until the prompt is shorter.

### The words beside the interval

#### Context

**Problem**: an interval and a check decide together when an automation runs, and what the interval means changes with the check: alone it is a clock, beside a check it is only a limit. A person who unticks the interval must also see that the count and the unit left in the form no longer count.

#### Business logic

The words the form shows beside the interval's count and unit:

- The interval ticked, no check: "by time alone".
- The interval ticked, a check: "at most, and only when the shell line below prints something".
- The interval unticked, a check: "not on a pace: the shell line below alone says when".
- The interval unticked, no check: "not on a pace".

A check of whitespace alone is no check.

### A draft nothing was typed into

#### Context

**Problem**: Escape is pressed by a slip of a key. Closing a new form that holds a prompt a person just wrote would lose it; closing one that holds nothing loses nothing.

#### Business logic

Nothing was typed into a draft when its name, its prompt, its check and its plain words are all empty, exactly: one blank typed counts as typed. The interval does not count: a draft with the interval unticked, or with another count and unit, and no text is still one nothing was typed into. Neither does the choice of who gets it: a draft kept on this machine with no text is still one nothing was typed into. The form lets Escape close a new form only while its draft is such a one (`AutomationForm.tsx`). A form opened from a page row is never empty, and is held to another rule: whether its draft says something else than the one it opened on (below).

### The command that saves a draft

#### Context

See the second **Problem** in `## Context`.

#### Business logic

For a new automation, the words after `agent-scheduler`, for a draft that can be saved: `add`, the name, `--prompt=<the prompt>`, then `--every=<the draft's interval>` when the interval is ticked, `--when=<the check>` when there is a check, `--waits-for=<the plain words>` when there are plain words and a check, and last `--private` when the draft is kept on this machine. The name, the prompt, the check and the plain words each go with their surrounding whitespace removed. Each text is one argument together with its flag, so a prompt that opens with a dash stays the flag's own text. Plain words typed for a check that was then cleared are left out: they say what a check waits for, and there is none. A draft that cannot be saved yet has no such words.

So the form's opening draft with a name and a prompt saves as `add answer-comments --prompt=<prompt> --every=1d`, one with the interval unticked and a check as `add answer-comments --prompt=<prompt> --when=<check>`, and the opening draft kept on this machine as `add answer-comments --prompt=<prompt> --every=1d --private`.

For an automation opened from its page row, the words are `edit`, the name, and always all four flags: `--prompt=<the prompt>`, `--every=<the draft's interval>`, `--when=<the check>` and `--waits-for=<the plain words>`, each text with its surrounding whitespace removed. A part the draft does not have goes as an empty flag: `--every=` when the interval is unticked, `--when=` when there is no check, and `--waits-for=` when there are no plain words or no check. The command takes a part out of the file for an empty flag and leaves a part as the file says it for a flag left out (`../src/cli.ts`), so every flag is sent: what the person cleared in the form is gone from the file, and nothing the form does not show stays behind. The words never hold `--private`: where an automation is kept is not the command's to change, whatever the draft holds there. So a draft whose interval was unticked saves as `edit answer-comments --prompt=<prompt> --every= --when=<check> --waits-for=<plain words>`, and one whose check was cleared as `edit answer-comments --prompt=<prompt> --every=15m --when= --waits-for=`, whatever the plain words field still holds. A draft that cannot be saved yet, a prompt too long for the form among the reasons, has no such words.

### Whether a draft says something else

#### Context

**User story**: the user opened an automation from its page row to read its prompt, and changed nothing. Save has nothing to do, and the form says so.

#### Business logic

Two drafts say the same when what they would save is the same: the name, the prompt, the draft's interval, the check and the plain words, each as the command that saves a new automation would be given it. So what the command is not given does not count: blanks around a text, plain words beside no check, the count and the unit of an unticked interval, and who gets it. Another prompt, another count or unit, the interval unticked, another check and other plain words beside a check each make a draft say something else. The form compares the draft with the one it opened on from a page row: while the two say the same, there is nothing to save, and Escape closes the form, since closing it loses nothing (`AutomationForm.tsx`).

### When a draft would run

#### Context

**User story**: before saving, the user reads when the automation would run, said the way its page row [6] will say it, so nothing reads differently once it is listed.

#### Business logic

The sentence is the one `schedulers.ts` makes for a scheduled command at its skill's own pace: the draft's interval and its check, with the plain words when there are both plain words and a check. So:

- An interval alone: "Every 1 day".
- An interval and a check: "Every 15 minutes at most, when its check finds work", or with plain words "Every 15 minutes at most, when someone commented".
- A check alone: "When its check finds work", or with plain words "When someone commented".

There is no sentence while the draft has neither an interval nor a check, and none while the interval is ticked and its count is no number yet, also beside a check. The sentence does not name the command, so it is there before a name is typed.

### What a try answered

#### Context

See the third **Problem** in `## Context`.

#### Business logic

What `agent-scheduler try` printed (`../src/cli.ts`) is read into what the form shows:

- The time the check [2] was given as `$LAST_RUN`, when the answer holds one as text.
- What the check printed, when the answer holds it as text, else nothing.
- A verdict and its tone, by the first that holds:
  1. The answer does not say the check ran: "The line failed: <the error>" when the answer holds an error that is not empty, else "The line failed."; the tone is failed.
  2. The answer says an agent would start: "It printed something: an agent would start now."; the tone is start.
  3. Otherwise: "It printed nothing to do: no agent would start."; the tone is quiet.

The reading is forgiving: an answer that is no object, or whose fields are not what the command promises (a `ran` that is a word, a `printed` that is a number), reads as "The line failed." with nothing printed.

### What a save answered

#### Context

**Problem**: saving a shared automation writes a file into the person's own checkout, and a scheduled run's checkout is made from the start point [5]. A person who is not told would switch the new page row on and wait for an agent that cannot start. An automation kept on this machine has no such way to go: a person told to commit it would look for a file git does not show.

**Problem**: saving a shared automation again changes that file in the person's own checkout. The scheduler reads the interval and the check from there at its next tick, while an agent, in a checkout made from the start point [5], is told the prompt that is committed there. A person who is not told would see the page row say the new pace and expect the new words.

See also the fifth **Problem** in `## Context`.

#### Business logic

What `agent-scheduler add` printed, and what `agent-scheduler edit` printed (`../src/cli.ts`), is read the same way: as the file it wrote, as a path from the repository root, where a run's checkout starts, the start point [5] by name, and whether the automation is kept on this machine: it is only when the answer says so, exactly true. An answer without the file reads as "a skill file", and one without the start point's name as `HEAD`.

What the person has to do with a new automation follows its kind. One kept on this machine: "It is kept on this machine alone: nothing to commit, and nobody else gets the row. Its row can start as soon as you switch it on. Its prompt is in the record of each run, which is shared where this project shares its records.", and the start point is not named. Only the row is this machine's alone: the prompt travels with each run's record, so the person is told. A shared one: "It is a file of yours, in this project, and nothing was committed for you.", followed by the sentence that says where the file has to get to.

That sentence follows the start point's name: "Its row cannot start before the file is on <start point>: commit it and bring it there." ("Its row cannot start before the file is on origin/main: commit it and bring it there."), or, for `HEAD`, as in a repository with no remote, "Its row cannot start before you commit the file."

The sentence that says when the new automation's page row [6] shows follows whether the project's scheduler is running, which the page tells the form: "Its row shows here once the scheduler has looked, within a minute. It starts switched off." where it is; "The scheduler is not running in this project, so its row does not show yet: it shows once the scheduler runs. It starts switched off." where it is not.

What the person has to do with an automation saved again follows its kind too:

- One kept on this machine: "It is kept on this machine alone: nothing to commit. The scheduler uses the new words from its next look. Its past runs, its switch and your picks for it stay."
- A shared one: "It is a change to a file of yours, in this project, and nothing was committed for you. An agent is told the new words only once the change is on <start point>: commit it and bring it there. The pace and the shell line are read from your file, so the scheduler uses the new ones from its next look. Its past runs, its switch and your picks for it stay." For `HEAD` the second sentence is "An agent is told the new words only once you commit the change."

The sentence that says when the page row shows what was saved again: "Its row shows the change once the scheduler has looked, within a minute." where the project's scheduler is running; "The scheduler is not running in this project, so its row shows the change once the scheduler runs." where it is not.

### Where a draft is saved

#### Context

**User story**: before saving, the user reads under the form what their choice of who gets the automation means for them: a file to commit, or nothing to do. For an automation they opened from its page row, that choice was made when it was saved, and they read where its file is.

#### Business logic

The note the form shows beside its buttons, for a new automation, follows the draft's choice:

- Shared with the project: "Saved as a skill file in this project, which you commit. The row starts switched off."
- Kept on this machine: "Kept on this machine alone, outside git. The row starts switched off, and can start as soon as you switch it on."

For an automation opened from its page row, the note says where it is saved, with its file, which the form cannot change:

- Shared with the project: "A skill file in this project, <file>: the change is yours to commit."
- Kept on this machine: "Kept on this machine alone, outside git: <file>."

### A removal, before and after

#### Context

See the third user story in `## Context`.

**Problem**: a shared automation that is removed leaves a deletion in the person's own checkout, and everyone else who has the project keeps its command until that deletion is on origin's default branch. Git can bring back only what was committed of its file. An automation kept on this machine is in no git: once removed, nothing brings it back. A person must read which of these they are about to do before they confirm, and afterwards whether anything is left for them to do.

**Problem**: a file that was staged and never committed is still in git's index after it is deleted. Told to "commit the deletion", the person would commit the very file they removed.

#### Business logic

Before a removal, the page row [6] says what removing its automation [1] does, by its kind:

- Kept on this machine: "Its file is deleted. It is kept on this machine alone, outside git, so it cannot be brought back. Its switch and your picks for it go with it. The records of its past runs stay."
- Shared with the project: "Its skill file is deleted from your files in this project, and nothing is committed for you. Git can bring back only what you committed of it: a file never committed, or your last changes to it, cannot be brought back. Everyone else who has the project keeps the row until your deletion reaches them. Its switch and your picks for it go with it. The records of its past runs stay."

After a removal, what `agent-scheduler remove` printed (`../src/cli.ts`) is said in one sentence that opens "Removed <the page row's name>: <file> is deleted", the file being the one the answer names, or "its file" when the answer names none. It goes on by the first of these that holds:

1. The answer says the automation was kept on this machine, exactly true: ". Nothing is to commit."
2. The answer says git still holds the file in a commit (`git` is `committed`): ", and nothing was committed for you.", followed by "Commit the deletion and bring it to <start point>: until then everyone else who has the project keeps the row." for the start point [5] the answer names, or by "Commit the deletion." for `HEAD`, which also stands in when the answer names no start point.
3. The answer says the file was staged and never committed (`git` is `staged`): ". It was staged and never committed, so a commit made now would still add it: take it out of the next commit with "git rm --cached <file>"."
4. The answer says git never had the file (`git` is `nothing`): ". Git never had the file, so nothing is to commit."
5. Otherwise, git could not be asked (`git` is `unknown`) or the answer does not say: ". What git holds of it could not be read: look with "git status"."

So "Removed /answer-comments: .claude/skills/answer-comments/SKILL.md is deleted, and nothing was committed for you. Commit the deletion and bring it to origin/main: until then everyone else who has the project keeps the row.", and "Removed tidy: .agent-scheduler/automations/tidy.md is deleted. Nothing is to commit." The reading is forgiving: an answer that is no object, or that says nothing of git, still says the automation is gone, and sends the person to git to look, "Removed tidy: its file is deleted. What git holds of it could not be read: look with "git status"."
