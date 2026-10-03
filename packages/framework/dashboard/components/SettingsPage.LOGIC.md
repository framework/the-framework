The Settings page: every preference [1] the user can set, on one page, each change applied the moment it is made and saved to the daemon in the background, with the Onboarding checklist kept at the top, plus the subagent settings [25], the spend offset [19], the schedule switches [21] and the publish picks [23], which are not preferences. Everything else written here goes to the user's own preferences, so a value on this page always means "my default, everywhere"; the subagent settings go to every project's orchestration settings file, and the spend offset to every project's scheduler, the one place each is kept, and a schedule switch or a publish pick goes to its own project's scheduler, for this machine only.

## Context

**User story**: the user opens Settings (the address `/settings`) to look up or change a setting without hunting through the header's menus, and follows the Overview's [2] hint that the onboarding can be resumed on the settings page. The heading is "Settings" and the line under it reads "Your defaults, everywhere."

**Business logic story**: the same preferences feed the launcher on a project home [3], the notifications bell and the daemon's sweeps [4]. This page is the one surface that lists all of them, so what it shows must match what those surfaces act on. The spend offset [19] is the usage panel's handle as a number, read and written exactly as the handle does. The schedule switches [21] and the publish picks [23] follow the same path: the dashboard names no tool, writes through a project's hook line and reads the scheduler's state file. The subagent settings [25] too: written through each project's subagents hook [26], read off the orchestration command's settings file.

## Glossary

[1] preferences: the user's dashboard settings, kept in the registry (`~/.the-framework.json`, which also lists the projects).
[2] the Overview: the dashboard's cross-project page at `/`.
[3] project home: a project's own page with the launcher (the Start form) and its composer (the prompt editor, also used to say something to an agent).
[4] sweep: a background job the daemon runs on its clock: the data sync, the cloud scratch sweep, cloud work adoption.
[5] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch, started through the project's start hook and shown in the dashboard from the files its tool keeps.
[6] agent view: one agent's page.
[7] coding agent: the CLI doing the actual work: Claude Code or Codex.
[8] start hook: the one shell line under `start:` in a project's `.the-framework/hooks.yml`, which starts an agent; the user's picks of coding agent and model are handed to it.
[9] relay: running an agent on a device: the local daemon forwards the start to the device and streams the events back.
[10] device: another machine's daemon the user saved by URL and token, to run agents on it from this dashboard.
[16] intervention: something that needs a human — an open question, a pull request to review, unpushed commits — one of the two notification feeds. The other is activity: an agent started or finished.
[17] cloud session: a Claude Code cloud session on claude.ai, the far end of a `web` agent.
[18] the Claude web bridge: the daemon's bridge endpoints plus the Chrome extension: carries the question a cloud session is parked on into the dashboard, and types the pick back into the session. The bridge token is the secret the extension presents; the bridge browser is the Chrome for Testing the daemon runs for it.
[19] spend offset: the user's adjustment of the quota boundary, in percentage points of the week: how far past it unattended work (an agent the scheduler started rather than a person) may start. Each project's scheduler holds its own, as `spendOffset` in its state file; the quota boundary is the share of the quota week that may be spent by now, rising with the clock.
[20] offset hook: the one shell line under `offset` in a project's `.the-framework/hooks.yml`, given the spend offset in `POINTS`; for example `npx agent-scheduler offset -- "$POINTS"`.
[21] schedule switch: a person's choice, on one machine, whether a scheduled command (a line of the project's `agent-schedule.md`) runs there; the project's scheduler keeps it in its state file, and the schedule line is the default where nobody switched the command: on, unless the line says `off`.
[22] switch hook: the one shell line under `switch` in a project's `.the-framework/hooks.yml`, given the command's name in `COMMAND` and `on` or `off` in `SWITCH`; for example `npx agent-scheduler switch "$COMMAND" "$SWITCH"`.
[23] publish pick: a person's choice, on one machine, of how far a scheduled command's runs publish there: nothing, the branch, a pull request, or a pull request set to merge on its own once its checks pass; the project's scheduler keeps it in its state file, where it stands in for the level the command's line in `agent-schedule.md` says until the person takes it back.
[24] publish hook: the one shell line under `publish` in a project's `.the-framework/hooks.yml`, given the command's name in `COMMAND` and the publish pick in `PUBLISH` (`nothing`, `branch`, `pr` or `merge`, or `file` when the pick is taken back); for example `npx agent-scheduler publish "$COMMAND" "$PUBLISH"`.
[25] subagent settings: a person's choice, on one machine, of the coding agent and model a main agent's subagents (the agents a main agent starts on parts of its task, with the `orchestration` command) run on, one for a task the main agent calls simple and one for a task it calls hard, and how many of one main agent's subagents run at once; the `orchestration` command keeps them in `.orchestration/settings.json` at each project's root, hidden from git. A level nobody set runs on the main agent's own coding agent and model; with no number set, 4 run at once.
[26] subagents hook: the one shell line under `subagents` in a project's `.the-framework/hooks.yml`, given the subagent settings as one JSON value in `SUBAGENTS`, to be saved whole; `npx orchestration settings "$SUBAGENTS"`, which `npx orchestration init` writes.

## Business logic — TL;DR

- **One page, one destination** - every control but the subagent settings, the spend offset, the schedule switches and the publish picks reads and writes the user's own preferences, applied at once and saved in the background.
- **The Onboarding checklist stays on this page** - it sits above every section, cannot be dismissed here, and its two navigating steps lead to an agent's page or a project's launcher.
- **Appearance: theme and editor** - "Theme" follows the system by default; "Editor" offers "Auto-detect" plus the editors found on the daemon's machine.
- **Agent: which coding agent, which model, and post-merge cleanup** - "Agent" (Claude Code by default) and "Model", picked from the models that coding agent lists, the same list the launcher's select offers, or the coding agent's own default (the default); both handed to a project's start hook [8] with every start; picking another coding agent leaves no model picked; "Post-merge cleanup" (off by default), the default of the launcher's box of that name.
- **Subagents: which coding agent and model, by how hard the task is, and how many at once** - "Simple tasks" and "Hard tasks", each "Same as the main agent" (the default) or one coding agent with its own default or one of the models it lists, and "At once", 1 to 8, 4 by default; the same on every project, read off the projects' orchestration settings files and saved whole through every project's subagents hook [26]; a pick shows at once and the next pick builds on it, even before the first is saved; a write that fails says why; with no project having the hook, the section says how to add it.
- **Devices, after "Agent" and "Subagents"** - the saved devices follow, because a device is the other place an agent can run.
- **Notifications: how they reach you, and what about** - a delivery row ("Browser") showing both the preference and whether the browser lets it deliver, and two category rows ("Human Queue", "New activity").
- **Automation: the spend offset** - "Spend offset" is the number the usage panel's handle moves, from −50 to 50 percentage points, read off the projects' schedulers and written through every project's offset hook [20]; a write that fails says why.
- **Automation: run on a schedule** - after the spend offset, one row per scheduled command of every project, "Run /<command> on a schedule", with a checkbox, checked when the command runs on this machine, and a menu of how far the command's runs publish on this machine: "As the file says (<level>)", Nothing, Publish branch, Open PR, Merge on green, the last two only in a project with a git host; flipping the checkbox writes the schedule switch [21] through that project's switch hook [22], and picking in the menu writes the publish pick [23] through that project's publish hook [24], "As the file says" taking the pick back; a write that fails says why.
- **Claude web: the bridge, and which browser does its work** - "Browser bridge" is off by default; while on, one exclusive choice decides whether the daemon runs the bridge browser or the user's own Chrome does the work, each option carrying its own setup.
- **A list with nothing to pick is not shown** - a drop-down row with no choices is left out rather than rendered empty.

## Business logic

### One page, one destination

#### Context

**Problem**: a setting with more than one home leaves the user unable to tell which copy a value was written to. The page has one destination.

#### Business logic

Every control on the page but the subagent settings, the spend offset, the schedule switches and the publish picks reads and writes the user's own preferences [1], which the daemon keeps in the registry file `~/.the-framework.json`. The exceptions are the subagent settings [25], which are kept in each project's orchestration settings file (see "Subagents: which coding agent and model, by how hard the task is, and how many at once"), the spend offset [19], which is kept by each project's scheduler and nowhere else (see "Automation: the spend offset"), and the schedule switches [21] and publish picks [23], each kept by its own project's scheduler for this machine (see "Automation: run on a schedule"). The page belongs to no project. A change takes effect on the page the instant it is made and is saved to the daemon in the background; a failed save is not reported, and a value another tab changed is adopted when the daemon answers (the write rules are in `lib/preferences.ts`).

### The Onboarding checklist stays on this page

#### Context

**User story**: a fresh install is walked through setup by the checklist on the Overview [2]. Dismissing it there hides it on the Overview only, and the Overview tells the user the onboarding can be resumed on the settings page.

#### Business logic

The card titled "Onboarding" is the first thing on the page, above every settings section, and has no dismiss control here (its steps and rules are in `OnboardingChecklist.tsx`). Two of its steps leave the page: an agent [5] the checklist starts takes the user to that agent's agent view [6], and its "Configure first, then run" takes the user to that project's project home [3], with its launcher.

### Appearance: theme and editor

#### Context

**User story**: the user pins the dashboard to light or dark or lets it follow the operating system, and chooses which editor the dashboard's "Open in editor" action launches.

#### Business logic

The "Appearance" section has two rows:

- "Theme" ("Follow the system, or pin light or dark."): "System", "Light" or "Dark". With nothing stored the theme is "System": the dashboard follows the operating system's light or dark choice.
- "Editor" ("Which editor “Open in editor” launches."): "Auto-detect" followed by one entry per editor found installed on the daemon's machine, read once from the daemon. When none is detected, for example on a daemon serving a host with no local checkout, the list holds "Auto-detect" alone and the row stays usable. Choosing "Auto-detect" clears the stored editor, so the daemon picks the editor itself.

### Agent: which coding agent, which model, and post-merge cleanup

#### Context

**Business logic story**: a start carries two picks — which coding agent [7] does the work, and which model. The launcher's select sets the same two; the values here are what every start carries, from the launcher and from every button that starts an agent.

**Problem**: a model is passed straight through to its coding agent, so a model typed by hand could be a name the coding agent does not know, or another coding agent's model, and the start would fail on it. Both surfaces offer one list, so they cannot disagree on what a pick may be.

#### Business logic

The "Agent" section has three rows:

- "Agent" ("Which coding agent runs the work."): "Claude Code" or "Codex". With nothing stored the row shows "Claude Code", and a start sends no coding agent at all, so the project's start hook [8] applies its own default. Picking a coding agent also clears the model, since a model belongs to one coding agent: the next start uses the new coding agent's own default until a model is picked.
- "Model" ("The models the agent lists. Its own default when none is picked."): a drop-down of the models the coding agent picked in "Agent" lists, as the coding agent itself listed them when the daemon asked it and by the names it gives them ("Opus 5.5", "Fable 5.1"): the same list, from the same place, as the launcher's select (`lib/models.ts`). The first entry, "the CLI's own default", picks no model: nothing is handed over and the coding agent uses its own default; it is what the row shows with nothing stored. A picked model is handed to the start hook as the model to run on. A stored model the list does not hold (typed before this row was a list, or no longer offered) stays in the list at the end, by its id, and stays picked, since that id is still what a start is given. While the daemon has not answered, or when the coding agent could not list its models, the list holds the default and a line that cannot be picked saying why ("Asking Claude Code…", or the coding agent's own reason).
- "Post-merge cleanup" ("The launcher's box, ticked by default: once a run ends with a pull request, a fresh agent runs /post-merge-cleanup on its branch before it merges. In projects with that command."): a switch, off when nothing is stored. It is the same preference the launcher's "Post-merge cleanup" box shows and writes (`StartAgentForm.tsx`): flipping either changes the other. It changes a start only from the launcher, in a project that has the `post-merge-cleanup` command, with no device picked in "Run on".

Where an agent runs is not a setting: it is picked per start in the launcher's "Run on" (`RunOnMenu.tsx`).

### Subagents: which coding agent and model, by how hard the task is, and how many at once

#### Context

**User story**: an agent splitting its task across subagents says, for each task, whether it is simple or hard. The user wants simple tasks on a cheaper model and hard ones on the strongest, and no more than three subagents of one agent working at a time; they pick that here once, and every project's subagents follow it on this machine.

**Problem**: a main agent that chose each subagent's model would spend the user's money on its own guess; a setting per project would have to be made again in each one. The settings are the `orchestration` command's, which The Framework must not name, so the page reads them off the file by its name and writes them through each project's subagents hook [26], as the spend offset goes through the offset hook.

#### Business logic

The "Subagents" section follows the "Agent" section, with the description "The models a main agent's subagents run on, by how hard the main agent says each task is. The same on every project, on this machine." It has three rows:

- "Simple tasks" ("A task the main agent marks simple.") and "Hard tasks" ("A task the main agent marks hard."): each a drop-down whose first entry, "Same as the main agent", sets nothing for that level, so its subagents run on the main agent's own coding agent and model; it is what the row shows when nothing is set. Then, for each coding agent in the order the "Agent" row lists them, "<coding agent> · the CLI's own default" (that coding agent with no model, so it uses its own default), followed by "<coding agent> · <model>" for each model it lists, by the names it gives them: the same lists, from the same place, as the "Model" row (`lib/models.ts`). One entry is always one coding agent and one model, since a model belongs to one coding agent. A saved model the list does not hold is kept at the end, "<coding agent> · <model id>", and stays picked.
- "At once" ("How many of one main agent's subagents run at the same time. It starts the next when one ends."): 1 to 8 (up to the saved number when it is larger); with nothing set it shows 4, the orchestration command's own default.

The settings shown are the subagent settings [25] the daemon reads off the registered projects (`../../src/dashboard/subagent-settings.ts`), asked again every ten seconds. Every pick saves all three rows together, whole: a level set back to "Same as the main agent" is left out of what is saved, so it is unset again. The daemon runs every registered project's subagents hook [26] with them (`../../src/dashboard-rpc/subagents.ts`). A pick shows at once and stays shown until a read made after every pending save has finished brings the settings back, and each pick is built on the last one shown, so a second pick made before the first is saved keeps the first. While a save is pending, "Saving…" shows under the rows. A save that fails shows, under the rows, as an alert: "The subagent settings were not saved: <why>" (for example "no project has a subagents hook in .the-framework/hooks.yml"), and the rows go back to the settings read; the next pick clears it. While no registered project has the subagents hook, the section says so above the rows: "No project has a subagents line in .the-framework/hooks.yml yet: run `npx orchestration init` in a project."

### Devices, after "Agent" and "Subagents"

#### Context

**User story**: the user saves another machine's daemon as a device [10] to run agents on it from this dashboard; the local daemon relays [9] the start to it.

#### Business logic

The "Devices" section follows the "Subagents" section, which follows the "Agent" section, because a saved device [10] is the other place an agent [5] can run. Its rows and rules live in `DevicesSettings.tsx`.

### Notifications: how they reach you, and what about

#### Context

**User story**: the user is told when an agent [5] waits for an answer or a pull request is ready to review, and optionally when an agent starts or finishes; in the browser while the dashboard is open.

**Problem**: a notification toggle is a preference [1]; whether the notification can be delivered is a capability the browser may withhold. A row that showed only the preference could promise a delivery that never happens, so the "Browser" row shows both, the same way the notifications bell does.

#### Business logic

The "Notifications" section has three rows. One says whether a notification reaches the user in the browser and two say what it is about; a notification is delivered only when browser delivery and its category are both on (the composition rule is in `src/preference-defaults.ts`).

- "Browser" ("Desktop notifications while the dashboard is open."): on when nothing is stored. When the browser has blocked notifications for the dashboard, the row is greyed, its description becomes "Blocked in your browser settings", the checkbox reads as off whatever the preference says, and it cannot be changed. The browser's permission is re-read every few seconds, so a permission granted or revoked in the browser shows on the page without a reload.
- "Human Queue" ("An agent awaiting your answer, or a PR ready to review."): the intervention [16] category; on when nothing is stored.
- "New activity" ("Also ping when an agent starts or finishes."): the activity category; off when nothing is stored.

### Automation: the spend offset

#### Context

**User story**: the user wants unattended work to spend exactly so far ahead of the week's pace, and types the number rather than dragging the usage panel's handle to it.

#### Business logic

The "Automation" section, right after "Notifications", starts with one row, "Spend offset" ("How far each project's scheduler may start work past the quota boundary, in percentage points (max 50). Negative holds it back; positive lets it borrow from the days ahead. Set through each project's offset hook."): a number box bounded to −50 and 50. It shows the spend offset [19] the usage panel's reading carries (the loosest one any project's scheduler holds, or the half-day default of about 7.1 when none names one), rounded to one decimal; before the first reading it shows the default. A typed value is rounded to whole points and clamped to −50..50, the same bound as the handle; an empty or non-numeric entry counts as 0. The value is kept on the page until the reading catches up with it, and written once it has rested for half a second, through the same daemon call the handle uses, which runs every registered project's offset hook [20]. A write that fails shows, under the row, as an alert: "The offset was not saved: <why>" (for example "no project has an offset hook in .the-framework/hooks.yml"), and the box goes back to the value the schedulers held. The rules for reading, holding and writing the value are the usage panel's own (`Quota.tsx`).

### Automation: run on a schedule

#### Context

**User story**: the project's tracked `agent-schedule.md` lists `- post-merge-cleanup: every 1d, off`; the user wants that clean-up to run on their own machine only, so they check "Run /post-merge-cleanup on a schedule" here, and from then on that project's scheduler starts it on this machine when it is due; a teammate's machine is unchanged. Likewise a user unchecks "Run /work-queue on a schedule" to keep their laptop from working the queue. The same file says `- work-queue: when \`npx queue\`, cap 1, publish merge`; a user who wants the queue's runs on their own machine to stop at an open pull request picks "Open PR" in that row's menu, and picks "As the file says (Merge on green)" to follow the file again; no tracked file changes either way.

**Business logic story**: the dashboard used to have a "Post-merge cleanup" setting, removed with the old runner that lived inside the daemon. This brings it back for every scheduled command: a person decides, per machine, whether a command runs on its own and how far its runs publish, and the tracked schedule file stays the team's default. The dashboard does not read `agent-schedule.md`: the rows are what each project's scheduler recorded at its last tick (`../../src/dashboard/scheduler-state.ts`), and a write runs the project's switch hook [22] or publish hook [24] (`../../src/dashboard-rpc/projects.ts`).

#### Business logic

Under the spend offset's row and its alert, the section lists one row per scheduled command of every registered project, each with a menu and a checkbox, projects in the order the daemon lists them and each project's commands in its schedule's order. A row's label is "Run /<command> on a schedule" and its description "<project name> · <pace> · <how far its runs publish>. On this machine only; agent-schedule.md sets the defaults.", where the pace is "every <interval>" (as written in the schedule, "every 1d") for a command with only an interval, "when its check finds work" for a command with only a check, and "every <interval> at most, when its check finds work" for one with both. How far its runs publish is the level in force on this machine: the command's publish pick [23] when this machine has one, else what the command's schedule line says, as the scheduler recorded it: "publishes nothing" for no level (a pick of Nothing, or a line that says nothing and no pick), "publishes its branch" for `branch`, "opens a pull request" for `pr`, and "opens a pull request that merges on green" for `merge`. The checkbox is checked when the command runs on this machine: its schedule switch [21] on this machine when one was set, else what its schedule line says. The rows come from the same read as the Overview's scheduler card, asked again every five seconds; a project whose scheduler is not set up, or never ticked with a schedule, lists no row, and with no row at all the section is the spend offset alone.

Flipping a checkbox asks the daemon to run that project's switch hook [22] with the command's name and `on` or `off`, and that row is disabled until the daemon answers. The checkbox itself shows what the scheduler holds: once the answer comes, the rows are read again. A write that fails shows, under the rows, as an alert: "The switch was not saved: /<command>: <why>" (for example "this project has no switch hook in .the-framework/hooks.yml"); the next flip clears it.

The row's menu, labelled "What /<command> publishes" for a screen reader, lists first "As the file says (<level>)", where the level is what the command's schedule line says in the launcher's words ("Nothing" for a line that says nothing, "Publish branch", "Open PR", "Merge on green"), then the picks the project is offered: Nothing, Publish branch, Open PR and Merge on green in a project where a package provides a git host, Nothing and Publish branch only in a project where none does, since no pull request can be opened there. A publish pick already saved that the project is no longer offered (a pull request pick in a project that lost its git host package) is listed after them, so the menu always shows what is in force. The menu shows this machine's publish pick [23] for the command when it has one, else "As the file says".

Picking an entry asks the daemon to run that project's publish hook [24] with the command's name and the pick; picking "As the file says" asks it with no pick, which takes the publish pick back, so the command follows its schedule line again, whatever the line says then. A pick is kept until then, even when it says what the line says: a user who picked Nothing still publishes nothing after a teammate writes a level on the line. The row is disabled until the daemon answers, then the rows are read again, so the menu shows what the scheduler holds. A write that fails shows, under the rows, as an alert: "The publish pick was not saved: /<command>: <why>" (for example "this project has no publish hook in .the-framework/hooks.yml"); the next change clears it. Two machines may hold different picks for one command; each publishes its own runs by its own pick.

### Claude web: the bridge, and which browser does its work

#### Context

**Problem**: an agent [5] whose location [9] is `web` hands its task to a cloud session [17] and ends, so the questions the cloud session asks would never reach the dashboard. The Claude web bridge [18] carries them back and types the answers into the cloud session, and it needs a browser signed in to claude.ai to do so. Two toggles named "Browser bridge" and "Bridge browser" would read as anagrams of each other; the one real decision is which browser does the work.

#### Business logic

The "Claude web" section ("A Claude web agent hands off and ends, so the questions its session asks never reach this dashboard. The browser bridge carries them back and types your answers into the session.") holds:

- "Browser bridge" ("Carry claude.ai questions into this dashboard and type your answers back. A browser signed in to claude.ai does the work, through the bridge extension."): off when nothing is stored. Turning it on is what opens the daemon's bridge endpoints and mints the bridge token.
- While the bridge is on, and only then, a choice titled "Which browser does the work?" appears under the switch, with two options of which exactly one is selected. The choice writes one on/off value: whether the daemon runs the bridge browser.
  - "A browser the daemon runs — recommended" ("Chrome for Testing, downloaded once, signed in once, kept minimized. Web runs work with your own Chrome closed."): selecting it turns the bridge browser on. Under it, and only while it is selected, the daemon's browser shows its status and its window controls (`BridgeBrowserSettings.tsx`).
  - "Your own Chrome" ("Install the extension, open its options and paste the token. Web runs need your Chrome open."): selecting it turns the bridge browser off. Under it, and only while it is selected, the bridge token to paste into the extension (`BridgeSettings.tsx`).
  - With nothing stored, "Your own Chrome" is selected. The user's own Chrome with the extension can serve whether or not the daemon's browser runs; the page presents the decision as one choice because a person makes one.
- With the bridge off, no browser choice is shown at all.

### A list with nothing to pick is not shown

#### Context

**Problem**: an empty drop-down is a control that can be opened and not used; it reads as broken rather than as "no choices here".

#### Business logic

A row whose list of choices is empty is left out of the page entirely rather than shown as an empty drop-down. Every list on the page today has at least one entry ("Auto-detect" guarantees the editor list one, "the CLI's own default" the model list), so the rule guards the next list assembled at run time.
