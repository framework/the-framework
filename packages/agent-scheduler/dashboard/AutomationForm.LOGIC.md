The automation form [7] of the Automations page: where a person saves a prompt of their own as an automation [1] of one project, and where they save one again under its name. It holds a name, what the agent is told, when it runs: on an interval [3], by a check [2], or both; and, for a new automation, who gets it: the project, or this machine alone. "Try it" runs the check once in the project and shows what it printed and whether an agent would start. Opened by "New automation" the form is empty, and "Save" writes a new automation, into the project as a skill file or, kept on this machine, into the scheduler's own folder. Opened from a page row [5] by "Edit prompt" it holds that automation as its file says it, its name fixed, and "Save" writes its file anew where it is. Either way the form then says where the file is, what the person has to do with it, and when the page row shows it. The Automations page (`AutomationsPage.tsx`) opens the form, under a project's name or in a page row; what the form holds, checks and says is worked out in `automation-form.ts`.

## Context

**User story**: the user wants an agent to answer each new comment on the project's issues, and no skill of the project does that. On the Automations page they press "New automation" beside the project's name, type `answer-comments`, "Answer each new comment below.", every 15 minutes, and a shell line that lists the comments posted since `$LAST_RUN`. They press "Try it" and read what the line prints today and that an agent would start. They type "when someone commented" for what the line waits for and read "Every 15 minutes at most, when someone commented." They press Save and read where the file is and that its row cannot start before the file is on origin/main. They commit the file and bring it there; the row `/answer-comments` is on the page, switched off, and they check its checkbox.

**User story**: another user wants an agent to look at a competitor's forum every hour, for themselves alone. In the same form they pick "Only on this machine" under "Who gets it" and press Save. They read "It is kept on this machine alone: nothing to commit, and nobody else gets the row. Its row can start as soon as you switch it on. Its prompt is in the record of each run, which is shared where this project shares its records." Within a minute the row `watch-competitor`, marked "only on this machine", is on the page, switched off, and they check its checkbox.

**User story**: weeks later the first user wants the agent to answer in one line, every 30 minutes. They press "Edit prompt" on the row `/answer-comments`. The form opens in the row, named "Prompt of /answer-comments", holding the name, the prompt, 15 minutes, the shell line and "when someone commented", and says "Every 15 minutes at most, when someone commented. Nothing is changed yet." They change the prompt and the count and press Save. They read "Saved /answer-comments again, in .claude/skills/answer-comments/SKILL.md.", that the change is theirs to commit, and that an agent is told the new words only once the change is on origin/main.

**Business logic story**: everything else on the Automations page is a person's choice for their own machine, kept in the scheduler's state, which git does not track. A shared automation [1] is not: it is a skill file of the project, written into the person's own checkout by `agent-scheduler add` and written anew by `agent-scheduler edit` (`../src/automation.ts`), with a page row like any skill's. An automation kept on this machine [1] is the person's own too: a file beside that state, written by the same commands, with a page row that says so. The form runs its commands in the project: `agent-scheduler try`, and `agent-scheduler add` for a new automation or `agent-scheduler edit` for one opened from its page row. It reads no skill file and writes none itself: what an automation opened from its page row holds was read by the page, with `agent-scheduler show`, and handed to the form (`AutomationsPage.tsx`).

**Problem**: a scheduled run's checkout is made from the start point [4], not from the person's own checkout, where a shared automation's file is written and changed. And the page lists what the scheduler's last tick [6] recorded, so a new page row, or a change to one, is not there the moment the file is. A person who is told neither would see nothing happen after Save, or switch the row on and wait for an agent that cannot start, or expect an agent to be told the new words before the change is where its checkout starts.

**Problem**: a try takes as long as the check takes, and the person may change the check meanwhile. An answer shown under a check it was not for would say that a line nobody tried starts an agent.

**Problem**: a prompt takes minutes to write, and Escape is one slip of a key away. A form that closed on Escape with a prompt in it would lose it.

**Problem**: an automation's runs are counted by its name, and this machine's switch and picks for it are kept under its name. An automation saved again under another name would be another command, with none of them.

**Problem**: the pace typed in the form is the one saved in the automation's file. On a machine where the person set a pace pick of their own for the command, that pick stays in force after the file is saved again. A person who is not told would change the pace in the form and see the row run as before.

## Glossary

[1] automation: a person's own prompt saved as a scheduled command, with the `schedule` the person picked (the key where a skill says when its command is due), an interval [3], a check [2] or both. Written by `agent-scheduler add` or the "New automation" form of the Automations page, as one of two kinds, the person's choice. While its file reads as the tool writes one, the tool shows it, saves it again under its name and removes it (`agent-scheduler show`, `edit` and `remove`, or "Edit prompt" and "Remove" on the Automations page); an automation whose file was changed by hand into something the tool does not write is edited and removed by hand. A shared automation is a command skill of the project (a skill run as the slash command `/<name>`, never picked up by the coding agent on its own): the file `.claude/skills/<name>/SKILL.md`, whose text is the prompt and whose front matter carries that `schedule`; the person commits it, and from then on it is a skill like any other, and its command a scheduled command like any other. An automation kept on this machine is one file written the same way, `.agent-scheduler/automations/<name>.md`, in the tool's own folder, which is hidden from git: nothing is to commit and nobody else gets its command, though its text is in the record of each of its runs, which is shared where the project shares its records. It is no skill and no slash command: its command is listed, switched and started like any other scheduled command, a run of it has the automation's name as its prompt, with no slash, and is handed the file's text with it, its runs are counted on this machine alone (where a command's runs in flight or its last start are said to be counted on any machine, for it that is this machine's), and what is said of a command's skill (the interval and the check its skill gives, its skill's number of agents, what its skill says it does) is, for it, said of that file.
[2] check: the shell line a skill's `schedule` gives a scheduled command as `when`: the scheduler runs it in the project, every minute at most, while the command is switched on and the time between two of its starts has passed, when it has one, and starts an agent when it prints something. The form calls it "a shell line".
[3] interval: how often at most a scheduled command starts as its skill says it, the `every` of the skill's `schedule`: a count from 1 to 9999 and a unit of minutes, hours, days, weeks or months (`15m`, `1d`).
[4] start point: the commit a scheduled run's checkout starts from: origin's default branch (`origin/main`), or, in a repository with no remote, the commit the person's own checkout is on (`HEAD`). Never the files in a person's own checkout: a skill written there and not committed, or committed and not yet on origin's default branch, is not on the start point.
[5] page row: one line of the Automations page: one scheduled command of one project, with its checkbox and its "Edit".
[6] tick: one pass of the scheduler, every minute: one decision per scheduled command, each one line in the state.
[7] automation form: the form of the Automations page in which a person types an automation [1]. Opened by "New automation" beside a project's name, it is empty, is named "New automation" and saves a new automation. Opened by "Edit prompt" on a page row [5], it holds that page row's automation as its file says it, is named "Prompt of <the page row's name>" and saves that automation again under its name.

## Business logic — TL;DR

- **The form, opened by "New automation"** - a box named "New automation" under the project's name: "Name", "What the agent is told", "When it runs" ("Every" with a count and a unit, which can be unticked, words beside them saying how the interval [3] and the check [2] decide together, a shell line that prints what is new, "Try it", and, once there is a shell line, plain words for what it waits for), "Who gets it" (shared with the project, which the form opens on, or only on this machine), one line saying what is missing or when the automation would run, a note saying where it will be saved, by that choice, "Cancel" and "Save"; "Save" is disabled while something is missing.
- **The form, opened from a page row** - the same box, in the page row [5], named "Prompt of <the page row's name>", holding the automation as its file says it; the name cannot be changed and says why; "Who gets it" is not asked; where the page row runs at the person's own pace pick, a note says that pick stays in force; the one line says "Nothing is changed yet." after when the automation runs, and "Save" is disabled, until the form says something else than the file; the note says where the file is.
- **Try it** - runs `agent-scheduler try --when=<the check>` in the project, for 20 seconds at most, and shows, under the check [2], what it answered: an agent would start, nothing to do, or the line failed and why, then what the check printed and the time it was given as `$LAST_RUN`; the answer shown is always for the check as it stands: changing the check takes the answer away and drops a try in flight, and only the latest try's answer is taken.
- **Save** - runs `agent-scheduler add …` in the project for a new automation, `agent-scheduler edit …` for one opened from its page row; while it runs nothing in the form can be changed; a save not taken says "Not saved: <why>" and keeps what was typed; a save that is taken replaces the form with a panel: where the file is; for a new shared automation, that the file is the person's, that nothing was committed and where it has to get to before its page row [5] can start; for a new one kept on this machine, that nothing is to commit and its page row can start as soon as it is switched on; for one saved again, that a shared one is a change to commit and an agent is told the new words only once the change is on the start point [4], that one kept on this machine needs nothing, and that its past runs, its switch and the person's picks stay; and when the page row shows it, which depends on whether the project's scheduler is running; the page reads its rows again; "Done" closes the panel.
- **Cancel and Escape** - "Cancel" closes the form and saves nothing, whatever was typed; Escape closes only a form that has nothing to lose: a new form nothing was typed into, and a form opened from a page row that would still save the automation it was opened from; a new form opened again is empty.

## Business logic

### The form, opened by "New automation"

#### Context

See `## Context`.

#### Business logic

The form is a box, named "New automation" for a screen reader, drawn under the name of the project it was opened in. The page tells it which project that is and whether that project's scheduler is running (on, with a live process), which the panel shown after a save uses (below). It opens on the draft `automation-form.ts` gives: no name, no prompt, every 1 day, no check. From the top it holds:

- "Name": a text field, with the focus when the form opens. A "/" stands before it while the automation is shared with the project: its name becomes a command a person can type. With "Only on this machine" checked (below) the "/" is gone: such an automation is no command to type.
- "What the agent is told": a field of several lines, the prompt.
- "When it runs":
  - A checkbox "Every", a count ("How many", a number from 1 to 9999) and a unit menu: the interval [3]. The menu reads "minute", "hour", "day", "week", "month" while the count is 1, and "minutes", "hours", "days", "weeks", "months" otherwise. The count and the unit can be changed only while "Every" is ticked. Beside them stand the words `automation-form.ts` gives for how the interval and the check decide together: "by time alone", "at most, and only when the shell line below prints something", "not on a pace: the shell line below alone says when", or "not on a pace".
  - "A shell line that prints what is new", marked optional: a field of several lines, the check [2]. Under it: "Run in this project while the row is on: every minute, or once the pace above has passed. When it prints something, an agent starts and is handed what it printed; when it prints nothing, or an empty list, nothing starts. $LAST_RUN is the time the row last started an agent, or was switched on when that is later."
  - "Try it", with the words "Runs the line once, now, on this machine, for 20 seconds at most. Nothing is saved and no agent starts." (below).
  - "What the line waits for, in plain words", marked "optional, said on the row": one line of text. It shows only while the check is not empty.
- "Who gets it", one choice of two, the first checked when the form opens:
  - "Shared with the project", with the words "a file you commit; everyone who has the project gets the row, switched off".
  - "Only on this machine", with the words "nothing to commit; nobody else gets the row": the automation is kept on this machine [1].
- One line that follows everything above: what still keeps the automation from being saved, as `automation-form.ts` says it, the first thing first ("Give it a name. It becomes the command, like /answer-comments.", or "Give it a name, like answer-comments." with "Only on this machine" checked; for a prompt, a check or plain words too long for the form to hand over, how long it is and that the form takes 4000 characters at most); once nothing does, when the automation would run, as its page row [5] will say it, with a full stop ("Every 1 day.", "Every 15 minutes at most, when someone commented.", "When someone commented." with "Every" unticked).
- A note that follows the choice under "Who gets it", as `automation-form.ts` words it: "Saved as a skill file in this project, which you commit. The row starts switched off.", or "Kept on this machine alone, outside git. The row starts switched off, and can start as soon as you switch it on."
- "Cancel" and "Save". "Save" is disabled while something keeps the automation from being saved.

Typing in a field saves nothing.

### The form, opened from a page row

#### Context

See the third user story and the last two **Problems** in `## Context`.

#### Business logic

Opened from a page row [5], the form is the same box, drawn in that page row, under its line. The page hands it the automation [1] it read from the file with `agent-scheduler show`, as the draft `automation-form.ts` makes of it and the file's path, whether the project's scheduler is running, and, only when the page row runs at a pace pick of the person's own on this machine, that pace as the page row says it ("Every 6 hours"). The box is named "Prompt of <the page row's name>" for a screen reader: "Prompt of /answer-comments" for a shared automation, "Prompt of tidy" for one kept on this machine. It opens holding what the file says: the name, the prompt, "Every" ticked with the file's count and unit or unticked when the file has no interval, the check, and the plain words. What differs from a new form:

- "Name" cannot be changed: the field is read-only and dimmed, and beside it stand the words "the name stays: its past runs are counted by it. For another name, make a new automation and remove this one." The "/" stands before it for a shared automation and not for one kept on this machine. The focus, when the form opens, is on "What the agent is told".
- Under the interval, only when the page handed the form a pace pick of the person's own: "On this machine the row runs at your own pick, "<that pace>", and keeps doing so: this pace is the one saved with the automation. The row's Edit changes your pick."
- "Who gets it" is not there: where an automation is kept was chosen when it was saved, and saving it again does not change it.
- The one line says what keeps the automation from being saved, as for a new form, a prompt too long for the form being one to change in the automation's file, which the line names. Once nothing does, it says when the automation would run, and, while the form says nothing else than the file (`automation-form.ts`), "Nothing is changed yet." after it: "Every 15 minutes at most, when someone commented. Nothing is changed yet."
- The note says where the automation is saved, as `automation-form.ts` words it: "A skill file in this project, <file>: the change is yours to commit.", or "Kept on this machine alone, outside git: <file>."
- "Save" is disabled while something keeps the automation from being saved, and also while the form says nothing else than the file.

"Try it" works as in a new form (below).

### Try it

#### Context

See the second **Problem** in `## Context`.

**User story**: a shell line typed into a form has never run. Before saving it, the user wants to know that it runs here, what it prints, and whether that would start an agent.

#### Business logic

"Try it" is disabled while the check [2] is empty. Pressed, it runs `agent-scheduler try --when=<the check>` in the project, the check with its surrounding whitespace removed, and reads "Trying…", disabled, until the answer is back or the check is changed. The command runs the check once, now, as the scheduler would, for 20 seconds at most, and gives it the time a day ago as `$LAST_RUN` (`../src/automation.ts`): an automation that does not exist yet has never started, and asking what is new since now would show nothing. The 20 seconds are less than the minute the scheduler gives a check, and less than the dashboard waits for a command, so a check that takes too long is answered as one that failed ("The line failed: it took longer than 20 seconds") instead of not being answered.

The answer shows under the check, in a box named "What the line answered" for a screen reader, as `automation-form.ts` reads it:

- The verdict: "It printed something: an agent would start now." in green; "It printed nothing to do: no agent would start."; or "The line failed: <why>" in red.
- What the check printed, when it printed anything, as it was printed, in a box that scrolls. Output longer than 8000 characters is cut as a run would be handed it, its last line saying so (`../src/automation.ts`).
- "Tried as if the row had last started a day ago: $LAST_RUN was <time>.", when the answer holds that time.

When the command itself could not be run, or refused, the box says "The line could not be tried: <why>" in red, and nothing else.

The answer shown is always for the check as it stands. Changing the check takes the shown answer away and drops a try in flight: the button reads "Try it" again, and the answer of the dropped try, when it comes back, changes nothing. Only the latest try's answer is taken: with a second try asked while the first is still running, the first one's late answer is not shown, and the button stays "Trying…" until the second answers. Trying saves nothing and starts no agent.

### Save

#### Context

See the first **Problem** and the business logic story in `## Context`.

#### Business logic

"Save" runs the command `automation-form.ts` words for the draft, in the project. For a new automation that is `agent-scheduler add <name> --prompt=… [--every=…] [--when=…] [--waits-for=…] [--private]`, `--private` when "Only on this machine" is checked. For an automation opened from its page row it is `agent-scheduler edit <name> --prompt=… --every=… --when=… --waits-for=…`, always with all four flags, so all the form holds takes the place of what the file said: a part the form does not have goes as an empty flag, which takes it out of the file, so an interval that was unticked, or a check that was cleared, is gone from the file, and with a cleared check what it waited for. While the command runs, every field, "Try it", "Cancel" and "Save" are disabled, so nothing more can be typed and no second save can be asked, and Escape does nothing.

A save that is not taken, because the command refused it or could not be asked, leaves the form as it is, with what was typed, and shows an alert under the one line: "Not saved: <why>", the reason being the command's own line. For a new automation that is a name that is taken, by a skill of the project or by an automation kept on this machine ("Not saved: that name is taken: .claude/skills/answer-comments"), or a `schedule` that cannot run as written. For one opened from its page row it is also a file that was changed by hand, after the form opened, into something the tool does not write ("Not saved: .claude/skills/answer-comments is a skill of the project, or an automation changed by hand since it was saved: edit or remove its files yourself"). Typing in any field takes the alert away.

A save that is taken replaces the form with a panel under the same name, "New automation" or "Prompt of <the page row's name>". For a new automation it holds:

- "Saved /<name> as <file>.", the file as a path from the project's root (`.claude/skills/answer-replies/SKILL.md`). For an automation kept on this machine the name stands without its slash, since it is no command to type: "Saved watch-competitor as .agent-scheduler/automations/watch-competitor.md."
- What the person has to do with it, as `automation-form.ts` says it. For an automation kept on this machine: "It is kept on this machine alone: nothing to commit, and nobody else gets the row. Its row can start as soon as you switch it on. Its prompt is in the record of each run, which is shared where this project shares its records.", and nothing about committing. For a shared one: "It is a file of yours, in this project, and nothing was committed for you.", followed by where the file has to get to, as `automation-form.ts` says it for the start point [4] the command named: "Its row cannot start before the file is on origin/main: commit it and bring it there.", or, in a repository with no remote, "Its row cannot start before you commit the file."
- When the page row [5] shows, as `automation-form.ts` says it: where the project's scheduler is running, "Its row shows here once the scheduler has looked, within a minute. It starts switched off."; where it is off, or on with no live process, "The scheduler is not running in this project, so its row does not show yet: it shows once the scheduler runs. It starts switched off." The page lists what the scheduler's last tick [6] recorded, and a scheduler that is not running ticks no more.
- "Done", which closes the panel.

For an automation saved again it holds:

- "Saved /<name> again, in <file>.", the name without its slash for one kept on this machine: "Saved tidy again, in .agent-scheduler/automations/tidy.md."
- What the person has to do with it, as `automation-form.ts` says it. For an automation kept on this machine: "It is kept on this machine alone: nothing to commit. The scheduler uses the new words from its next look. Its past runs, its switch and your picks for it stay." For a shared one: "It is a change to a file of yours, in this project, and nothing was committed for you. An agent is told the new words only once the change is on origin/main: commit it and bring it there. The pace and the shell line are read from your file, so the scheduler uses the new ones from its next look. Its past runs, its switch and your picks for it stay.", or, in a repository with no remote, "…only once you commit the change."
- When the page row shows the change: where the project's scheduler is running, "Its row shows the change once the scheduler has looked, within a minute."; where it is not, "The scheduler is not running in this project, so its row shows the change once the scheduler runs."
- "Done", which closes the panel.

When the save is taken, the form also tells the page, which reads every project's rows again at once (`AutomationsPage.tsx`).

### Cancel and Escape

#### Context

See the third **Problem** in `## Context`.

#### Business logic

"Cancel" closes the form and saves nothing, whatever was typed. Escape, pressed anywhere in the form, closes it only when the form has nothing to lose, by `automation-form.ts`'s two rules. A new form: nothing was typed into it, its name, its prompt, its check and its plain words all empty, whatever the "Every" box, the count and the unit hold and whatever is checked under "Who gets it". A form opened from a page row: it says nothing else than the automation it was opened from, the same rule that keeps "Save" disabled, so a change of the interval alone, the count, the unit or "Every" unticked, keeps the form open as a change of a text does. In any other form Escape does nothing; neither does it while a save runs. What was typed is dropped when the form closes: a new form opened again is empty, and a form opened from a page row again holds what the file says then. The panel a taken save shows is closed by "Done" alone.
