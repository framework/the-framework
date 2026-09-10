The maintenance sweep's [1] bookkeeping and schedule. Per project, a small state file (`.the-framework/maintenance.json`) records the last commit a maintenance review covered and when the last codebase-wide sweep ran. The calendar-paced sweep, which Auto PM [2] fires as the maintenance routine [3], is due when a project has never been swept, when a week has passed since it was, or when the recorded time cannot be read. A second, commit-delta assessment is implemented here too: baseline a first-seen project, skip an unchanged one, review only new commits, and record progress only when the review succeeds. Auto PM uses only the schedule; the commit-delta sweep has no caller in the product today.

## Context

**User story**: a project that adopted The Framework late has a history no agent [4] ever looked at; once a week, while the machine is idle and the agent queue [5] is empty, the daemon runs the "Maintenance" preset over the whole codebase, and the follow-ups it finds land on the agent queue. The user switches the routine off, or fires it on demand, from the dashboard.

**Problem**: the schedule has to survive a daemon restart, so it is a file in the project's checkout [6] rather than loop state: a machine rebooted daily would otherwise sweep every morning and never reach its interval. Two features record into that one file, so neither may reset the other's schedule.

## Glossary

[1] sweep: a background job the daemon runs on its clock: Auto PM, the CI watch, the notification watchers, the sweep that reclaims checkouts, the branch-links sweep, the cloud scratch sweep, cloud work adoption.
[2] Auto PM: the daemon's unattended product management: drain the agent queue, and refill it by running the routines.
[3] routine: a preset the daemon fires on its own on a schedule — update tickets, triage quick, triage consensual, plan tickets, maintenance — each switchable off and runnable on demand.
[4] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends.
[5] the agent queue: `TODO_AGENTS.md` on the `agent-data` branch: every task agents will work next, in priority sections, worked top-down. An item on it is a queue entry.
[6] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch. The user's own working copy is "the project's checkout".
[7] quota boundary: the share of the quota week that may be spent by now, rising with the clock; unattended work stands down past it, work a human asked for never does.

## Business logic — TL;DR

- **The state a project keeps** - `.the-framework/maintenance.json` holds the last reviewed commit, when it was reviewed, and when the last codebase-wide sweep ran; a missing or malformed file reads as "never", and a partial update leaves the other fields alone.
- **When the calendar-paced sweep is due** - never swept means due now; otherwise due once a week has passed, exactly at the interval; an unreadable timestamp means due, not never.
- **Assessing a project for a commit-delta review** - a first-seen project is baselined at its current commit, an unchanged one is skipped, new commits mean a review, a directory that is not a repository is an error, and a reviewed commit git no longer knows means a re-review.
- **Running the commit-delta sweep** - baselines record without running anything, reviews run a maintenance agent and record the commit only on success so a failure is retried next time, and a per-sweep cap leaves the rest pending.

## Business logic

### The state a project keeps

#### Context

See `## Context`.

#### Business logic

Each project's maintenance state is one file, `.the-framework/maintenance.json`, with up to three fields: the full id of the last commit a commit-delta review covered, the time of that review, and the time of the last codebase-wide sweep. The two schedules use separate fields on purpose: the review fields track how far the commit-delta review has read, the sweep field paces a whole-codebase pass that ignores commits entirely, and sharing a field would make either feature silently reset the other's schedule.

Reading is forgiving: a file that is missing, unreadable or not valid JSON reads as an empty state (no prior review, never swept), and only the three known fields are kept, each only when it holds text. Writing creates `.the-framework/` if needed and replaces the file. A partial record merges the fields it mentions into what the file already holds, so the commit-delta review records its two fields and the calendar-paced sweep its one without touching the other's; a partial record on a project with no file yet creates the file.

### When the calendar-paced sweep is due

#### Context

**Problem**: the commit-delta review deliberately baselines a first-seen project at its current commit and never reviews the history before it, so a project that adopted The Framework late would never have its pre-existing code looked at. The calendar-paced sweep closes exactly that gap.

#### Business logic

A project is due a codebase-wide sweep when it has never been swept (due immediately, which is the case the sweep exists for), or when at least one week has passed since the recorded sweep time. Exactly one week counts as due, so a weekly sweep does not drift later each week. A recorded time that cannot be parsed (a hand-edited file) counts as due: a project must be swept, not fall silently out of the schedule forever.

The interval is a week and is deliberately not configurable: the sweep only queues follow-up entries on the agent queue [5] and only runs on an idle machine under its quota boundary [7], so the cost of it being a little too eager is a queue entry, not a bill. When Auto PM [2] fires the routine [3] it stamps the sweep time; when it stands down instead (the agent queue is not empty, the routine is switched off, or the user's click named another routine) the stamp is left untouched, so the sweep comes due normally later. That decision lives in `auto-pm.ts`, the stamping in `daemon-services.ts`.

### Assessing a project for a commit-delta review

#### Context

See `## Context`.

#### Business logic

Assessing one project resolves its current commit, reads its state, and decides one of four actions, never throwing:

- `error` when the directory is not a git repository or has no commits ("not a git repo, or it has no commits").
- `baseline` when no reviewed commit is recorded: the current commit will be recorded without reviewing the history before it.
- `skip` when the reviewed commit is the current commit, or when no commit has been added since it.
- `review` when commits have been added since the reviewed commit, with their count; and also when git no longer knows the reviewed commit (history was rewritten), with the note "reviewed commit not found (history changed); re-reviewing".

Every registered project is assessed the same way, and each assessment carries the project's registry id.

### Running the commit-delta sweep

#### Context

See `## Context`.

#### Business logic

Over the assessed projects, in order: a `skip` is counted and nothing runs; an `error` is counted as failed and reported ("✗ <path>: <note>"); a `baseline` records the current commit and the time, runs nothing, and is reported ("◆ baselined <path> at <short commit id>"). A `review` runs the maintenance agent [4] the caller supplies on the project ("▶ maintaining <path> (N new commits)…"); on success the current commit and the time are recorded ("✓ <path> reviewed"); on failure nothing is recorded ("✗ <path> maintenance session failed; will retry next sweep"), so the same commits are reviewed again next time. A caller may cap how many projects are reviewed in one sweep; baselines and skips do not count against the cap, and reviews past it are counted as pending. The sweep returns the tally: reviewed, baselined, skipped, failed, pending.
