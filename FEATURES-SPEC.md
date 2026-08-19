# Features

Every user-facing feature of The Framework, in the order a user meets them — from setup to what
happens while nobody is at the keyboard.

> @AI You must never add or remove a feature to this project without human approval.

## Setup

| # | Feature |
|---|---|
| 1 | Install globally or run via `npx` |
| 2 | `the-framework` spins up the dashboard and the daemon, in the foreground — Ctrl-C closes the dashboard and every agent with it |
| 3 | Activate a repo from the dashboard (commits dirty state, creates `.the-framework/`, teaches `.gitignore`, registers it) |
| 4 | Auto-register every repo under a configured "repos directory" |
| 5 | Onboarding checklist — each step derived from a real fact, not a click |
| 6 | Prerequisite checks surfaced by the dashboard |
| 7 | Per-agent preflight — probe the driver CLI before spending a branch |

## Starting work

| # | Feature |
|---|---|
| 8 | Composer: type a prompt → an attended agent |
| 9 | Composer: pick a preset → an unattended agent |
| 10 | In-editor triggers (`/` presets and actions, `@` files and projects as context, macro tags) |
| 11 | Options gear writing straight to preferences |
| 12 | Pre-flight warnings before spending (no `gh`, logged out, repo can't auto-merge) |
| 13 | Start an agent from a ticket row |
| 14 | Start an agent from a queue entry's play button |
| 15 | "Run now" on a routine |
| 16 | The whole CLI is one command: `the-framework` serves the dashboard — four options, no verbs |
| 17 | `--host` / `--port`, the two things a browser cannot be asked; `--help` / `--version` |
| 18 | Reach the dashboard from another machine — non-loopback bind behind a generated shared token |
| 19 | Custom presets, private to you or saved into the repo and shared with the team |

## The preset catalog

| # | Feature |
|---|---|
| 20 | Research — rate problem variability, then pick what to deep-dive |
| 21 | Maintainability |
| 22 | Readability |
| 23 | Security audit |
| 24 | UX (auto) |
| 25 | Maintenance — periodic codebase sweep |
| 26 | Market research |
| 27 | Update from GitHub — an empty `tickets/` gets a full first import |
| 28 | Plan tickets (aka spike) |
| 29 | Suggest new tickets |
| 30 | Suggest new features |
| 31 | Suggest tickets to work on |
| 32 | Spin up agents working on the AI queue |
| 33 | Add quick-win work to the AI queue (triage-quick) |
| 34 | Add consensual work to the AI queue (triage-consensual) |

## Watching and steering an agent

| # | Feature |
|---|---|
| 35 | Live event stream rendered as a transcript |
| 36 | The agent's questions render as answerable cards inline, where they happened |
| 37 | A large scope becomes a `PLAN_<name>.agent.md` with a live Approve/Decline gate; declining stops the agent and hands control back |
| 38 | An ambiguous prompt becomes a ranked list of interpretations to pick from |
| 39 | A settled agent reads as "waiting for you", not as a status that only changes when it ends |
| 40 | One gate shape for everything: a question with options — several picks when flagged, approve/decline as two options, and options marked to stop the agent rather than resume it |
| 41 | Chat with a live agent; each message continues the same conversation |
| 42 | Stop button (aborts the same signal Ctrl+C does) |
| 43 | Resume a stopped agent with reduced options |
| 44 | Reopen a finished agent — history restored, same conversation |
| 45 | Changed files with diffs |
| 46 | Git status bar |
| 47 | Agent-authored markdown views pushed to the right rail |
| 48 | Docs rail (surfaced PLAN / TODO files) |
| 49 | History rail (past agents), with full-prompt tooltips |
| 50 | Agent actions: stop, open in editor, open folder, open on GitHub, remove worktree, delete, copy id, copy resume command |
| 51 | Merge when finished — arm auto-merge mid-flight |
| 52 | The agent can drive a real browser (navigate, console, network, DOM, screenshots) |
| 53 | Live browser screencast inline, degrading to a last still |
| 54 | Hand the browser to the human on a login wall / captcha / 2FA |
| 55 | An agent is a URL you can paste, reload and bookmark |
| 56 | The agent names itself; the branch is renamed to match |
| 57 | Ready-for-merge flips the agent's badge |
| 58 | Live spend readout per agent |
| 59 | See the exact system prompt the agent ran under |

## Overview page

| # | Feature |
|---|---|
| 60 | Quota bar first — week track with pace and projection |
| 61 | Open-questions hub: every agent's unanswered question, across all projects, answerable in place |
| 62 | Agents working now |
| 63 | The full AI queue of every project, uncollapsed |
| 64 | Routine work panel |
| 65 | Hottest tickets |
| 66 | Projects sidebar |

## Tickets

| # | Feature |
|---|---|
| 67 | Cross-project ticket list |
| 68 | Faceted filtering: text, priority/effort/uncertainty as buckets *or* ranges, topics, planning stage, project |
| 69 | Sorting and group-by-project toggle |
| 70 | The whole filter view mirrored to the URL so it can be shared |
| 71 | Ticket detail page |
| 72 | A plan page when a plan exists; a button to start an agent writing one when it doesn't |
| 73 | Queue a ticket into the AI queue |
| 74 | Tickets carry a GitHub issue link, so merging closes the issue |

## Handoff and what lands in git

| # | Feature |
|---|---|
| 75 | Every agent gets its own git worktree and branch; your checkout is never touched |
| 76 | Dependency directories shared from the parent checkout instead of reinstalled |
| 77 | A checkout whose work is not on the remote is kept — and a publish-nothing (`handoff: local`) agent's is kept until you publish or delete it |
| 78 | Commit what the agent left uncommitted |
| 79 | Push the branch (on by default) |
| 80 | Open a PR (on by default) |
| 81 | Auto-merge — armed by config, authorized by the agent's ready signal |
| 82 | Empty agents publish nothing |
| 83 | Handoff panel: push / open PR / merge, as buttons |
| 84 | A withheld merge is reported with its reason |
| 85 | Agent history archived in the repo under per-user directories |
| 86 | Post-merge quality follow-ups queued (maintainability / security / readability) |
| 87 | Knowledge folded back into `DECISIONS.md` / `FACTS.md` / `INSIGHTS.md` at merge |

## Autonomy — what happens when nobody is at the keyboard

| # | Feature |
|---|---|
| 88 | Auto PM: drain the confirmed queue, refill it when empty |
| 89 | The routine rotation — update tickets from GitHub, triage quick wins, triage consensual work, plan tickets — plus a calendar-paced maintenance sweep |
| 90 | Each routine individually switchable off |
| 91 | Every stand-down reported with its reason ("it is a setting, not a bug") |
| 92 | Concurrency cap: how many unattended agents per project |
| 93 | Fan-out planning: several agents, one ticket each |
| 94 | Cross-machine ticket claims so two agents never double-work; a claim whose agent ended with nothing to hand off is freed by the daemon |
| 95 | CI watch: merge a PR once its checks pass |
| 96 | CI watch: one fix agent per red head commit, max two attempts |
| 97 | Reclaim the checkout of an agent whose work is on the remote — never by publishing what a `handoff: local` agent refused to |
| 98 | Release a pinned routine branch left behind by a closed PR |
| 99 | The agent drains its own TODO backlog, one entry per turn |

## Spending

| # | Feature |
|---|---|
| 100 | Usage panel: quota consumed, pace, projection |
| 101 | Unattended work stands down past the pro-rated share of the week — quota gates *starting* work, never an agent already running |
| 102 | Work you asked for is never starved |
| 103 | Spend-offset slider — the one budget control for autonomous work |

## Configuration

| # | Feature |
|---|---|
| 104 | `the-framework.yml` — per-repo defaults that travel with the code |
| 105 | `SYSTEM.md` — your own instructions on top of the built-in prompt |
| 106 | Global user preferences |
| 107 | Theme (system / light / dark) |
| 108 | Preferred editor |
| 109 | Model picker |
| 110 | Driver picker — which coding-agent CLI runs the work (Claude Code / Codex) |
| 111 | Claude Code permission mode passthrough |
| 112 | Vanilla mode (drop the built-in prompt, keep the emit protocols) |
| 113 | Transparent mode (raw `claude -p`, nothing framework-authored) — the one off-switch |

## Remote execution and sharing

| # | Feature |
|---|---|
| 114 | Bind the daemon to the network behind a generated shared token |
| 115 | Saved remote devices: run an agent on another machine's daemon — dashboard here, agents there |
| 116 | Run on a fresh GitHub Actions runner |
| 117 | Run on a Claude Code cloud session |
| 118 | Chrome extension bridging claude.ai questions back to the dashboard |
| 119 | Answer a cloud agent's question from the dashboard (typed back into claude.ai) |
| 120 | Browser-bridge token setting |

## Notifications

| # | Feature |
|---|---|
| 121 | Browser notifications |
| 122 | Discord notifications: agents started and finished |
| 123 | Discord notifications: what needs a human (open PR, parked question, unpushed commits) |
