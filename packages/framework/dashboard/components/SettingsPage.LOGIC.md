The Settings page: every preference [1] the user can set, on one page, each change applied the moment it is made and saved to the daemon in the background, with the Onboarding checklist kept at the top. Everything the page's own sections write goes to the user's own preferences, so a value there always means "my default, everywhere". After the page's own sections come the sections the installed modules [25] bring, each the package's own, read and written through its package's own command, never through the preferences.

## Context

**User story**: the user opens Settings (the address `/settings`) to look up or change a setting without hunting through the header's menus, and follows the Overview's [2] hint that the onboarding can be resumed on the settings page. The heading is "Settings" and the line under it reads "Your defaults, everywhere."

**Business logic story**: the same preferences feed the launcher on a project home [3], the notifications bell and the daemon's sweeps [4]. This page is the one surface that lists all of them, so what it shows must match what those surfaces act on. What belongs to a package (the scheduler's spend offset, switches and publish picks, the subagents' models) is not here: it is in that package's own section, after the page's own.

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
[25] module: a package that adds to the dashboard (pages, Overview cards, side-rail tabs, what an agent's page shows, actions on the links pages show, Settings sections): its browser part, named by the package's `exports["./dashboard"]`, reads its data through its own package's command, or through its own server part, named by `exports["./server"]`, which the daemon calls in its own process. A module comes from a project's dependencies, or is built into the dashboard and loaded for every project, as the Files module is.

## Business logic — TL;DR

- **One page, one destination** - every control of the page's own sections reads and writes the user's own preferences, applied at once and saved in the background.
- **The Onboarding checklist stays on this page** - it sits above every section, cannot be dismissed here, and its two navigating steps lead to an agent's page or a project's launcher.
- **Appearance: theme and editor** - "Theme" follows the system by default; "Editor" offers "Auto-detect" plus the editors found on the daemon's machine.
- **Agent: which coding agent, which model, and post-merge cleanup** - "Agent" (Claude Code by default) and "Model", picked from the models that coding agent lists, the same list the launcher's select offers, or the coding agent's own default (the default); both handed to a project's start hook [8] with every start; picking another coding agent leaves no model picked; "Post-merge cleanup" (off by default), the default of the launcher's box of that name.
- **Devices, after "Agent"** - the saved devices follow directly, because a device is the other place an agent can run.
- **Notifications: how they reach you, and what about** - a delivery row ("Browser") showing both the preference and whether the browser lets it deliver, and two category rows ("Human Queue", "New activity").
- **Claude web: the bridge, and which browser does its work** - "Browser bridge" is off by default; while on, one exclusive choice decides whether the daemon runs the bridge browser or the user's own Chrome does the work, each option carrying its own setup.
- **After "Claude web": the sections the installed packages bring** - each module's [25] Settings section, in the order the dashboard mounted them, given only the projects that have its package; a section that fails shows why in its place and the rest of the page keeps working; none when no package brings one.
- **A list with nothing to pick is not shown** - a drop-down row with no choices is left out rather than rendered empty.

## Business logic

### One page, one destination

#### Context

**Problem**: a setting with more than one home leaves the user unable to tell which copy a value was written to. The page has one destination.

#### Business logic

Every control of the page's own sections reads and writes the user's own preferences [1], which the daemon keeps in the registry file `~/.the-framework.json`. The page belongs to no project. A change takes effect on the page the instant it is made and is saved to the daemon in the background; a failed save is not reported, and a value another tab changed is adopted when the daemon answers (the write rules are in `lib/preferences.ts`). The sections the installed modules bring keep their own data their own way (see "After "Claude web": the sections the installed packages bring").

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

### Devices, after "Agent"

#### Context

**User story**: the user saves another machine's daemon as a device [10] to run agents on it from this dashboard; the local daemon relays [9] the start to it.

#### Business logic

The "Devices" section follows the "Agent" section directly, because a saved device [10] is the other place an agent [5] can run. Its rows and rules live in `DevicesSettings.tsx`.

### Notifications: how they reach you, and what about

#### Context

**User story**: the user is told when an agent [5] waits for an answer or a pull request is ready to review, and optionally when an agent starts or finishes; in the browser while the dashboard is open.

**Problem**: a notification toggle is a preference [1]; whether the notification can be delivered is a capability the browser may withhold. A row that showed only the preference could promise a delivery that never happens, so the "Browser" row shows both, the same way the notifications bell does.

#### Business logic

The "Notifications" section has three rows. One says whether a notification reaches the user in the browser and two say what it is about; a notification is delivered only when browser delivery and its category are both on (the composition rule is in `src/preference-defaults.ts`).

- "Browser" ("Desktop notifications while the dashboard is open."): on when nothing is stored. When the browser has blocked notifications for the dashboard, the row is greyed, its description becomes "Blocked in your browser settings", the checkbox reads as off whatever the preference says, and it cannot be changed. The browser's permission is re-read every few seconds, so a permission granted or revoked in the browser shows on the page without a reload.
- "Human Queue" ("An agent awaiting your answer, or a PR ready to review."): the intervention [16] category; on when nothing is stored.
- "New activity" ("Also ping when an agent starts or finishes."): the activity category; off when nothing is stored.

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

### After "Claude web": the sections the installed packages bring

#### Context

**User story**: a project depends on the orchestration package and on the scheduler package; the user scrolls past "Claude web" and finds the first's Subagents section, where they pick the models a main agent's subagents run on, and the second's Scheduler section, where they switch a scheduled command on or off on this machine. A dashboard where no project has the package shows no such section.

**Problem**: a package's settings that this page drew itself would make the dashboard know each package's file and command, so every package's settings would be a change to the dashboard. The page names no package: what comes after its own sections is the installed modules' own.

#### Business logic

After the "Claude web" section, the page draws every Settings section the installed modules [25] declare (`ModuleSettingsSections.tsx`), in the order the dashboard mounted them: by each section's order, 50 when unsaid, then by package name (`lib/use-modules.ts`). Each is given the registered projects that have its package, as the daemon lists them, and draws its own title and rows with the same building blocks as the page's own sections (`SettingsRows.tsx`), so it looks like them. What a section holds, where it keeps it and how it saves is its package's; the page writes nothing of it to the preferences [1]. A section that throws while rendering shows "The <id> settings failed: <reason>" in its place, and the rest of the page keeps working. With no package bringing a section, nothing follows "Claude web".

### A list with nothing to pick is not shown

#### Context

**Problem**: an empty drop-down is a control that can be opened and not used; it reads as broken rather than as "no choices here".

#### Business logic

A row whose list of choices is empty is left out of the page entirely rather than shown as an empty drop-down (`SettingsRows.tsx`, the same row a module's section draws with). Every list of the page's own today has at least one entry ("Auto-detect" guarantees the editor list one, "the CLI's own default" the model list), so the rule guards the next list assembled at run time.
