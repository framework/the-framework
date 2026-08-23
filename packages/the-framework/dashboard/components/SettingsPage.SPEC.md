The dashboard's Settings page: every one of the user's own preferences in one place, grouped into sections, plus the onboarding checklist. Its subtitle states the page's own scope — "Your defaults, everywhere. A repo can override them in its own the-framework.yml."

## User story

- The user wants to find a setting by looking for it, rather than remembering which menu in the header it was hidden behind.
- The user wants the page to tell the truth about what will actually happen: a notification the browser has blocked, an option another option overrides, a Discord channel that has no webhook yet.
- A user part-way through onboarding wants to pick it back up from here.

## Business logic — TL;DR

- **Only the user's own settings are writable here** - a repo-shaped value belongs in that repo's committed `the-framework.yml`, edited in the repo, so everything this page writes is a default that a repo may override.
- **Onboarding lives here** - the checklist sits at the top of the page and cannot be dismissed, since this is where the Overview sends a user who wants to resume it.
- **Appearance** - theme (follow the system, or pin light or dark) and which editor "Open in editor" launches, chosen from the editors detected on the machine or left on auto-detect.
- **Agent** - which coding-agent CLI does the work, which model to pass through to it, and where an agent executes: this machine, a fresh GitHub Actions runner, or a Claude Code cloud session. The saved devices this daemon can run on are listed right after, since a device is the other place an agent can run.
- **Run options** - the same option table the launcher's gear shows, with the same rules already applied, so a rule cannot hold in one place and not the other.
- **A rule-disabled row is shown, not hidden** - an option another option overrides stays in place, greyed, and its description is replaced by the reason it cannot be changed.
- **Notifications** - browser and Discord as the delivery channels, and the two categories that can be sent: an agent awaiting an answer or a pull request ready to review, and agents starting and finishing.
- **A toggle never promises delivery it cannot make** - a channel the browser or the daemon cannot deliver on says so instead, and the Discord row carries the button that supplies what it is missing.
- **Automation** - whether Auto PM starts queued work on its own, and how far from the quota boundary unattended work is allowed to sit.
- **Claude web** - the browser bridge switch and its settings, introduced by why the bridge exists at all.

## Business logic

### Only the user's own settings are writable here

#### User story

See `## User story`.

#### Business logic

Every control on the page writes the user's own preferences. The page never edits a repo's committed configuration; a value that belongs to a repo is edited in that repo, so a settings page can only ever mean "the default". The page says exactly that under its title.

### Appearance

#### User story

See `## User story`.

#### Business logic

Theme follows the system by default and can be pinned to light or dark. The editor setting decides which editor "Open in editor" launches: auto-detect, or one of the editors detected on this machine.

### Agent

#### User story

See `## User story`.

#### Business logic

The driver setting picks which coding-agent CLI runs the work. The model is passed through to that CLI, and left empty means the CLI's own default. The run target picks where an agent executes: this machine, a fresh GitHub Actions runner, or a Claude Code cloud session.

Immediately after, the saved devices this daemon can run an agent on are listed and managed, since a device is the other answer to "where does this run".

### Run options

#### User story

The user comes here to check what a new agent will start with, and needs the answer to match what the launcher would do.

#### Business logic

The section renders the same option table the launcher's gear does, with the same interactions between options already resolved, so the effective value of every option reads identically in both places. Its own description says as much, and adds that an agent's own action bar can still change how that agent ends.

A row that the rules have turned off keeps its place, greyed, and shows the reason it is off in place of its usual description, rather than disappearing.

#### Rationale

Hiding a disabled row defeats the point of the page: this is where a user comes to look for a setting, and a setting that vanishes reads as a missing feature rather than as an override.

### Notifications

#### User story

See `## User story`.

#### Business logic

Two channels and two categories. The browser channel sends desktop notifications while the dashboard is open; when the browser has blocked notifications, the row is greyed, reads as off whatever the stored preference says, and its description says it is blocked in the browser's settings. The Discord channel delivers where no dashboard needs to be open; without a webhook configured on the daemon, it says it is not configured, and the row carries a button that opens the webhook setup — labelled "Set up" when there is none and "Webhook" once there is. Saving a credential there settles every surface that shows the channel's state at once.

The categories: "Human Queue" covers an agent awaiting the user's answer or a pull request ready to review, and is on by default; "New activity" additionally pings when an agent starts or finishes, and is off by default.

### Automation

#### User story

See `## User story`.

#### Business logic

The Auto PM switch decides whether queued work is started on its own while quota is left in the week. The spend offset is how far unattended work sits from the quota boundary, in percentage points: negative holds it back, positive lets it borrow from the days ahead. It is bounded to the same range the usage bar's handle and the daemon's own sanitizer use, and a typed value is held to that range as it is entered.

With no offset saved, the box shows the default actually in force rather than zero, rounded to one decimal.

#### Rationale

The box used to keep displaying a typed 9999 while the saved value had been clamped, and used to show 0 for an unset preference the daemon was not using. Both made the page disagree with what the daemon does.

### Claude web

#### User story

See `## User story`.

#### Business logic

The section explains why the bridge exists: a Claude web agent hands off and ends, so the questions its cloud session asks never reach this dashboard, and the browser bridge carries them back. Its switch opens one route on this daemon that a browser extension can reach, guarded by the token shown with the bridge's own settings below it.

### Controls that cannot be operated are not rendered

#### User story

See `## User story`.

#### Business logic

A setting picked from a list with no options to pick renders nothing at all, rather than an empty picker that reads as broken.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
