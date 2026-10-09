The Automations page: the page this package adds to the dashboard, at `/automations`. It lists what starts by itself while nobody is at the keyboard: one group per project the page is given (every project that has the package, or the picked project [7] alone when one is picked in the dashboard), and in it one page row [6] per scheduled command of that project. A page row says what the command is, what its skill says it does, when it runs, how far its runs publish and what the scheduler last decided for it. Its checkbox is the command's schedule switch [2], and "Edit" opens the page row in place to set the command's pace pick [9], its agents pick [10] and its publish pick [3]. All of that is this machine's, read with `agent-scheduler status` and saved with `agent-scheduler switch`, `pace`, `agents` and `publish`. Beside each project's name, "New automation" opens a form (`NewAutomation.tsx`) in which a person saves a prompt of their own as an automation [13]. Shared with the project, it is the one thing here that is not this machine's: a skill file written into that project. Kept on this machine, it is a file beside the state [1], and its page row says "only on this machine". A scheduled command is off until its checkbox is checked here, runs at its skill's pace [8] until a pace pick is saved here, with its skill's number of agents at once until an agents pick is saved here, and its runs commit their work and push nothing until another publish pick is saved here.

## Context

**User story**: the project's `post-merge-cleanup` skill schedules a clean-up after merges. Like every scheduled command it is off on every machine until someone switches it on there. The user opens Automations, reads under the project's name what `/post-merge-cleanup` does and when it runs, and checks its checkbox: from then on that project's scheduler starts it on this machine when it is due, and a teammate's machine is unchanged. Likewise a user unchecks `/work-queue` to stop their laptop from working the queue. A user who wants the queue's runs on their own machine to open a pull request presses "Edit" on `/work-queue`, picks "Open PR" and presses Save. A user who finds a skill's six hours too often for their laptop presses "Edit", picks "Every 2 days at 10:00" and presses Save; the page row then reads "Every 2 days at 10:00 · your pick". A user who wants three agents working the queue at once presses "Edit", picks "Up to 3 agents at once" and presses Save; the page row then reads "Up to 3 at once · your pick". No tracked file changes either way. A user who wants an agent to answer each new comment, which no skill of the project does, presses "New automation" beside the project's name, types a name, what the agent is told and when it runs, and presses Save: this time a file of the project is written, `.claude/skills/answer-comments/SKILL.md`, theirs to commit, and once the scheduler has looked `/answer-comments` is a page row like any other, switched off. A user who wants an agent to look at a competitor's forum for themselves alone picks "Only on this machine" in the same form: no file of the project is written, and once the scheduler has looked `watch-competitor` is a page row marked "only on this machine", written without a slash, which can start as soon as they check its checkbox. Later the user comes back and reads, on each page row, why nothing started ("No work", "One is already running", "Next: Saturday 10:00") or opens the run that did start.

**Business logic story**: a person decides, per machine, whether a command runs on its own, how often at most it starts, how many agents may work on it at once and how far its runs publish; the project's skills say which commands are scheduled and what each does, and give each a starting pace [8] and a starting number of agents. The page does not read the skills: its page rows are what each project's scheduler recorded at its last tick [4] (`schedulers.ts`). An automation [13] saved from the page's form is written by the package's own command (`../src/automation.ts`): a shared one is one more skill of the project, one kept on this machine a file in the scheduler's own folder. Either gets its page row the same way: once a tick has read it. The dashboard gives the page its projects, the projects that have this package or the picked project [7] alone, and runs this package's command for it; it knows nothing of what the page holds. The one setting that reaches every project, the spend offset, is not here: it is in the Scheduler section of the Settings page (`SchedulerSettings.tsx`).

**Problem**: every save is a separate process that reads the state [1], changes it and writes it back. Two at once could each write over the other's change.

## Glossary

[1] the state: `.agent-scheduler/state.json` at the project's root, per user, hidden from git: on or off, keep-alive, the model, the spend cushion, this machine's schedule switches, pace picks, agents picks and publish picks, the scheduler's pid, the last tick's decisions and the schedule it read. `agent-scheduler status` prints it, plus whether the scheduler's process is alive.
[2] schedule switch: a person's choice, on one machine, whether a scheduled command (a command one of the project's skills schedules in the front matter of its `SKILL.md`, or an automation kept on this machine [13]) runs there; kept in the state, not in the skill. Every scheduled command is off on a machine until a person switches it on there.
[3] publish pick: a person's choice, on one machine, of how far a scheduled command's runs publish there: nothing, a commit, the branch, a pull request, or a pull request set to merge on its own once its checks pass; kept in the state, not in the skill. Until the person picks, the command's runs commit their work and push nothing.
[4] tick: one pass of the scheduler, every minute: one decision per scheduled command, each one line in the state.
[5] the skill's `schedule`: the key `schedule` in the front matter of a skill's `SKILL.md`, where the skill says which commands it schedules.
[6] page row: one line of the Automations page: one scheduled command of one project, with its checkbox and its "Edit". It is not a row of a skill's `schedule` [5], which the page never reads.
[7] picked project: the one project the dashboard's project select, the menu at the top of the sidebar, names. The sidebar then lists only the pages, and the Overview draws only the cards, added by the packages that project has, and every page shows only that project's data. When the select says "All projects", no project is picked, the sidebar lists the pages added by every project's packages and every page shows every project's data.
[8] pace: how often at most a scheduled command starts, the one in force on this machine: this machine's pace pick [9] for the command, else the interval its skill gives; an interval (a count of minutes, hours, days, weeks or months), with a time of day when it has one. A command its check alone paces has no pace.
[9] pace pick: a person's choice, on one machine, of a pace for one scheduled command there: "whenever there is work", or an interval with an optional time of day; kept in the state, not in the skill. A command with no pace pick runs at its skill's pace.
[10] agents pick: a person's choice, on one machine, of that machine's number for one scheduled command: the machine starts another run of the command only while fewer than that number are in flight on any machine that shares the repository. A whole number from 1 to 99; kept in the state, not in the skill. A command with no agents pick has its skill's number.
[11] cap: how many runs of one scheduled command a machine lets be in flight at once: the machine starts another run of the command only while fewer than its number are in flight on any machine that shares the repository. Its number is the agents pick [10] made on it, a person's own number for the command there, else the number the command's skill gives, 1 when the skill gives none.
[12] start point: the commit a scheduled run's checkout starts from: origin's default branch (`origin/main`), or, in a repository with no remote, the commit the person's own checkout is on (`HEAD`). Never the files in a person's own checkout: a skill written there and not committed, or committed and not yet on origin's default branch, is not on the start point.
[13] automation: a person's own prompt saved as a scheduled command, with the `schedule` [5] the person picked, an interval, a check (a shell line the scheduler runs, which starts an agent when it prints something) or both. Written by `agent-scheduler add` or the "New automation" form of the Automations page, as one of two kinds, the person's choice. A shared automation is a command skill of the project (a skill run as the slash command `/<name>`, never picked up by the coding agent on its own): the file `.claude/skills/<name>/SKILL.md`, whose text is the prompt and whose front matter carries that `schedule`; the person commits it, and from then on it is a skill like any other, and its command a scheduled command like any other. An automation kept on this machine is one file written the same way, `.agent-scheduler/automations/<name>.md`, in the tool's own folder, which is hidden from git: nothing is to commit and nobody else gets its command, though its text is in the record of each of its runs, which is shared where the project shares its records. It is no skill and no slash command: its command is listed, switched and started like any other scheduled command, a run of it has the automation's name as its prompt, with no slash, and is handed the file's text with it, its runs are counted on this machine alone (where a command's runs in flight or its last start are said to be counted on any machine, for it that is this machine's), and what is said of a command's skill (the interval and the check its skill gives, its skill's number of agents, what its skill says it does) is, for it, said of that file.

## Business logic — TL;DR

- **Where it shows** - a sidebar row "Automations" and the URL `/automations`; titled "Automations".
- **What it reads** - `agent-scheduler status` in every project the page is given (every project that has the package, or the picked project [7] alone), when shown and every 10 seconds, and again after every save, an automation's [13] included.
- **A project's group** - one per project, under its name, with "Scheduler <status>", the model and "last tick <age>" beside the name, followed by why that tick [4] decided nothing when it says; at the right of the heading, "New automation", while no form is open; under the heading, one line when the scheduler is off, or on with no live process, saying nothing here starts and how the scheduler starts.
- **New automation** - the button beside a project's name opens the form (`NewAutomation.tsx`) under that name, where a person saves a prompt of their own as an automation [13] of that project; one form is open at a time: while one is open, no project offers the button, since opening another would drop what was typed; the form is told whether its project's scheduler is running; it closes by its Cancel, by Escape while nothing was typed into it, or, once saved, by Done; a project that could not be read offers no button.
- **A page row** - `/<command>`, or, for an automation kept on this machine [13], its name alone followed by "only on this machine"; what its skill says it does, cut after two lines, and one line: when it runs, "your pick" when that pace [8] is the person's own, how many agents at once when that is more than one or the person set it, with "your pick" after it when the person set it, how far its runs publish, and what the scheduler last decided for it; a decision that started a run opens that agent.
- **The checkbox** - the command's schedule switch [2]; flipping it saves at once.
- **Edit** - opens the page row in place: "When it runs" (as the skill says, whenever there is work, or every so many minutes, hours, days, weeks or months, with a time of day beside days or more), "How many at once" (as the skill says, or up to a number of agents), a menu of the publish picks [3] the project is offered, a sentence that follows all three, Cancel and Save; nothing is saved until Save; Save sends the pace pick [9], then the agents pick [10], then the publish pick, each only when changed and each only once the one before it was taken; while a count is no whole number in its range, or the time is half typed, the sentence says what to fix and Save is disabled; in the box of an automation kept on this machine [13], "As the skill says" reads "As it was saved", and the two lines under the choices say "on this machine".
- **The keyboard** - opening a page row puts the focus on the checked choice of "When it runs"; Escape closes it like Cancel; closing puts the focus back on the page row's "Edit".
- **Saves go one at a time** - each save waits until the one before it has answered and the status has been read again; a page row is held, greyed and disabled, until its own saves have answered and been read back; a save not taken says why on its own page row, and the next save still runs.
- **A skill whose `schedule` cannot be read** - named above the project's page rows, with the reason; so is an automation kept on this machine [13] that is not listed, in words of its own.
- **A project that cannot be read, or has nothing to list** - says so under its own name; a project that cannot be read offers no "New automation".

## Business logic

### Where it shows

#### Context

See `## Context`.

#### Business logic

The module's definition (`index.tsx`) gives the page the URL `/automations` and a sidebar row "Automations". The page is headed "Automations", with the line "What starts by itself while nobody is at the keyboard. Your choices, on this machine. Every row starts switched off." Until the first read has answered it says "Loading…".

### What it reads

#### Context

See `## Context`.

#### Business logic

The page runs `agent-scheduler status` in every project it was given (`schedulers.ts`): every project that has the package, or the picked project [7] alone when one is picked in the dashboard. It reads when it is first shown, every 10 seconds after, when the set of projects changes, and once more after each save, so a page row shows what the scheduler holds rather than what was clicked. It also reads once more when an automation [13] was saved from the form ("New automation", below).

### A project's group

#### Context

**User story**: with several projects registered, the user must see at a glance which project a scheduled command belongs to, and whether that project's scheduler is running at all. A checkbox checked in a project whose scheduler is not running starts nothing, and the page must say so.

#### Business logic

The page draws one group per project it was given, in the order given, headed by the project's name. Beside the name stand:

- "Scheduler " and the scheduler's leading status as `schedulers.ts` says it: "Scheduler on" in green, "Scheduler on, not running" in amber, "Scheduler off", "Scheduler not readable" in red.
- The model the project's scheduled runs start on, when the state [1] names one.
- "last tick <age>" once the scheduler has ticked [4]: how long ago its last tick was ("last tick 1m ago"), with the exact time in a tooltip. It is followed by ": <note>" when that tick decided nothing per command and says why ("last tick 1m ago: agent-data could not be pulled: …"). Two notes are not shown there: `off`, since "Scheduler off" beside the name says it already, and `no skill of this project schedules a command`, since the group says it in its own words below.

Under the heading, a project that was read shows one line when its scheduler starts nothing:

- The scheduler is off: "The scheduler is off in this project, so nothing here starts. It starts with the dashboard once the project has run `npx agent-scheduler init`, or by hand with `npx agent-scheduler start`."
- The scheduler is on and its process is not alive, in amber: "The scheduler is on but its process is not running, so nothing here starts. `npx agent-scheduler start`, run in the project, starts it."

At the right of the heading stands the button "New automation", named "New automation in <project>" for a screen reader, while no "New automation" form is open on the page ("New automation", below).

A project's group holds only that project's scheduled commands, in its schedule's order. The same command scheduled in two projects is two page rows [6], each saved in its own project.

### New automation

#### Context

**User story**: the user wants something to start by itself that no skill of the project schedules, and does not want to write a skill file by hand. They say it in a form on the page where everything that starts by itself is listed, under the project it is for.

**Problem**: the page shows several projects, and an automation [13] is a file of one of them. The form must be opened in, and save to, the project whose button was pressed.

**Problem**: a form holds a prompt a person spent minutes on. Opening a second form would have to drop the first, and with it what was typed.

#### Business logic

While no "New automation" form is open on the page, every project's group that was read has the button "New automation" at the right of its heading, whether its scheduler is on or off and whether it lists a page row or none. A project whose status could not be read has none.

Pressing the button opens the "New automation" form (`NewAutomation.tsx`) in that project's group, directly under the heading, above the group's lines and page rows. One form is open at a time on the page: while a form is open, in any project, no project's group shows the button, so a second form cannot be opened over the first and nothing typed is dropped that way. The buttons show again once the form is closed. A form opens empty every time. The page tells the form whether its project's scheduler is running, on with a live process, as the page last read it: the form uses it to say when the saved automation's page row shows. An open form and a page row [6] opened with "Edit" do not close each other.

The form runs its commands in the project it was opened in, so an automation is saved into that project and no other. What the form holds, how it tries a check and what it says once saved are told in `NewAutomation.LOGIC.md`. The form closes when the person presses its "Cancel", presses Escape in it while nothing was typed into it, or, after a save, presses "Done"; every project's button then shows again.

When the form says an automation was saved, the page runs `agent-scheduler status` in every project again, at once. The save does not go through the queue the other saves share ("Saves go one at a time"): the form runs its command itself, at once, also while a save of a page row is waiting or in flight. Besides the automation's file, the command takes out of the state [1] what this machine held under the new command's name (`../src/cli.ts`). It writes the state only when it held something there, so for a name no command had before it reads the state and writes nothing, and cannot write over a save of a page row made at the same moment; for a name something was left under, it is a read and a write of the state like any other save's, outside the queue. The page lists what each scheduler's last tick [4] recorded, so the new automation's page row shows from the first read after that project's scheduler has ticked: within a minute where the scheduler is running, and not before the scheduler runs where it is not, which the form says once it has saved. Its page row is then one like any other: switched off, with what its skill says it does (the first line of the prompt), when it runs, "Edit" and the checkbox. A shared automation's page row, like that of any command whose skill is not on the start point [12], says "Cannot start yet: its skill is not on origin/main" once it is switched on and would start, until the file is there ("A page row", below). The page row of an automation kept on this machine never says so: nothing of it has to be on the start point, and it starts at the first tick it is due on.

### A page row

#### Context

**User story**: the user reads the page without reading the skill that schedules the command, or its check, which is a shell line.

#### Business logic

A page row [6] shows, from the top:

- The page row's name, as `schedulers.ts` writes it: the command as a person types it, `/<command>`; or, for an automation kept on this machine [13], which is no command to type, its name alone (`watch-competitor`), followed by the words "only on this machine".
- What its skill says it does, in the skill's own words, when the skill says (`schedulers.ts`). Text longer than two lines is cut after the second.
- One line of two to six parts, separated by "·":
  1. When the command runs, as `schedulers.ts` says the pace [8] in force: "Every 1 day", "When the queue holds a task", "Every 6 hours at most, when a ticket has no plan", "Every 2 days at 10:00", "Every 2 days from 10:00, when a ticket has no plan".
  2. "your pick", only when that pace is the person's own on this machine and not the skill's (`schedulers.ts`).
  3. How many agents may work on the command at once, as `schedulers.ts` says the cap [11] in force ("Up to 3 at once"), only when that is more than one or the person set an agents pick [10] for the command ("One at a time" for an agents pick of 1).
  4. "your pick" again, only when that number is the person's agents pick and not the skill's. A page row with a pace pick [9] and an agents pick shows "your pick" twice, once after each.
  5. How far its runs publish on this machine, by its publish pick [3]: "Commits its work" for a command nobody picked for, "Opens a pull request", "Publishes nothing".
  6. What the scheduler last decided for the command, as `schedulers.ts` says it for a person: "Off" for a command switched off on this machine, "No work", "Started a run", "Started 2h ago, not due yet", "Next: Saturday 10:00" for a command waiting for its time of day ("Next: as soon as the scheduler looks" when that time has passed since the last tick), "One is already running", "Cannot start yet: its skill is not on origin/main" for a command the scheduler would have started and whose skill is not on the start point [12], else the tool's own words with a capital ("Quota: …", "Check failed: …"). This part is absent for a command that is switched on and that no tick [4] has decided yet.

"Started a run" is a button that opens that agent's page in the dashboard; every other decision is plain text.

On the right of the page row stand "Edit" and the checkbox. For a screen reader the page row, "Edit", the box it opens and that box's two groups of choices are each named with the page row's name as written above: "Edit /work-queue", "Edit watch-competitor".

A scheduled command whose skill is only under `.agents/skills` is listed like any other, since the tick records it. Its page row says why it never starts ("Cannot start: its skill is only in .agents/skills, which Claude Code does not read"), whether its checkbox is checked or not: checking it starts nothing.

A scheduled command whose skill is not on the start point [12] is listed like any other too: the tick records the schedule as the skill files in the person's own checkout say it, so a skill the person just wrote there, or a shared automation [13] they just saved from the form, has its page row at the next tick. Switched off, its page row says "Off" like any other. Switched on, it reads like any other switched-on command ("No work", "Next: Saturday 10:00") until the scheduler would otherwise start a run of it; from then on its page row says why none started, as `schedulers.ts` words it: "Cannot start yet: its skill is not on origin/main", with ", as this machine last saw it" after it when the scheduler could not reach origin, or "Cannot start yet: its skill is not committed" in a repository with no remote.

### The checkbox

#### Context

See `## Context`.

#### Business logic

The checkbox, labelled "Run <the page row's name> by itself" for a screen reader ("Run /work-queue by itself"; "Run watch-competitor by itself" for an automation kept on this machine [13]), is checked when the command runs on this machine: only once its schedule switch [2] was switched on here. Flipping it runs `agent-scheduler switch <command> on` or `… off` in that project, at once, with no Save. Checking it also counts the time of day of the command's pace pick [9], when it has one, from now (`../src/cli.ts`): a command set to "every day at 10:00" and switched on at 11:00 waits for tomorrow's 10:00. Checking it also writes the time the command was switched on (`../src/cli.ts`), which the command's check is given as `$LAST_RUN` until the command starts after it (`../src/tick.ts`): a check that asks what is new asks from when the box was checked, not from before. Unchecking it changes nothing of the pace pick.

### Edit

#### Context

**User story**: how far a command's runs publish decides what leaves the machine, and how often it starts decides what it spends, and how many agents work at once decides how fast it spends it, so the user picks all three, reads in one sentence what the picks mean, and only then saves them.

**Problem**: a count and a time are typed a key at a time. A half-typed one must not be saved, and must not be said as if it were a pace.

**Problem**: a pace is counted from the command's last start on any machine, and a month is 30 days. A person who does not know either would be surprised by when the command starts, so the box says both. Likewise the number of agents at once is no promise that so many start: a new one starts only when the command is due, and only while fewer than the number are working on any machine that shares the repository, so the box says that too.

#### Business logic

"Edit" opens the page row [6] in place. The command and what its skill says it does stay; the one line and "Edit" give way to a box holding, from the top:

- "When it runs", one choice of up to three. The box opens on the choice `schedulers.ts` gives for the command's pace pick [9]: "As the skill says" where there is none.
  - "As the skill says", with the skill's whole pace beside it in lower case, as `schedulers.ts` says it: "every 1 day", "every 15 minutes at most, when an issue changed", "when the queue holds a task". Saved, it takes the pace pick back.
  - "Whenever there is work", offered only for a command whose skill gives it both an interval and a check: the interval is taken away and the check alone says when.
  - "Every", followed by a count (a number from 1 to 9999), a unit and, only while the unit is days, weeks or months, "at" and a time of day. The unit menu reads "minute", "hour", "day", "week", "month" while the count is 1, and "minutes", "hours", "days", "weeks", "months" otherwise. Beside the time stand the words "optional, this machine's time", and for months "optional, this machine's time; a month counts as 30 days". The count, the unit and the time can be changed only while "Every" is the checked choice. Checking "Every" from another choice starts from the skill's own interval, or from 1 day for a skill that gives none, with no time. A time typed beside days stays in the box while the unit is changed to minutes or hours, hidden and not saved, and shows again when the unit goes back to days.
  - Under the choices, one line: "Counted from its last start, on any machine that shares this repository."
- "How many at once", one choice of two. The box opens on the choice `schedulers.ts` gives for the command's agents pick [10]: "As the skill says" where there is none.
  - "As the skill says", with the skill's number beside it in lower case: "one at a time", "up to 2 at once". Saved, it takes the agents pick back.
  - "Up to", followed by a count (a number from 1 to 99) and "agents at once" ("agent at once" while the count is 1). The count can be changed only while "Up to" is the checked choice. Checking "Up to" from the other choice starts from the skill's number.
  - Under the choices, one line: "A new one starts only when the row is due, and only while fewer than this are working on any machine that shares this repository."
- A menu, "What its runs publish". It opens on this machine's pick for the command, "Commit" where nobody picked. It lists the publish picks [3] the project is offered, as `schedulers.ts` says them: all five ("Nothing", "Commit", "Publish branch", "Open PR", "Merge on green") in a project with a git host package, "Nothing", "Commit" and "Publish branch" only in a project without one. The pick the menu shows is listed after them when the project is not offered it: a command whose pick in force is "Open PR" in a project without a git host package opens on "Open PR", and once the person picks another entry "Open PR" is no longer listed.
- A sentence that follows all three: when the command would run with the choice made above, how many agents at once with the number picked, said when that is more than one or the person's own, even one, and how far its runs would publish with the pick the menu shows ("Every 2 days at 10:00. Commits its work.", "Every 1 day. Up to 4 at once. Commits its work.", "Every 1 day. One at a time. Commits its work." for a number lowered to one, "Every 1 day. Opens a pull request."). While what is typed under "Every" is no pace yet, the sentence gives way to what `schedulers.ts` says keeps it from being one, and "Save" is disabled: "Type a whole number, from 1 to 9999." for a count that is none (empty, `0`, `1.5`), or "Finish the time, like 10:00, or clear it." for a time left half typed, which the browser reports on the time field. With the pace in order, a count under "Up to" that is no whole number from 1 to 99 (empty, `0`, `1.5`, `100`) does the same: the sentence gives way to "Type a whole number of agents, from 1 to 99." and "Save" is disabled. With both half typed, the pace's hint shows first.
- The note "Saved for you, in this project, on this machine. No tracked file changes."
- "Cancel" and "Save".

In the box of an automation kept on this machine [13], the first choice under "When it runs" and under "How many at once" reads "As it was saved", not "As the skill says": no skill says anything of it. What stands beside the choice, and what saving it does, are the same. The two lines under the choices end "on this machine" where a skill's end "on any machine that shares this repository": "Counted from its last start, on this machine." and "A new one starts only when the row is due, and only while fewer than this are working on this machine." Such an automation counts the runs this machine started alone (`../src/records.ts`).

Changing a choice or the menu saves nothing. "Cancel" closes the page row and saves nothing. "Save" sends what changed, each as a save of its own (see "Saves go one at a time"), the pace first:

1. The pace, when the choice made is not the one the box would open on now: `agent-scheduler pace <command> skill`, `… work`, or `… <interval> [<time of day>]` (`pace post-merge-cleanup 2d 10:00`) in that project, as `schedulers.ts` words it.
2. The number of agents, when the choice made is not the one the box would open on now: `agent-scheduler agents <command> skill` or `… <count>` (`agents work-queue 3`) in that project, as `schedulers.ts` words it.
3. The publish pick, when the menu is not on the pick in force: `agent-scheduler publish <command> <nothing|commit|branch|pr|merge>` in that project.

Each is sent only once the one before it was taken.

With nothing changed, "Save" closes the page row and runs nothing. A pace that did not change is not sent again. The page row closes once the last of its saves was taken and the status has been read again, so the closed page row shows what was saved. A save not taken stops there: the page row stays open with what was picked in it, and the reason under it. So a pace not taken leaves the page row open with every pick, and neither the number of agents nor the publish pick is sent; a later save not taken leaves the page row open with what came before it already saved.

One page row is open at a time: "Edit" on another page row closes the open one, and what was picked in it and not saved is dropped. A save that answers closes only its own page row: when the person opened another page row while the save was in flight, that one stays open with its picks. The checkbox stays where it is while the page row is open.

A pace pick, an agents pick and a publish pick are each kept until another replaces it, and a pace pick and an agents pick until they are taken back. Two machines may hold different picks for one command; each starts and publishes its own runs by its own picks, and both count the command's last start and its runs in flight on either machine. That is a skill's command: an automation kept on this machine [13] is on one machine, which counts its own runs of it alone. So with different numbers, no more run at once than the largest number among the machines whose scheduler is on with the command switched on (`../src/tick.ts`).

### The keyboard

#### Context

**User story**: a user who works the page from the keyboard presses "Edit", picks, and saves or backs out, without reaching for the mouse and without losing their place.

#### Business logic

Opening a page row [6] puts the focus on the checked choice of "When it runs". Escape, pressed anywhere in the open box, closes the page row like "Cancel": nothing is saved; while the page row is held for a save, Escape does nothing, as "Cancel" does nothing then. Every way of closing a page row ("Cancel", Escape, a save that was taken, "Save" with nothing changed) puts the focus back on that page row's "Edit". A save that is taken after the person opened another page row closes nothing and leaves the focus where it is.

### Saves go one at a time

#### Context

See the **Problem** in `## Context`.

**Problem**: a page row that came back before the status was read again would show the old value for a moment, as if nothing had been saved. And a save that fails must not stop the saves queued behind it.

#### Business logic

Every save, of a schedule switch [2], of a pace pick [9], of an agents pick [10] or of a publish pick [3], joins one queue. A save runs its command, then the status of every project is read again; the next save starts only after both. A page row [6] is held, greyed, with its checkbox, its "Edit", its "When it runs", its "How many at once", its menu, "Cancel" and "Save" disabled, from the click until its save has answered and the status has been read again, however many of its saves are queued. Only that page row is held: the same command in another project is not.

A save is not taken when the command refused it, or when the command could not even be asked (the dashboard could not be reached). Either way the page row comes back, and under it an alert says why: "The switch was not saved: <why>", "The pace was not saved: <why>", "The number of agents was not saved: <why>" or "The publish pick was not saved: <why>", the reason being what the command said, or why it could not be asked. The line sits on its own page row, so it names neither the command nor the project. The next save of that page row takes the line away. The page shows one such line at a time: a later save not taken on another page row replaces it. The saves queued behind a save not taken still run.

### A skill whose `schedule` cannot be read

#### Context

**Problem**: a skill whose `schedule` [5] cannot be read gives no scheduled command, so it has no page row. Without a word about it, a person would search the page for its command and find nothing.

#### Business logic

For each skill the project's last tick [4] could not read (`schedulers.ts`), the project's group shows an alert above its page rows: "The schedule of the <skill> skill cannot be read, so it is not listed: <reason>", the reason being the tick's ("row 2: unknown key evry"). The project's other scheduled commands are listed as usual.

An automation kept on this machine [13] that the tick did not list (`../src/schedule.ts`) has an alert of its own in the same place, in its own words (`schedulers.ts`): "The automation <name>, kept on this machine, is not listed: <reason>", the reason being the tick's ("The automation watch-competitor, kept on this machine, is not listed: it has no schedule"). When the reason is that a skill of the project has its name too, the alert says what to do ("…: a skill of the project has this name too, so neither is listed: rename or remove .agent-scheduler/automations/work-queue.md, then switch on what you want"), and that skill's page rows are missing as well until it is done. What this machine gave the automation is taken back meanwhile (`../src/state.ts`), so whatever is listed under the name afterwards is switched off.

### A project that cannot be read, or has nothing to list

#### Context

See the **Problem** in `schedulers.LOGIC.md`.

#### Business logic

A project whose status could not be read shows, in its own group, an alert: "The scheduler could not be read: <why>", and its heading says "Scheduler not readable". That project lists no page row and offers no "New automation"; the other projects still show.

A project that was read, lists no scheduled command and names no skill whose `schedule` cannot be read shows one of two lines in its group, and no list:

- Its scheduler has not ticked [4] yet: "Nothing here yet: the scheduler of this project has not looked at its skills."
- Its scheduler has ticked: "Nothing here: no skill of this project says it can be scheduled."
