# Features

Every user-facing feature of The Framework, in one place. This catalog was originally compiled as
Part 2 of `TODO_SIMPLIFY.md`, a clean-slate simplification review of the whole repo (see
[#1536](https://github.com/gemstack-land/the-framework/pull/1536)). That review proposed a
**Keep / Simplify / Remove** verdict for every feature below, all 35 of its approved proposals
landed on that same branch, and the review document itself was then deleted — its live decisions
moved into each subsystem's `SPEC.md`. This file preserves the feature-by-feature inventory on its
own, since it is a useful map of the product independent of the review that produced it. The
verdict and `Ref` columns are left as they were: `Ref` points at the review's proposal codes (e.g.
`A6`, `D4`), which are no longer in the repo but are archived in full in PR #1536's description and
commit history.

**Tally: 173 user-facing features — 119 Keep, 7 Simplify, 47 Remove.**

The product a user actually came for — *register a repo, describe work, watch an agent do it,
get a PR, and let it keep working while you sleep* — is entirely inside the Keep column.

### Setup

| # | Feature | Verdict | Ref |
|---|---|---|---|
| 1 | Install globally or run via `npx` | Keep | |
| 2 | `the-framework` spins up the dashboard and finds/starts the daemon | Keep | |
| 3 | Activate a repo (commits dirty state, creates `.the-framework/`, teaches `.gitignore`, registers it) | Keep — via the dashboard only (the CLI path goes) |  |
| 4 | Auto-register every repo under a configured "repos directory" | Keep — via the dashboard only (the CLI path goes) |  |
| 5 | Onboarding checklist (6 steps, each derived from a real fact, not a click) | Simplify — steps for removed features go with them | A6 |
| 6 | `the-framework doctor` prerequisite check | Keep | |
| 7 | Per-session preflight (probe the agent CLI before spending a branch) | Keep | |

### Starting work

| # | Feature | Verdict | Ref |
|---|---|---|---|
| 8 | Composer: type a prompt → attended session | Keep | |
| 9 | Composer: pick a preset → unattended session | Keep | |
| 10 | In-editor triggers (`/` presets and actions, `@` files and projects, macro tags) | Keep | |
| 11 | Options gear writing straight to user/project preferences | Simplify — one preference tier | B5 |
| 12 | Pre-flight warnings before spending (no `gh`, logged out, repo can't auto-merge) | Keep | |
| 13 | Start a session from a ticket row | Keep | |
| 14 | Start a session from a queue entry's play button | Keep |  |
| 15 | "Run now" on a routine | Keep | |
| 16 | CLI `the-framework` — serve the dashboard | Keep — **the entire CLI** | D4 |
| 17 | CLI `--host` / `--port` | Keep (settled) — the two things a browser cannot be asked | D4 |
| 18 | CLI `--help` / `--version` | Keep (settled) | D4 |
| 19 | **The other 63 CLI flags**, each mirroring a dashboard control, encoding what the daemon passes its own child, or belonging to a removed feature | **Remove** — the dashboard is the only interface | D4 |
| 20 | Reach the dashboard from another machine (non-loopback bind behind a generated shared token) | Keep — the price of `--host`, and the sole reason the daemon token exists | D4 |
| 21 | CLI `--cwd` — which project | **Remove** — the Add-project panel already takes an absolute path | D4 |
| 22 | The dashboard keeps running in the background after you close the terminal | **Remove** (settled) — foreground only; Ctrl-C closes the dashboard and every session | D4b |
| 23 | CLI `--daemon` / `--daemon-serve` — run in the background | **Remove** (settled) — there is no background mode to select | D4b |
| 24 | CLI `the-framework stop` | **Remove** — Ctrl-C is stop | D4b |
| 25 | A later invocation from any repo finds the machine's running daemon | **Remove** — deletes the global state file, the heartbeat, and `ensureDaemon` | D4b |
| 26 | Sessions survive the CLI that started them | **Remove** — same process group, so Ctrl-C reaches them | D4b |
| 27 | Mid-flight sessions resume after a restart (within a day) | **Remove** — Ctrl-C is a deliberate "close everything" | D4b |
| 28 | CLI `the-framework doctor` | **Remove** as a verb — already a dashboard read (`AgentReady`, the onboarding checklist, the per-session preflight) | D4 |
| 29 | CLI `--fake` — deterministic offline demo | **Remove** from the user surface — the e2e harness appends it to its own child's argv | D4 |
| 30 | CLI `the-framework [intent...]` — build an app from scratch | **Remove** | A4 |
| 31 | CLI `the-framework prompt <text>` — one verbatim prompt | **Remove** as a verb — the *path* survives as the only run path; the e2e harness moves to an internal test interface, not this one | D2, D4 |
| 32 | CLI `the-framework research [what]` | **Remove** as a verb — it is a preset in the composer | D4 |
| 33 | CLI `the-framework maintain` — sweep repos for un-reviewed commits | **Remove** as a verb — folds into the daemon tick | D4, E4 |
| 34 | CLI `the-framework worktrees [rm\|prune\|sweep]` | **Remove** as a verb — it is the session actions menu | D4, E5 |
| 35 | CLI `the-framework relay` — host a watch relay | **Remove** | A6 |
| 36 | CLI `--resume` — reopen the last session's dashboard read-only | **Remove** — it is a URL in the dashboard | D3 |
| 37 | Start a session by typing a prompt in a terminal | **Remove** — the one real loss; see D4 | D4 |
| 38 | Topic sessions: start with no project, bind to one mid-run | **Remove** — costs the user one click up front | D7 |
| 39 | Custom presets saved to the user tier (private) or project tier (shared) | Simplify — one tier | B5 |

### The preset catalog (16 user-visible entries)

| # | Feature | Verdict | Ref |
|---|---|---|---|
| 40 | Research (rate problem variability, then pick what to deep-dive) | Keep | |
| 41 | Maintainability | Keep | |
| 42 | Readability | Keep | |
| 43 | Security audit | Keep | |
| 44 | UX (auto) | Keep | |
| 45 | Maintenance (periodic codebase sweep) | Keep | |
| 46 | Market research | Keep | |
| 47 | Import tickets from GitHub | Keep | |
| 48 | Update from GitHub | Keep — unchanged for now | E3 |
| 49 | Plan tickets (aka spike) | Keep | |
| 50 | Suggest new tickets | Keep — unchanged for now | E3 |
| 51 | Suggest new features | Keep — unchanged for now | E3 |
| 52 | Suggest tickets to work on | Keep — unchanged for now | E3 |
| 53 | Spin up agents working on the AI queue | Keep | |
| 54 | Add quick-win work to AI Queue (triage-quick) | Keep — unchanged for now | E3 |
| 55 | Add consensual work to AI Queue (triage-consensual) | Keep — unchanged for now | E3 |

### Watching and steering a session

| # | Feature | Verdict | Ref |
|---|---|---|---|
| 56 | Live event stream rendered as a transcript | Keep | |
| 57 | The agent's questions render as answerable cards inline, where they happened | Keep | |
| 58 | A large scope becomes a `PLAN_<session>.agent.md` with a live Approve/Decline gate; declining stops the session and hands control back | Keep | B1 |
| 59 | An ambiguous prompt becomes a ranked list of interpretations to pick from | Keep | |
| 60 | A settled session reads as "waiting for you", not as a status that only changes when it ends | Keep | |
| 61 | `ANALYSIS_RESULT.md` written into the repo every run (scope, ambiguity, plan yes/no) | **Remove** — nothing reads it | B2 |
| 62 | Three gate shapes: pick-one, pick-many, approve/decline | Simplify — one shape covers all three | D6 |
| 63 | Chat with a live session; each message continues the same agent conversation | Keep | |
| 64 | Stop button (aborts the same signal Ctrl+C does) | Keep | |
| 65 | Resume a stopped session with reduced options | Keep | |
| 66 | Reopen a finished session — history restored, same conversation | Keep | |
| 67 | Changed files with diffs | Keep | |
| 68 | Git status bar | Keep | |
| 69 | Agent-authored markdown views pushed to the right rail | Keep | |
| 70 | Docs rail (surfaced PLAN / TODO files) | Keep | B1 |
| 71 | History rail (past sessions), with full-prompt tooltips | Keep | |
| 72 | Session actions: stop, open in editor, open folder, open on GitHub, remove worktree, delete session, copy session id, copy resume command | Keep | |
| 73 | Session action: Serve / preview the app | **Remove** | A6 |
| 74 | Session action: copy a shareable watch link | **Remove** | A6 |
| 75 | Session action: Merge when finished (arm auto-merge mid-session) | Keep | |
| 76 | Live browser screencast inline, degrading to a last still | Keep | A6 |
| 77 | Hand the browser to the human on a login wall / captcha / 2FA | Keep — the reason a screencast is watched | A6 |
| 78 | A session is a URL you can paste, reload and bookmark | Keep | |
| 79 | The agent names the session; the branch is renamed to match | Keep | |
| 80 | Ready-for-merge status flips the session badge | Keep | |
| 81 | Live spend readout per session | Keep | |
| 82 | See the exact system prompt the agent ran under | Keep | |

### Overview page

| # | Feature | Verdict | Ref |
|---|---|---|---|
| 83 | Quota bar first — week track with pace and projection | Keep | |
| 84 | Open-questions hub: every session's unanswered question, across all projects, answerable in place | Keep | |
| 85 | Agents working now | Keep | |
| 86 | The full AI queue of every project, uncollapsed | Keep | B1 |
| 87 | Routine work panel | Keep | |
| 88 | Hottest tickets | Keep | |
| 89 | Projects sidebar | Keep | |

### Tickets

| # | Feature | Verdict | Ref |
|---|---|---|---|
| 90 | Cross-project ticket list | Keep | |
| 91 | Faceted filtering: text, priority/effort/uncertainty as buckets *or* ranges, topics, planning stage, project | Keep | F5 |
| 92 | Sorting and group-by-project toggle | Keep | F5 |
| 93 | The whole filter view mirrored to the URL so it can be shared | Keep | F5 |
| 94 | Ticket detail page | Keep | |
| 95 | A plan page when a plan exists; a button to start a session writing one when it doesn't | Keep | B1 |
| 96 | Queue a ticket into the AI queue | Keep | B1 |
| 97 | Tickets carry a GitHub issue link, so merging closes the issue | Keep | |

### Handoff and what lands in git

| # | Feature | Verdict | Ref |
|---|---|---|---|
| 98 | Every session gets its own git worktree and branch; your checkout is never touched | Keep | |
| 99 | Dependency directories shared from the parent checkout instead of reinstalled | Keep | |
| 100 | A failed or stopped session keeps its checkout for inspection | Keep | |
| 101 | Commit what the agent left uncommitted | Keep | |
| 102 | Push the branch (on by default) | Keep | |
| 103 | Open a PR (on by default) | Keep | |
| 104 | Auto-merge — armed by config, authorized by the agent's ready signal | Keep | |
| 105 | Empty sessions publish nothing | Keep | |
| 106 | Handoff panel: push / open PR / merge, as buttons | Keep | |
| 107 | A withheld merge is reported with its reason | Keep | |
| 108 | Conversations committed to the repo (readable chat, not the tool-call transcript) | **Remove** — with it the whole `conversations/` feature | B3 |
| 109 | `LOGS.md` — a committed human-readable project log, one entry per session | **Remove** — derivable from the event log | B3 |
| 110 | Session history archived in the repo under per-user directories | Keep — merged with #108 | B3 |
| 111 | Post-merge quality follow-ups queued (maintainability / security / readability) | Keep | |
| 112 | Knowledge folded back into `DECISIONS.md` / `FACTS.md` / `INSIGHTS.md` at merge | Keep | B4 |

### Autonomy — what happens when nobody is at the keyboard

| # | Feature | Verdict | Ref |
|---|---|---|---|
| 113 | Auto PM: drain the confirmed queue, refill it when empty | Keep | |
| 114 | Five routines (update-tickets, triage-quick, triage-consensual, plan-tickets, maintenance) | Keep — unchanged for now | E3 |
| 115 | Each routine individually switchable off | Keep | E3 |
| 116 | Every stand-down reported with its reason ("it is a setting, not a bug") | Keep | |
| 117 | Concurrency cap: how many unattended agents per project | Keep | |
| 118 | Fan-out planning: several agents, one ticket each | Keep | |
| 119 | Cross-machine ticket claims so two agents never double-work | Simplify — one claim mechanism | E2 |
| 120 | CI watch: merge a PR once its checks pass | Keep | |
| 121 | CI watch: one fix session per red head commit, max two attempts | Keep | |
| 122 | Reclaim the checkout of a session whose branch has landed | Simplify | E5 |
| 123 | Release a pinned routine branch left behind by a closed PR | Keep — the release sweep the branch lock needs | E2 |
| 124 | The session drains its own TODO backlog, one entry per turn | Keep | B1 |

### Spending

| # | Feature | Verdict | Ref |
|---|---|---|---|
| 125 | Usage panel: quota consumed, pace, projection | Keep | |
| 126 | Unattended work stands down past the pro-rated share of the week | Keep — it gates *starting* work, never a session already running | E1 |
| 127 | Work you asked for is never starved | Keep | |
| 128 | Spend-offset slider | Keep — the one budget control for autonomous work | E1 |
| 129 | Per-session USD cost cap (`--max-cost`) | **Remove** — wrong unit for a subscription | E1 |
| 130 | In-run consumption guard that pauses a session mid-flight | **Remove** — a running session is never interrupted for quota | E1 |
| 131 | Eco mode: trim prompt sections to save tokens | **Remove** — the whole eco setting | C1 |

### Configuration

| # | Feature | Verdict | Ref |
|---|---|---|---|
| 132 | `the-framework.yml` — per-repo defaults that travel with the code | Keep | |
| 133 | `SYSTEM.md` — your own instructions on top of the built-in prompt | Keep | |
| 134 | Global user preferences | Simplify — 32 keys; 7 go with eco/technical/autopilot/discordBot, and the 3-boolean handoff ladder is one ordinal | B5 |
| 135 | Per-project preference overrides (a third tier) | **Remove** — the repo file already does this | B5 |
| 136 | The run narrates which layer decided each setting | **Remove** — goes with the tier | B5 |
| 137 | Theme (system / light / dark) | Keep | |
| 138 | Preferred editor | Keep | |
| 139 | Model picker | Keep | |
| 140 | Agent picker (Claude Code / Codex) | Keep | |
| 141 | Claude Code permission mode passthrough | Keep | |
| 142 | `--context <dir>` — narrow the agent's focus | Keep | |
| 143 | Vanilla mode (drop the built-in prompt, keep the emit protocols) | Keep | C1 |
| 144 | Transparent mode (raw `claude -p`, nothing framework-authored) | Keep — as the *only* off-switch | C1 |
| 145 | Autopilot mode | **Remove** | C1 |
| 146 | Technical mode | **Remove** — only selects preset variants | C1, A5 |

### Remote execution and sharing

| # | Feature | Verdict | Ref |
|---|---|---|---|
| 147 | Bind the daemon to the network behind a generated shared token | Keep | |
| 148 | Relay: publish a session so teammates watch it live, read-only | **Remove** | A6 |
| 149 | Watch mode (the same app rendering one session read-only) | **Remove** — goes with the relay | A6 |
| 150 | Saved remote devices: run a session on another machine's daemon | Keep — dashboard here, agents there | A6 |
| 151 | Run on a GitHub Actions runner (`--run-on actions`) | Keep | A6 |
| 152 | Run on a Claude Code cloud session (`--run-on web`) | Keep | A6 |
| 153 | Chrome extension bridging claude.ai questions back to the dashboard | Keep | A6 |
| 154 | Answer a cloud session's question from the dashboard (typed back into claude.ai) | Keep | A6 |
| 155 | Browser-bridge token setting | Keep — the price of #153 | A6 |

### Notifications and chat

| # | Feature | Verdict | Ref |
|---|---|---|---|
| 156 | Browser notifications | Keep | |
| 157 | Discord notifications: sessions started and finished | Keep | |
| 158 | Discord notifications: what needs a human (open PR, parked question, unpushed commits) | Keep | |
| 159 | Discord chatbot: answer a parked question, steer a live session, start one | **Remove** | A6 |
| 160 | Discord reply mirror: the session's answers posted back to the channel | **Remove** — goes with #159 | A6 |

### The from-scratch build product

| # | Feature | Verdict | Ref |
|---|---|---|---|
| 161 | Point at an empty directory and the agent scaffolds a whole app | **Remove** | A4 |
| 162 | `--scope prototype\|full` | **Remove** | A4 |
| 163 | `--serve` — gate the loop on the app actually booting and answering | **Remove** | A4 |
| 164 | `--sandbox docker` — run the serve check in a throwaway container | **Remove** | A4 |
| 165 | A live preview link to the built app on the dashboard | **Remove** | A4 |
| 166 | One-click "show me the app" preview, no agent involved | **Remove** | A6 |
| 167 | `--deploy cloudflare\|dokploy` | **Remove** | A4 |
| 168 | Five domain presets (software / web / data-science / product / biological-science) | **Remove** — off by default already | A5 |
| 169 | `--kind bug-fix\|major-change` selecting which review chain gates the build | **Remove** | A5 |
| 170 | Framework detection ("Detected Vike, confidence 0.8") | **Remove** — the output is a log line | A5 |
| 171 | `--max-passes` review-loop budget | **Remove** — the loop is off by default | A3, A5 |
| 172 | Read-only mode checkboxes showing the review policy in effect | **Remove** — goes with #168 | A5 |
| 173 | `--browser` — give the agent a real browser (navigate, console, network, DOM, screenshots) | Keep | A6 |

### What a user loses, stated plainly

Worth being honest about, rather than hiding behind the LOC counts:

- **Building an app from nothing.** After A4 the product only works on repos that exist. That is
  what the root SPEC already describes; the from-scratch path is the older product.
- **Sharing a live session with a teammate.** No relay, no watch links. A PR is the sharing
  mechanism. (Remote *execution* stays — Actions runners, cloud sessions and second devices are
  the product, not a channel; see A6.)
- **Talking to The Framework from Discord.** No chatbot answering a parked question, steering a
  live session or starting one, and no reply mirror. Discord becomes outbound-only: it tells you
  something needs you, and you go to the dashboard.
- **A readable markdown conversation committed beside the code.** The exact session log is the
  record; the prose rendering of it goes, and `conversations/` with it (B3).
- **Trimming prompts to save tokens.** The whole eco setting goes — it contradicts a product whose
  headline rule is to spend the week's quota rather than leave it on the floor (C1).
- **A session being paused when quota runs low.** Quota now gates only whether work *starts*
  (E1).
- **One click that boots the project's app.** The preview server goes; `npm run dev` replaces it
  (A6).
- **Starting a session without picking a project first.** `topic` runs go — the bind protocol and
  the mid-run checkout move cost far more than the click they save (D7).
- **Gates auto-accepting while you watch.** With autopilot removed, a human at the dashboard is
  always asked; only a run with nobody watching takes the recommended option by itself (C1).
- **Work resuming by itself after a restart.** A deliberate Ctrl-C stops work and it stays
  stopped; restart a session from the dashboard, where the choice is visible (D4b).
- **Deploying.** Never really shipped (`cloudflare` and `dokploy` adapters, plan-only for
  everything else).
- **Doing anything from a terminal except serving the dashboard.** The CLI keeps `--host`,
  `--port`, `--help`, `--version` and nothing else (D4): no `the-framework "fix the login bug"`, no
  `research` / `prompt` / `maintain` / `worktrees` / `doctor` / `stop` verbs. This is the one loss
  that is not a channel but a *habit*, and the one most likely to be missed.
- **A dashboard that outlives the terminal.** Foreground only; Ctrl-C closes the dashboard and
  every session with it (D4b). Unattended overnight work means leaving the window open — visible
  and killable rather than invisible and persistent, which for a tool that spends your subscription
  is arguably the better trade.

Most of these are channels or conveniences rather than the core loop, and none is load-bearing for
"make the important decisions, let AI do the rest". Two are worth naming as genuine behaviour
changes rather than removals: quota no longer interrupts a running session, and gates no longer
auto-accept while someone is watching.
