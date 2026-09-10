The Settings page: every preference [1] the user can set, on one page, each change applied the moment it is made and saved to the daemon in the background, with the Onboarding checklist kept at the top. Everything written here goes to the user's own preferences; a project's `the-framework.yml` can override any of them for that project and is edited in the repository, never here, so a value on this page always means "the default".

## Context

**User story**: the user opens Settings (the address `/settings`) to look up or change a setting without hunting through the header's menus, and follows the Overview's [2] hint that the onboarding can be resumed on the settings page. The heading is "Settings" and the line under it reads "Your defaults, everywhere. A repo can override them in its own the-framework.yml."

**Business logic story**: the same preferences feed the launcher on a project home [3], the notifications bell and the daemon's sweeps [4]. This page is the one surface that lists all of them, so what it shows must match what those surfaces act on: an effective value, never a stored value that an agent [5] would ignore.

## Glossary

[1] preferences: the user's dashboard settings, kept in the registry (`~/.the-framework.json`, which also lists the projects).
[2] the Overview: the dashboard's cross-project page at `/`.
[3] project home: a project's own page with the launcher (the Start form) and its composer (the prompt editor, also used for live chat).
[4] sweep: a background job the daemon runs on its clock: Auto PM, the CI watch, the notification watchers, the sweep that reclaims checkouts, the branch-links sweep, the cloud scratch sweep, cloud work adoption.
[5] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends. Started from the dashboard by the user, or by the daemon.
[6] agent view: one agent's page.
[7] coding agent: the CLI doing the actual work: Claude Code or Codex.
[8] driver: a coding agent wrapped as a black box: start it in a directory, prompt it for one turn, stream what it does, resume it later. The user's driver choice is `claude` or `codex`.
[9] location: where an agent's turns run: `local` (this machine), `actions` (a GitHub Actions runner), or `web` (a Claude Code cloud session).
[10] device: another machine's daemon the user saved by URL and token, to run agents on it from this dashboard.
[11] transparent: an agent started with nothing of The Framework's — the raw coding agent.
[12] vanilla: an agent started without the built-in system prompt but with the signal protocols kept.
[13] the built-in system prompt: the standing instructions every agent starts with (`prompts/system_prompt.md`).
[14] ready for merge: the signal an agent emits when it believes its work is complete: it flips the agent's badge from building to ready and authorizes the handoff.
[15] handoff: what happens to an agent's work when the agent ends, as one ladder of four levels: `local` (keep the work in its checkout), `push` (push its branch), `pr` (also open a pull request — the default), `merge` (also merge it). "Handoff level" is a rung of that ladder.
[16] intervention: something that needs a human — an open question, a pull request to review, unpushed commits — one of the two notification feeds. The other is activity: an agent started or finished.
[17] Auto PM: the daemon's unattended product management: drain the agent queue, and refill it by running the routines.
[18] the agent queue: `TODO_AGENTS.md` on the `agent-data` branch: every task agents will work next, in priority sections, worked top-down.
[19] quota: the account's subscription allowance, as the coding agent reports it: a session window and a quota week, each with a percentage used.
[20] quota boundary: the share of the quota week that may be spent by now, rising with the clock; unattended work stands down past it, work a human asked for never does.
[21] spend offset: the user's adjustment of the quota boundary, in percentage points of the week.
[22] unattended: said of an agent nobody is watching: its gates take the recommended option and it ends when its work settles.
[23] cloud session: a Claude Code cloud session on claude.ai, the far end of a `web` agent.
[24] the Claude web bridge: the daemon's bridge endpoints plus the Chrome extension: carries the question a cloud session is parked on into the dashboard, and types the pick back into the session. The bridge token is the secret the extension presents; the bridge browser is the Chrome for Testing the daemon runs for it.

## Business logic — TL;DR

- **One page, one destination** - every control reads and writes the user's own preferences, applied at once and saved in the background; the page never writes a project's `the-framework.yml`.
- **The Onboarding checklist stays on this page** - it sits above every section, cannot be dismissed here, and its two navigating steps lead to an agent's page or a project's launcher.
- **Appearance: theme and editor** - "Theme" follows the system by default; "Editor" offers "Auto-detect" plus the editors found on the daemon's machine.
- **Agent: which coding agent, which model, where it runs** - "Agent" (Claude Code by default), "Model" (empty means the coding agent's own default) and "Run on" (this machine by default).
- **Devices, beside "Run on"** - the saved devices follow directly, because a device is the other place an agent can run.
- **Run options: the launcher's table, with reasons** - the same seven checkboxes the launcher's gear shows, each showing the effective value, and a row a rule turns off stays visible, greyed, with the reason in its place.
- **Notifications: how they reach you, and what about** - two delivery rows ("Browser", "Discord") and two category rows ("Human Queue", "New activity"), each showing both the preference and whether delivery can happen, with Discord's setup one button away.
- **Automation: Auto PM and the spend offset** - "Auto PM" is off until turned on; "Spend offset" is a whole number within ±50 that shows the default in force (7.1) when untouched.
- **Claude web: the bridge, and which browser does its work** - "Browser bridge" is off by default; while on, one exclusive choice decides whether the daemon runs the bridge browser or the user's own Chrome does the work, each option carrying its own setup.
- **A list with nothing to pick is not shown** - a drop-down row with no choices is left out rather than rendered empty.

## Business logic

### One page, one destination

#### Context

**Problem**: preferences [1] resolve in two tiers, the user's own settings and the open project's committed `the-framework.yml` on top (the resolution rules are in `lib/preferences.ts`). Only the first tier can be written from the dashboard; the repository file is edited in the repository. A page that could also write "for this project" would need a second destination and a way to show which tier won, for a value the committed file already states for everyone who clones.

#### Business logic

Every control on the page reads and writes the user's own preferences [1], which the daemon keeps in the registry file `~/.the-framework.json`. The page belongs to no project, so it shows the user's own values with no project's `the-framework.yml` layered on top. A change takes effect on the page the instant it is made and is saved to the daemon in the background; a failed save is not reported, and a value another tab changed is adopted when the daemon answers (the write rules are in `lib/preferences.ts`). The line under the heading tells the user where an override lives: "Your defaults, everywhere. A repo can override them in its own the-framework.yml."

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

### Agent: which coding agent, which model, where it runs

#### Context

**Business logic story**: a start is made of three things — which coding agent [7] does the work, which model, and where it runs. The launcher sets the same three per start; the values here are what every start begins from.

#### Business logic

The "Agent" section has three rows:

- "Agent" ("Which coding agent runs the work."): "Claude Code" or "Codex", the user's driver [8] choice. With nothing stored the driver is "Claude Code".
- "Model" ("Passed through to the agent. Empty uses the agent's own default."): free text, with the placeholder "the agent's default". The value is handed to the coding agent as the model to run on; left empty, the coding agent uses its own default.
- "Run on" ("Where an agent executes: this machine, a fresh GitHub Actions runner, or a Claude Code cloud session."): "This machine", "GitHub Actions" or "Claude web", the location [9] `local`, `actions` or `web`. With nothing stored the location is "This machine".

### Devices, beside "Run on"

#### Context

**User story**: the user saves another machine's daemon as a device [10] to run agents on it from this dashboard, which makes a device the other thing an agent [5] can run on besides the three locations.

#### Business logic

The "Devices" section follows the "Agent" section directly, because a saved device [10] is the other place an agent can run. Its rows and rules live in `DevicesSettings.tsx`.

### Run options: the launcher's table, with reasons

#### Context

**Problem**: the launcher's gear offers the same options, and the rules between them decide whether a box means anything: a transparent [11] agent ignores every other option, a rung of the handoff [15] ladder needs the rung below it, and the browser is wired only through Claude Code. Two hand-written copies of that table would drift, and a row that silently vanished when a rule turned it off would leave the user searching for a setting on the very page made for finding one.

#### Business logic

The "Run options" section ("What a new agent starts with. The launcher's gear shows the same options, and an agent's own action bar can still change its ending.") renders the one run-option table shared with the launcher; which rows are on, which are disabled and why is decided in `lib/agent-option-rows.ts`. Each row is a checkbox with a label and a one-line description:

- "Transparent" — "Raw Claude Code — turns the whole framework off." (or "Raw Codex —" when Codex is the driver [8]): the agent runs transparent [11].
- "Disable system prompt" — "Drops the added system prompt; keeps the agent controls.": the agent runs vanilla [12], without the built-in system prompt [13].
- "Post-merge cleanup" — "Runs quality passes once it is ready to merge.": quality passes once the agent signals ready for merge [14].
- "Push branch" — "Pushes the agent branch when it finishes.", "Open PR" — "Opens a draft pull request when it finishes.", "Auto-merge" — "Merges the pull request once it is opened.": the three rungs of the handoff [15] ladder above `local`. Ticking a rung sets the handoff to that rung; unticking it lowers the handoff to the rung below, so a merge is never armed with no pull request beneath it.
- "Browser" — "Gives the agent a real browser to inspect pages."

Every checkbox shows the effective value, not the stored one: an option that "Transparent" overrides reads as off, because off is what the agent will do. A row a rule turns off keeps its place, greyed, with the reason shown in place of its description rather than disappearing: "off while Transparent is on", "nothing to open while Push branch is off", "nothing to merge while Open PR is off", and for "Browser" under Codex "only on Claude Code — the browser is wired through its MCP config". With nothing stored, "Push branch" and "Open PR" are on (the default handoff is `pr`) and every other row is off.

### Notifications: how they reach you, and what about

#### Context

**User story**: the user is told when an agent [5] waits for an answer or a pull request is ready to review, and optionally when an agent starts or finishes; in the browser while the dashboard is open, or on Discord with no dashboard open.

**Problem**: a notification toggle is a preference [1]; whether the notification can be delivered is a capability the browser or the daemon may withhold. A row that showed only the preference could promise a delivery that never happens, so each row shows both, the same way the notifications bell does.

#### Business logic

The "Notifications" section has four rows. Two say how a notification reaches the user and two say what it is about; a notification is delivered only when its delivery method and its category are both on (the composition rule is in `src/preference-defaults.ts`).

- "Browser" ("Desktop notifications while the dashboard is open."): on when nothing is stored. When the browser has blocked notifications for the dashboard, the row is greyed, its description becomes "Blocked in your browser settings", the checkbox reads as off whatever the preference says, and it cannot be changed. The browser's permission is re-read every few seconds, so a permission granted or revoked in the browser shows on the page without a reload.
- "Discord": off when nothing is stored. Its description depends on whether the daemon has a Discord webhook: "Deliver to Discord, so notifications reach you with no dashboard open." when it has one, "Not configured — no webhook is set on the daemon" when it has none. Until the daemon has answered which channels it can deliver on, the row reads as configured rather than lighting up "not configured" on a page still loading. The checkbox can be ticked either way: the webhook is where to post, the toggle is whether to. A button beside the checkbox opens the Discord webhook dialog (`DiscordDialogs.tsx`); it is labeled "Webhook" when a webhook is already set and "Set up" otherwise. Saving in that dialog re-reads the daemon's channels for every reader at once, so this row, the Onboarding checklist above it and the bell agree immediately.
- "Human Queue" ("An agent awaiting your answer, or a PR ready to review."): the intervention [16] category; on when nothing is stored.
- "New activity" ("Also ping when an agent starts or finishes."): the activity category; off when nothing is stored.

### Automation: Auto PM and the spend offset

#### Context

**User story**: the user lets the daemon spend leftover quota [19] on the roadmap by itself: Auto PM [17] drains the agent queue [18] and refills it with its routines while the week's quota lasts. Because it spends the allowance unasked, it stays off until the user turns it on.

**Problem**: a typed offset beyond the allowed range must not be clamped on save while the box keeps showing what was typed, and an untouched offset must show the default the daemon is actually using rather than a zero it is not.

#### Business logic

The "Automation" section has two rows:

- "Auto PM" ("Start queued work on its own while there is quota left in the week."): off when nothing is stored.
- "Spend offset" ("How far unattended work sits from the quota boundary, in percentage points (max 50). Negative holds it back; positive lets it borrow from the days ahead."): a number field. The spend offset [21] moves the quota boundary [20] for unattended [22] work, in percentage points of the quota week: negative holds it back, positive lets it borrow from the days ahead. A typed value is rounded to a whole number and clamped into -50 to 50 before it is saved, so the box never shows a value the daemon will not use; a saved value is always a whole number. When nothing is stored, the box shows the default in force, half a day's share of the week (100 divided by 14, shown to one decimal as 7.1), not zero.

### Claude web: the bridge, and which browser does its work

#### Context

**Problem**: an agent [5] whose location [9] is `web` hands its task to a cloud session [23] and ends, so the questions the cloud session asks would never reach the dashboard. The Claude web bridge [24] carries them back and types the answers into the cloud session, and it needs a browser signed in to claude.ai to do so. Two toggles named "Browser bridge" and "Bridge browser" would read as anagrams of each other; the one real decision is which browser does the work.

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

A row whose list of choices is empty is left out of the page entirely rather than shown as an empty drop-down. Every list on the page today has at least one entry ("Auto-detect" guarantees the editor list one), so the rule guards the next list assembled at run time.
