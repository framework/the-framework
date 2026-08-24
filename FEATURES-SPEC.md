# Features

Every user-facing feature of The Framework, in the order a user meets them — from setup to what
happens while nobody is at the keyboard.

> @AI You must never add or remove a feature to this project without human approval.

## Setup

- Install globally or run via `npx`
- `the-framework` spins up the dashboard and the daemon, in the foreground — Ctrl-C closes the dashboard and every agent with it
- Activate a repo from the dashboard, picked in the OS folder picker behind a trust confirmation (commits dirty state, creates `.the-framework/`, teaches `.gitignore`, registers it)
- Onboarding checklist — each step derived from a real fact, not a click
- Prerequisite checks surfaced by the dashboard
- Per-agent preflight — probe the driver CLI before spending a branch

## Starting work

- Composer: type a prompt → an attended agent
- Composer: pick a preset → an unattended agent
- In-editor triggers (`/` presets and actions, `@` files and projects as context, macro tags)
- Options gear writing straight to preferences
- Pre-flight warnings before spending (no `gh`, logged out, repo can't auto-merge)
- Start an agent from a ticket row
- Start an agent from a queue entry's play button
- "Run now" on a routine, in a picked project the card remembers across navigations and reloads
- "Configure first, then run" on a routine — the launcher opens with its prompt, so the model and location can be set first
- What a routine's "Run now" is about to spend, on hover — what that routine does, how many agents it costs, which model it will use, and where it runs
- The whole CLI is one command: `the-framework` serves the dashboard — four options, no verbs
- `--host` / `--port`, the two things a browser cannot be asked; `--help` / `--version`
- Reach the dashboard from another machine — non-loopback bind behind a generated shared token
- Custom presets, private to you or saved into the repo and shared with the team

## The preset catalog

- Research — rate problem variability, then pick what to deep-dive
- Maintainability
- Readability
- Security audit
- UX (auto)
- Maintenance — periodic codebase sweep
- Market research
- Update from GitHub — an empty `tickets/` gets a full first import
- Plan tickets (aka spike)
- Suggest new tickets
- Suggest new features
- Suggest tickets to work on
- Spin up agents working on the AI queue
- Add quick-win work to the AI queue (triage-quick)
- Add consensual work to the AI queue (triage-consensual)

## Watching and steering an agent

- Live event stream rendered as a transcript
- The agent's questions render as answerable cards inline, where they happened
- A large scope becomes a `PLAN_<name>.agent.md` with a live Approve/Decline gate; declining stops the agent and hands control back
- An ambiguous prompt becomes a ranked list of interpretations to pick from
- A settled agent reads as "waiting for you", not as a status that only changes when it ends
- One gate shape for everything: a question with options — several picks when flagged, approve/decline as two options, and options marked to stop the agent rather than resume it
- Chat with a live agent; each message continues the same conversation
- Stop button (aborts the same signal Ctrl+C does)
- Resume a stopped agent with reduced options
- Reopen a finished agent — history restored, same conversation
- Changed files with diffs
- Git status bar
- Agent-authored markdown views pushed to the right rail
- Docs rail (surfaced PLAN / TODO files)
- History rail (past agents), with full-prompt tooltips
- Agent actions: stop, open in editor, open folder, open on GitHub, remove worktree, delete, copy id, copy resume command
- Merge when finished — arm auto-merge mid-flight
- The agent can drive a real browser (navigate, console, network, DOM, screenshots)
- Live browser screencast inline, degrading to a last still
- Hand the browser to the human on a login wall / captcha / 2FA
- An agent is a URL you can paste, reload and bookmark
- The agent names itself; the branch is renamed to match
- Ready-for-merge flips the agent's badge
- The agent reports what it could not get past: a red line in the log where it hit it, and a running error count on the session
- Live spend readout per agent
- See the exact system prompt the agent ran under

## Overview page

- Quota bar first — week track with pace and projection
- Open-questions hub: every agent's unanswered question, across all projects, answerable in place
- Agents working now
- The full AI queue of every project, uncollapsed
- Routine work panel
- Hottest tickets
- Projects sidebar
- Project errors: a project whose data branch cannot reach origin (push rejected, or no remote) is flagged with a red dot in the sidebar and a banner on its page, until a sync converges

## Tickets

- Cross-project ticket list
- Faceted filtering: text, priority/effort/uncertainty as buckets *or* ranges, topics, planning stage, project
- Sorting and group-by-project toggle
- The whole filter view mirrored to the URL so it can be shared
- Ticket detail page
- A plan page when a plan exists; a button to start an agent writing one when it doesn't
- Queue a ticket into the AI queue
- Queue every ticket the filters show into the AI queue, in one click from the page heading
- Tickets carry a GitHub issue link, so merging closes the issue

## Handoff and what lands in git

- Every agent gets its own git worktree and branch; your checkout is never touched
- Dependency directories shared from the parent checkout instead of reinstalled — as directories of links, so an agent's own install stays in its checkout and never rewrites or purges the parent's
- A checkout whose work is not on the remote is kept — and a publish-nothing (`handoff: local`) agent's is kept until you publish or delete it
- Commit what the agent left uncommitted
- Push the branch (on by default)
- Open a PR (on by default)
- The PR is named and described by the agent that did the work, when it wrote them — never titled with the prompt it was given
- Auto-merge — armed by config, authorized by the agent's ready signal
- Empty agents publish nothing
- Handoff panel: push / open PR / merge, as buttons
- A withheld merge is reported with its reason
- Agent history archived on the `tf-data` branch under per-user directories — pushed the moment a session settles
- Post-merge quality follow-ups queued (maintainability / security)
- Knowledge folded back into `DECISIONS.md` / `FACTS.md` / `INSIGHTS.md` at merge

## Autonomy — what happens when nobody is at the keyboard

- Auto PM: drain the confirmed queue, refill it when empty
- The routine rotation — update tickets from GitHub, triage quick wins, triage consensual work, plan tickets — plus a calendar-paced maintenance sweep
- Each routine individually switchable off
- Every stand-down reported with its reason ("it is a setting, not a bug"); a stand-down at the concurrency cap, or a fan-out that came out short, names the runs holding the slots
- Concurrency cap: how many unattended agents per project
- Fan-out planning: several agents, one ticket each
- Cross-machine ticket claims so two agents never double-work; a claim whose agent ended with nothing to hand off is freed by the daemon
- CI watch: merge a PR once its checks pass
- CI watch: one fix agent per red head commit, max two attempts
- Reclaim the checkout of an agent whose work is on the remote — never by publishing what a `handoff: local` agent refused to
- An agent that committed nothing leaves no branch behind: its empty branch goes with its checkout, never pushed — and the run-id branch it started on goes too, once the branch it moved to holds everything the run-id branch did
- A directory under `branches/` that git does not know as a worktree is never committed, pushed, linked or deleted through — it is reported and left alone, so a leftover can never stand in for your own checkout
- One triage at a time, across machines: a routine lock (`routines/<name>.lock.md` on the data branch) taken by the daemon before the run starts and released when it ends, whatever the ending; a held lock stands the routine down naming the machine holding it, with no agent spent; a lock left by a dead machine expires after four hours, and a daemon frees its own on boot
- The agent drains its own TODO backlog, one entry per turn

## Spending

- Usage panel: quota consumed, pace, projection
- Unattended work stands down past the pro-rated share of the week — quota gates *starting* work, never an agent already running
- The chosen model's own weekly allowance gates unattended work too — a spent model week holds the work back while the account's week still has room
- Work you asked for is never starved
- Spend-offset slider — the one budget control for autonomous work

## Configuration

- `the-framework.yml` — per-repo defaults that travel with the code
- `SYSTEM.md` — your own instructions on top of the built-in prompt
- Global user preferences
- Theme (system / light / dark)
- Preferred editor
- Model picker
- Driver picker — which coding-agent CLI runs the work (Claude Code / Codex)
- Claude Code permission mode passthrough
- Vanilla mode (drop the built-in prompt, keep the emit protocols)
- Transparent mode (raw `claude -p`, nothing framework-authored) — the one off-switch

## Remote execution and sharing

- Bind the daemon to the network behind a generated shared token
- Saved remote devices: run an agent on another machine's daemon — dashboard here, agents there
- Run on a fresh GitHub Actions runner
- Run on a Claude Code cloud session
- Chrome extension bridging claude.ai questions back to the dashboard
- A cloud session's conversation mirrored into the run view, turn by turn, as it is written
- Answer a cloud agent's question from the dashboard (typed back into claude.ai) — the same gate panel a local agent gets, multi-select and stop options included, listed with every other open question
- Browser-bridge token setting
- Web runs trust the project for Claude Code automatically — no manual trust step
- A cloud run's row follows the session's real branch and PR, with its armed draft PR opened when the session opens none
- Another machine's runs on the shared data branch are told apart: their rows carry a glyph naming the machine that started them (the Overview's working-now card spells it out), and a run is listed once even when two checkouts share its archive

## Notifications

- Browser notifications
- Discord notifications: agents started and finished
- Discord notifications: what needs a human (open PR, parked question, unpushed commits)
