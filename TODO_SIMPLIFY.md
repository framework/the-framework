# TODO_SIMPLIFY

A clean-slate simplification review of the whole repo, at the goal / system / high / mid levels.
Nothing here is applied — this is the proposal list.

The test applied to everything: **can this be removed?** Not "is it good code", not "is it
well-documented" — most of it is both. The question is whether the *concept* earns a place in a
product whose stated goal is one sentence long.

---

## Part 1 — What was reviewed

### Business & product framing
- `README.md`, `SPEC.md` (root), `AGENTS.md`, `MEMORY.md`, `TODO_AGENTS.md`, `package.json`
- `packages/the-framework.ai/` (marketing site) — its SPEC and pitch
- `tickets/` (77 tickets) — the roadmap as data
- `.changeset/` (76 pending changesets), `.github/workflows/` (5 workflows)

### Package / system topology
- `packages/ai-sdk` — 30,832 LOC (16.4k src / 14.4k test), 15+ providers, evals, computer-use,
  budgets, vector stores, React bindings
- `packages/ai-autopilot` — 10,176 LOC (6.2k src / 4.0k test) + 1,118 lines of preset/prompt data
- `packages/the-framework` — 57,828 LOC (31.4k src / 26.4k test)
- `packages/framework-dashboard` — 29,787 LOC (19.8k src / 10.0k test)
- `packages/chrome-extension` — 1,320 LOC JS
- `packages/the-framework.ai` — 1,993 LOC
- Cross-package import graph (traced symbol by symbol, not by `package.json` alone)

### Subsystems (SPEC + source, high & mid level)
- **Session runtime**: `run.ts`, `prompt-run.ts`, `steps.ts`, `run-telemetry.ts`, `run-view.ts`,
  `run-messages.ts`, `run-driver.ts`, `run-locks.ts`, `run-options.ts`
- **Gates & protocols**: `turn-gate.ts`, `await-gate.ts`, `gate-keepalive.ts`, `todo-loop.ts`,
  `prompts/protocols/*.md`
- **Prompting**: `system-prompt.ts`, `system-prompt-file.ts`, `prompt-template.ts`,
  `on-before-mergeable-prompt.ts`, `preset-catalog.ts`, `preset-prompt.ts`, `preset-registry.ts`,
  `presets.ts`, `project-presets.ts`, `prompts/*.md`, `prompts/presets/*.md`,
  `scripts/gen-prompts.mjs`, `scripts/check-prompt-drift.mjs`
- **Driver seam**: `driver/types.ts`, `claude-code.ts`, `codex.ts`, `cloud.ts`, `actions.ts`,
  `actions-zip.ts`, `agent-cli.ts`, `fake.ts`, `claude-code-quota.ts`, `child-registry.ts`
- **Daemon**: `daemon.ts`, `daemon-runtime.ts`, `daemon-services.ts`, `sessions.ts`, `control.ts`
- **Store & workspaces**: `store/run-store.ts`, `worktree.ts`, `worktree-deps.ts`, `suspend.ts`,
  `run-checkout.ts`, `worktrees.ts`, `merged-worktrees.ts`, `jsonl-tail.ts`
- **Autonomy**: `auto-pm.ts`, `queue-promote.ts`, `ticket-locks.ts`, `maintenance.ts`,
  `ci-watch.ts`, `stale-branch.ts`, `tickets.ts`
- **Spending**: `quota-boundary.ts`, `quota-poller.ts`, `consumption-guard.ts`, `usage.ts`
- **Config**: `registry.ts`, `config.ts`, `config-layers.ts`, `preference-defaults.ts`
- **Serving & read models**: `dashboard/*` (35 modules), `dashboard-rpc/*` (14 modules)
- **Surfaces**: `relay.ts`, `dashboard/remote-run.ts`, `dashboard/bridge-*.ts`, `discord/*`,
  `browser.ts`, `browser-stream.ts`, `dashboard/browser-proxy.ts`, `preview.ts`
- **Records in git**: `logs.ts`, `conversations.ts`, `conversation-commit.ts`, `install.ts`
- **Dashboard app**: pages/routing, `components/` (15.3k LOC), `lib/` (3.1k LOC), `design/`
- **Process**: 898 `SPEC.md` files (7,012 lines), 305 test files, `turbo.json`, `pnpm-workspace.yaml`

### Data models (on disk / in git)
`tickets/<date>_<slug>.md`, `<ticket>.plan.md`, `<ticket>.lock`, `TODO_AGENTS.md`,
`TODO_<session>.agent.md`, `PLAN_<session>.agent.md`, `ANALYSIS_RESULT.md`,
`knowledge-base/{DECISIONS,FACTS,INSIGHTS,MARKET_RESEARCH}.md`, `GOAL.md`, `BUSINESS_LOGIC.md`,
`SYSTEM.md`, `AGENTS.md`, `MEMORY.md`, per-file `SPEC.md`, `the-framework.yml`,
`.the-framework/{events.jsonl,run.json,runs/,control.jsonl,LOGS.md,conversations/,<user>/sessions/}`,
`~/.the-framework` registry (32 preference keys + secrets).

---

## Part 2 — Every user-facing feature, and its verdict

The full product as a user meets it, with a **Keep / Simplify / Remove** call on each and a
pointer to the proposal in Part 3. Nothing is omitted: features I propose deleting are listed
beside the ones that survive, so the cost of each proposal is visible in user terms rather than in
lines of code.

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

Every one of these is a *distribution or execution channel*, not the core loop. None of them is
load-bearing for "make the important decisions, let AI do the rest" — and each is currently paying
rent across the whole codebase in conditional branches, capability probing, and extra hosts.

---

## Part 3 — Suggestions

Ordered by impact. Each item states the subtraction, the argument, and what replaces it.

### Decision status

**All 39 proposals are ruled on: five rejected, the other 34 approved.** A **rejected** proposal
means *today's behaviour stays* — its section is kept as a recorded observation, not a queued
action, and nothing else in this document should assume it lands.

| | Proposals |
|---|---|
| **Rejected — today's behaviour stays** | **B1** the five work-item files stay · **B4** the knowledge base stays · **F5** the dashboard's filtering and sorting stay · **E3** the rotation and every preset stay, *for now* · **G1** SDD stays exactly as practised, every `SPEC.md` included |
| **Approved individually** | **G2** delete the whole release history — changesets, changelogs, migration notes, semver · **D4** four CLI options, no verbs · **D4b** foreground only, Ctrl-C closes everything · **E5** only remove what is pushed to the remote · **B3** keep the exact session log, delete `conversations/` + `LOGS.md` · **E1** quota gates starting, never interrupts a running session (slider stays) · **E2** keep `.lock.md` + the branch lock, delete the queue-entry pin · **C1** keep `--vanilla` and `--transparent`, delete eco, technical and autopilot · **A6** *partly* — cut the relay, the preview server and Discord's inbound half; keep remote devices, the Chrome extension, the browser + screencast, Actions runners and Discord *notifications* |
| **Approved as a batch** | A1–A5 · B2 · B5 · C2–C4 · D1–D3 · D5–D7 · E4 · E6 · F1–F4 · G3–G5 |

The last row was approved wholesale rather than argued point by point, so these are the ones that
change the most and are hardest to walk back. Each is a deliberate decision, not an oversight — but
if one is going to be pulled back, it is cheaper before the work starts than after (**G1** already
was, on exactly this basis):

| | What it commits to |
|---|---|
| **A4** | Deletes the "idea → running app" product outright: deploy adapters, serve gates, sandbox, scaffolding. The README still advertises it. |
| **G5** | Cuts test volume deliberately, in a repo whose tests are currently its main safety net for everything else on this list. |
| **F1** / **F3** | Replaces Vike with plain Vite and Telefunc with plain HTTP handlers — two framework swaps touching every route and every RPC. |
| **A1** / **A2** | Deletes `@gemstack/ai-sdk` and absorbs `@gemstack/ai-autopilot`, removing two packages the rest of the code still imports from today. |

**G1's rejection is the one that changes the shape of the work rather than its scope.** With SDD
kept, every deletion below takes its `SPEC.md` files with it and every behaviour change rewrites
them — see G1 for what that touches. The specs are not overhead beside this plan; they are part of
each step in it.

Three sub-questions were flagged inside sections rather than as proposals, and are settled the same
way — by the recommendation each section already made: **D4b** deletes `store/suspend.ts` (a
deliberate Ctrl-C should not have work resume behind it); **C1** resolves the system prompt's
maintenance stance to the **relaxed** branch (it is what nearly every run gets today, so it changes
nothing); **#77** keeps the browser hand-off at a login wall, following the screencast it belongs to.

### The work list

Every approved item, one line each. Full reasoning is in the section it names; the sections are
reference material for implementing, not an argument to be read start to finish.

| | Do |
|---|---|
| **A1** | Delete `@gemstack/ai-sdk`. Nothing in the product imports it. |
| **A2** | Move the two surviving pieces of `ai-autopilot` into `the-framework/src/`; delete the package. |
| **A3** | Call the build turn directly; delete the `Bootstrap` spine. |
| **A4** | Delete the from-scratch product: deploy adapters, serve gates, sandbox, scaffolding. |
| **A5** | Delete the domain-preset / review-loop engine and `framework-detection`. |
| **A6** | Cut the relay, the preview server, Discord's inbound half. Keep all remote execution. |
| **B2** | Delete `ANALYSIS_RESULT.md`. |
| **B3** | Keep the exact session log; delete `conversations/` and `LOGS.md`. |
| **B5** | One config file, two tiers; handoff ladder → one ordinal; named notification axes. |
| **C1** | Keep `--vanilla` + `--transparent`; delete eco, `--technical`, autopilot. |
| **C2** | Repo file becomes the prompt's source of truth; delete the drift checker. |
| **C3** | Delete `antiLazyPill`. |
| **C4** | `${{ }}` templating → plain string interpolation. |
| **D1** | Split `Driver`'s two axes: which CLI vs. where it runs. |
| **D2** | One run path; delete `prompt-run.ts`. |
| **D3** | One dashboard host; delete the capability-probing context. |
| **D4** | Four CLI options, no verbs; the daemon passes its child JSON, not flags. |
| **D4b** | Foreground only; delete the daemon's discovery, heartbeat, detached spawn and suspend/resume. |
| **D5** | Rename run→session (or the reverse) everywhere. |
| **D6** | One gate shape, one protocol block, one card. |
| **D7** | Delete `topic` runs. |
| **E1** | One gate on starting; delete `consumption-guard.ts` and `budgetUsd`. |
| **E2** | Keep `.lock.md` + the branch lock; delete the queue-entry pin. |
| **E4** | One daemon tick running a list of jobs. |
| **E5** | Only remove what has been pushed to the remote. |
| **E6** | Store the PR number. |
| **F1** | Vike → plain Vite. |
| **F2** | Export only what the dashboard imports. |
| **F3** | Telefunc → plain HTTP handlers (after D3). |
| **F4** | Depend on `animate-ui` or delete the animations. |
| **G2** | Delete the release history: changesets, changelogs, migration notes, semver. |
| **G3** | Fix the docs describing a different product — continuously, not last. |
| **G4** | Issue numbers as a suffix, never as the explanation. |
| **G5** | Nothing separate: tests leave with their features. Trim the remainder last. |

The rejections change what some approved items mean. B1 staying rejected is why **E2** and **B3**
are contained changes rather than the deep ones they were written as: the ticket format is
untouched, so E2 deletes one derivation and B3 deletes one rendering. It is also why contradiction
**#14** below has no resolution — the ambiguity `queue-promote.ts` documents in its own SPEC stays.
And with **E3** rejected, its P4 ticket has to be *fixed* rather than dissolved.

---

## A. System level — the package stack (largest wins)

### A1. Delete `@gemstack/ai-sdk` entirely — the product does not use it
**TL;DR —** Delete the package. Nothing in the product imports it.
**~30,800 LOC + ~120 SPEC files.**

`packages/the-framework` and `packages/framework-dashboard` import **zero symbols** from
`@gemstack/ai-sdk` (verified: no import of it exists outside `ai-sdk` and `ai-autopilot`).
`ai-autopilot`'s entire use of it is five symbols — `Agent` (mostly as a type), `Output`,
`toolDefinition`, `AnyTool`, `TokenUsage` — and every file that touches them
(`supervisor.ts`, `planner.ts`, `synthesizer.ts`, `decisions/tools.ts`, `overview/agent.ts`,
`runner/tools.ts`, `prompts/bridge.ts`, `bootstrap/deploy.ts`) is itself unreachable from the
product (see A2).

The root SPEC says it plainly: *"The Framework never runs its own model calls for the coding
work"* and *"The Framework adds orchestration, not another AI bill."* A 15-provider AI runtime
with evals, computer-use, image generation, speech, vector stores, rerankers, budget middleware
and React bindings is the exact thing the product promises not to be. It is here because of
lineage (spun out of `@rudderjs/ai`), not because of need.

**Do:** delete the package. If it has external value, it is a different product in a different
repo with a different release cadence — it does not belong in the monorepo whose name is
`the-framework`.

### A2. Absorb what survives of `@gemstack/ai-autopilot` into the product
**TL;DR —** Move the two surviving pieces into `the-framework/src/`, delete the package. Four layers become two.
**~4,900 of 6,151 src LOC + ~4,000 test LOC + 1,118 lines of preset data removable.**

Traced symbol by symbol, the product uses: `Bootstrap`, `LoopEngine`, `definePrompt`,
`promptInstructions`, `renderTask`, `EventStream`, `serveCheck`, `mergeChecklists`,
`builtinFrameworkPresetRegistry`, `builtinDomainPresets`, `selectPreset`, `cloudflareTarget`,
`dokployTarget`, `LocalRunner`, `DockerRunner`, `dockerAvailable`, plus types.

Never used by anything outside the package: `Supervisor`, `agentPlanner`, `agentSynthesizer`,
`pool`, the **decisions ledger** (567 LOC — the product has its own
`knowledge-base/DECISIONS.md` convention instead), the **overview / scale mode** (509 LOC),
`WebContainerRunner`, `FakeRunner`, `runnerTools`, `skill-manifest`, `launchAutopilot`,
`terminalSink`, `loadPromptsFrom`, `composeDomainPresets`.

And of what *is* used, most goes away under A3–A5 below. What genuinely remains is roughly:
`EventStream` (~90 LOC) and a small prompt-template helper.

**Do:** move those two into `the-framework/src/`, delete the package. This collapses the
four-layer stack (`dashboard → the-framework → ai-autopilot → ai-sdk`) into two packages
(product + its UI), which is what the code actually is.

> The root SPEC's "one family, one rule: the arrows point one way" diagram is describing an
> intent, not the system. Two of its four boxes are ballast.

### A3. Drop the `Bootstrap` spine — it degenerates to a single function call
**TL;DR —** Call the build turn directly; delete the `Bootstrap` spine, its event union, result type and phase vocabulary.
**~965 LOC + the four-phase vocabulary.**

`Bootstrap` sequences **scope → build → loop → deploy**. In the product:
- `scope` is `() => ({ scope: opts.scope ?? 'full', intent: opts.intent })` — a constant
  (`run.ts:438`). The "one and only interrogation" never happens.
- `checklist`/`improve` are omitted entirely unless a domain preset *or* a serve config is set
  (`run.ts:447`) — and since #1372 neither is set by default.
- `deploy` is omitted unless `--deploy` is passed (see A4).

So the default run is: `Bootstrap` with exactly one step, `build`. `DEFAULT_MAX_PASSES = 5`
governs a loop that does not exist. The class, its event union (re-wrapped as
`FrameworkEvent.bootstrap`), its `BootstrapResult`/`BootstrapScope`/`BootstrapSteps`/
`BuildContext` types, and the "synthetic Supervisor events so the narration still shows a plan"
shim in `steps.ts:196` all exist to make `await build(ctx)` look like a pipeline.

**Do:** call the build turn directly. Keep the review chain as an explicit, optional
`await review(...)` after it if A5 is rejected. One fewer event union, one fewer result type,
one fewer phase vocabulary in the dashboard.

### A4. Delete the "scaffold an app from scratch and deploy it" product
**TL;DR —** Delete the from-scratch product: deploy adapters, serve gates, sandbox, scaffolding.
**~2,500 LOC across both packages + 12 CLI flags.**

Still fully wired: `--deploy cloudflare|dokploy`, `--cf-project`, `--dokploy-url`,
`--dokploy-app`, `--serve`, `--serve-install`, `--serve-build`, `--serve-port`, `--serve-path`,
`--sandbox local|docker`, `--scope prototype|full`, `--max-passes`; plus `DeployTarget`,
`cloudflareTarget`, `dokployTarget`, `serveCheck`, `mergeChecklists`, the whole `runner/`
directory (Local/Docker/WebContainer/Fake, 1,586 LOC), `sandbox.ts`, `host-exec.ts`,
`AppPreview`, `syncThenServe`, `provisionServeRunner`, `startAppPreview`.

This is the **old** product ("Vite for AI" — still the whole of
`packages/the-framework/README.md`). The current one, per `SPEC.md`, *"takes an idea, a ticket,
or a queue entry to a reviewed pull request"* and *"Every session runs on its own branch, in its
own worktree"* — sessions work on **existing repos** and hand off **PRs**. Deploying a
Cloudflare Pages project from a session is not part of that goal at any level.

**Do:** delete it. Cost of being wrong: a user runs `npm run deploy` themselves.

Note the coupling this removes: `--serve` is the only reason a `Runner` abstraction exists in
the product, and `--sandbox docker` is the only reason `snapshotWorkspace` exists. The whole
"pluggable execution workspace" seam is downstream of one flag.

### A5. Delete the domain-preset / review-loop system
**TL;DR —** Delete the domain-preset and review-loop engine, and `framework-detection` with it.
**~1,700 LOC + 1,118 lines of preset markdown + 5 shipped "domains".**

`LoopEngine`, `Verdict`, `defineLoop`/`definePrompt`, `loop/policy.ts`, `loop/verdict.ts`,
`preset/load.ts`, `preset/conditions.ts`, `prompts/library.ts`, `prompts/bridge.ts`,
`framework-detection/` (249 LOC), and five shipped domain presets
(software-development, web-development, data-science, product-management, biological-science)
with mode variants.

Three arguments, any one of which is sufficient:

1. **It is off by default and the default was chosen deliberately.** #1372 settled that without a
   preset *nothing reviews the build*: "the agent is treated as a clever black box, and The
   Framework does not second-guess it." So the shipped behaviour is: this system does nothing.
2. **It contradicts `ai-autopilot`'s own stated core conviction** — *"don't trust a single pass…
   only an empty list counts as done"*. The package's central thesis is disabled in the only
   product that consumes it. One of the two is wrong; the default won.
3. **`biological-science` and `data-science` presets** in a coding-agent orchestrator are a
   generality nobody asked for. `framework-detection` scores dependencies to pick a preset whose
   only effect is narration ("Detected Vike") — `run.ts:307` says so outright: *"nothing about it
   reaches the agent's prompt (#547)."* A detector whose output is a log line.

**Do:** delete. If per-repo review policy is wanted later, it is a list of prompt files in the
repo, run after the build turn — not an engine with loops, verdicts, conditions, variants and
composition.

Removes with it: `--preset`, `--kind`, `--technical`, `OPEN_LOOP_MODES`, the `modes` event, the
read-only mode checkboxes in the dashboard, `project-presets.ts`, `preset-registry.ts`.

### A6. Cut the relay, the preview server and Discord's inbound half
**TL;DR —** Cut the relay, the preview server and Discord's inbound half (~2,800 LOC). Keep every remote-execution surface.
**~2,800 LOC.** Remote execution is the product, not a distribution channel, so it stays — this
proposal was originally scoped at ~4,500 LOC across eight surfaces and was cut back to three.

**Delete:**

| Surface | LOC |
|---|---|
| Relay — `relay.ts`, `relay-endpoints.ts`, `relay-dispatch.ts`, `relay-run.ts`, and the relay branches in `dashboard-rpc` | ~510 |
| Discord's inbound half — effectively all of `discord/` (see below) | ~1,840 |
| Preview — `preview.ts`, `preview-runtime.ts` | ~470 |

**Keep:** remote devices (`remote-run.ts` + the forwarding allowlist), the Chrome extension +
cloud driver + bridge endpoints/store/sessions, the browser + screencast + proxy (`browser.ts`,
`browser-stream.ts`, `browser-proxy.ts`), the GitHub Actions runner, and Discord *notifications*
(outbound webhook posts, which live outside `discord/` entirely).

**Removing the chatbot takes the whole `discord/` directory with it, and notifications do not
notice.** The split is already clean in the code: Discord's *outbound* half is webhook posts living
in `dashboard/{discord-webhook,activity,interventions}.ts` and `ci-watch.ts` — nothing under
`discord/` — while everything in `discord/` exists for the inbound half. `rest.ts` says why in its
own header: *"a webhook can only speak into one channel and cannot reply, so a bot that answers
where it was asked has to go through the API with its token."*

| Deleted | LOC |
|---|---|
| `discord/gateway.ts` + test — the WebSocket gateway | 697 |
| `discord/reply-mirror.ts` + test | 448 |
| `discord/bot.ts` + test | 289 |
| `discord/routing.ts` + test | 251 |
| `discord/live-run.ts` + test | 108 |
| `discord/rest.ts` | 47 |

Plus the `discordBot` preference, the `discordBotToken` secret and `DISCORD_BOT_TOKEN`,
`DISCORD_CHANNEL_ID`, the bot's wiring in `daemon-services.ts`, and the "token is set but the
preference is off" warning that exists because a connected-but-ignoring bot reads as broken rather
than as off. `discord-credentials.ts` shrinks to the webhook alone.

**One thread to unpick, not a blocker:** `dashboard/discord-webhook.ts` imports `clampContent`
from `discord/rest.ts` — the helper enforcing Discord's 2,000-character limit. It is ~6 lines and
belongs to the webhook path anyway; move it there and `discord/` deletes cleanly.

**And A6's original complaint dissolves rather than being managed.** The section opened by calling
Discord *"three subsystems with two independent transports (bot token* and *webhook) so each works
without the other"*. With the inbound half gone there is one transport, one credential, and one
direction — which is the shape notifications wanted in the first place.

**Keeping remote execution costs nothing in capability probing — the relay was paying that bill
alone.** Reading `dashboard-rpc/context.ts` seam by seam: `eventsSource` is set *only* by the relay
("it has no `events.jsonl` on disk"); `preferences` and the Discord credentials store are unset
*only* on "a public host (the relay)"; `preview` goes with the preview server. Every one of those
optional seams exists to describe the relay, and dies with it.

`remote` is the opposite case — *"only the daemon wires it"*, to tell a local run from one running
on a connected device. A remote device is not a dashboard host: the dashboard is always served by
the local daemon, which forwards. So once the relay and the foreground per-run dashboard are gone
there is exactly one host, and `contextRemote()` stops being an optional capability and becomes an
ordinary always-present dependency. **D3 keeps its full win** — one host, no probing, no
degradation matrix — with remote execution intact.

---

## B. Data model — one concept, many files

### B1. Five representations of "work to do" → one — *rejected*
**TL;DR —** **Rejected.** The five work-item files, the promotion mechanism and the lock all stay.

The five files (`tickets/<slug>.md`, `.plan.md`, `.lock.md`, `TODO_AGENTS.md`,
`TODO_<SESSION>.agent.md`, `PLAN_<SESSION>.agent.md`), `queue-promote.ts` (268 LOC),
`ticket-locks.ts` (187 LOC) and the claim derivation all stay.

**The one consequence to carry forward:** `queue-promote.ts`'s SPEC says "on the run's branch but
absent in the checkout" is *ambiguous* and needs a fork point to disambiguate. That ambiguity is
now permanent — it is contradiction #14, and the fork-point diffing is the answer to it, not a
workaround to be removed later.

### B2. `ANALYSIS_RESULT.md` is write-only — delete it
**TL;DR —** Delete `ANALYSIS_RESULT.md` — every run writes it, nothing reads it.
The system prompt instructs the agent to create it and add three entries (ambiguous yes/no,
scope size, …). Nothing reads it. There is a P2 ticket to *start* reading it
(`2026-07-25_show-prompt-analysis.md`). An artifact that has existed long enough to earn a
backlog item for being read is an artifact to delete, not to wire up.

### B3. Four records of "what happened" → one
**TL;DR —** Keep the exact session log. Delete the whole `conversations/` feature and `LOGS.md`.
`LOGS.md` (one entry per run, committed), `.the-framework/conversations/<runId>.md` (the readable
chat, committed), `.the-framework/<user>/sessions/*` (archived session history, committed),
`.the-framework/{events.jsonl,run.json,runs/*}` (the live/archived event log, gitignored) — plus
the branch and the PR, which are also records.

`LOGS.md` is derivable from the archive. The archive is the event log. The conversation is a
projection of the event log (`driver` text events + human turns) — which is precisely what
ticket `2026-07-28_discord-mirror-read-events.md` (P5, top of the queue) is about: the Discord
mirror currently *polls and diffs the conversation markdown* instead of reading the event log,
because the two exist in parallel.

**Do (settled): keep the exact session log, delete the fuzzy markdown rendering.** The event log
is the record, committed as the session archive at teardown. Delete the whole `conversations/`
feature — the directory, the committer, the debounced writer, and the polling that reads it — and
delete `LOGS.md` (`logs.ts`, 267 LOC + its escaping rules against prompt-forged entries).

A prose re-narration of a verbatim transcript is a second, lossier copy of something already
exact: it drifts, it needs its own escaping, and anything reading it is reading a summary when the
source is right there. The `2026-07-28_discord-mirror-read-events.md` ticket dissolves rather than
gets fixed — the mirror it was about is removed under A6, and the markdown it polls no longer
exists.

### B4. Knowledge-base sprawl → one file — *rejected*
**TL;DR —** **Rejected.** The knowledge base stays as it is.

`knowledge-base/{DECISIONS,FACTS,INSIGHTS,MARKET_RESEARCH}.md`, `GOAL.md` and `BUSINESS_LOGIC.md`
all stay as separate concepts, and `MEMORY.md` continues alongside them.

### B5. Two config files + four preference tiers → one file, two tiers
**TL;DR —** One config file, two tiers. Plus the handoff ladder → one ordinal, and named notification axes. 32 → 23 keys.
`the-framework.yml` (repo), `~/.the-framework` registry (user globals + per-project overrides +
secrets + token), plus per-run flags. `config-layers.ts` exists solely to resolve
run > project > repo-file > user with "the nearest tier that *set* something wins", and each
settled key remembers its provenance so the run can narrate it. `run-options.ts` exists to map
preferences into run options. `preferences.ts` in the dashboard (436 LOC) mirrors the tiers again.

For a single-user local tool, **repo file + user file** is enough; per-project overrides in the
user file duplicate what the repo file already does, and the repo file is the one that should win
for repo-shaped settings. Dropping one tier deletes the provenance tracking and the narration
that goes with it.

#### The key count is not the problem — two *shapes* are

There are **32 keys**, not the 35 claimed in an earlier draft of this document, and the earlier
list of "removable outright" keys named six that settled decisions have since protected
(`vanilla`, `transparent`, `browser`, `bridge`, `target`, `notifyBrowser`). Checked key by key,
what actually goes is small:

| | Keys | Why |
|---|---|---|
| **Removed outright** | `technical`, `eco`, `ecoPlanning`, `ecoResearch`, `ecoMaintenance`, `autopilot`, `discordBot` | C1 deletes the whole eco setting, `--technical` with the presets it selects (A5), and autopilot mode (#145) — nothing replaces the last one, because a headless gate already falls back without it. `discordBot` goes with the chatbot (#159) |
| **Protected by settled decisions** | `vanilla`, `transparent` (C1) · `browser` (#173) · `target` (#151/#152) · `bridge` (#155) · `notifyDiscord` (#157/#158) · `autoSpendOffset` (#128) · `autoPmOptOut` (#115) · `autoPmConcurrency` (E3 rejected) · `reposDirectory`, `reposDirectoryAutoGrant` (#4) | Each is a feature that was reviewed and kept |

That is **seven keys deleted**, not a purge. The remaining 25 are, with two exceptions, genuinely
distinct settings — `model`, `agent`, `editor`, `theme` and the rest are not duplicates of each
other. **The two exceptions are worth more than the count:**

**1. The handoff ladder is one ordinal wearing three booleans.** `autoPushBranch` (absent = on) →
`autoOpenPr` (absent = on, and its own doc says it *"implies `autoPushBranch`"*) → `autoMerge`
(absent = off). These are strictly nested stages of one pipeline: push, then open a PR, then merge
it. Three independent booleans describe eight states of which four are reachable, and the
implication has to be written in a doc comment because the type cannot express it. One ordinal —
`handoff: 'local' | 'push' | 'pr' | 'merge'` — has exactly the four real states and makes the
implication structural. **3 keys → 1**, and the impossible combinations stop being representable.

**2. The notification matrix is a 2×2 flattened into four booleans with four different defaults.**
`notifyBrowser` (default **on**) and `notifyDiscord` (default **off**) are *methods*;
`notifyHumanIntervention` (default **on**) and `notifyNewActivity` (default **off**) are
*categories*. Nothing in the names says which axis a key belongs to, so
`discordNotificationEnabled` has to AND them back together — and its own comment records the cost:
the composition *"was open-coded per call site and got the category's polarity wrong by copying
its sibling."* That is a defect that already happened, caused by the shape rather than the count.
The fix is to name the axes (methods × categories, each cell defaulting on its own merits), which
may not remove a single key but removes the class of bug.

**Net: 32 → 23 keys**, and the two clusters above are where the actual complexity lives.

---

## C. Prompting — the mode matrix and the source of truth

### C1. Five prompt "modes" → two switches
**TL;DR —** Keep `--vanilla` and `--transparent`. Delete eco, `--technical` and autopilot. Five modes → two booleans.
Today, orthogonally combinable: `antiLazyPill` (aka `--vanilla`), `--transparent`, `eco`
(`autoPlanning`, `autoResearch`, `autoMaintenance`), `--autopilot`, `--technical`. That is a
2×2×2×2×2×2 space of system channels, of which the tests can only pin a few.

Specific findings:
- **`--vanilla` and `--transparent` both stay (settled).** They are two different questions, not
  one asked twice: vanilla drops the built-in prompt and context docs while keeping the emit
  protocols, so the dashboard still sees gates, questions and completion; transparent drops
  everything and gives you raw `claude -p`. The first is "run my prompt, keep the instrumentation",
  the second is "get out of the way entirely" — and a debugging switch that cannot distinguish
  *my prompt misbehaves* from *the framework misbehaves* is not much of a debugging switch. The
  cost is one genuinely orthogonal boolean, not a mode.
- **`eco.autoMaintenance` acts on a different prompt than the one it lives in.** Its own doc says
  *"Nothing to drop here"* — the section moved out in #556 and the flag now reaches into
  `on-before-mergeable-prompt.ts`. A flag in the wrong home is a flag to delete.
- **Eco contradicts the spending policy.** Eco exists to save tokens; the product's headline
  spending rule is *"Spend the whole week's quota, never starve the user… nothing is left on the
  floor."* Trimming a ~60-line system prompt to save tokens, in a system that deliberately spends
  its entire weekly allowance on unattended work, is not a real economy.
- **`--technical` only selects preset variants**, and presets go under A5.
- **`autopilot` is removed outright (settled), and it turns out nothing needs replacing.** The
  earlier draft proposed keeping it as an `autoAcceptGates` boolean, on the reasoning that its
  remaining effect was the choice-gate countdown. Checking `await-gate.ts` first: a headless run
  *already* resolves gates without it. There is a recommended fallback (`PROCEED`) applied
  whenever a gate "cannot get a real answer", the interactive handler is explicitly *"omit for a
  headless run"*, and the code is explicit that it will "approve so a headless (or aborted) run
  proceeds". A gate parked for input **never hangs**, autopilot or not.

  So unattended work does not depend on this mode, and removing it does not deadlock Auto PM. What
  it actually deletes is auto-accept at an *interactive* gate — the case where a human is sitting
  at the dashboard and the mode decided not to ask them. **The gate's audience is the real signal,
  and it is already available structurally:** somebody is watching, so ask; nobody is, so take the
  recommended option. That is a property of the run, not a setting, which is why no boolean has to
  survive. (Interacts with **D6**, which consolidates the gate mechanisms — do C1 first, so auto-accept is no longer a mode competing with the shapes being merged.)

**Do:** keep `--vanilla` and `--transparent` as the two off-switches, and nothing else. Delete
**the whole eco setting** (settled) — `dropSection`, `ECO_SECTION_HEADINGS`, `applyEco`, the three
`auto*` sub-flags and the tests pinning heading names against the template — plus `--technical`
with the presets it selects (A5), and `--autopilot` outright (settled). Five combinable modes
become **two booleans**: a 2×2 the tests can cover exhaustively, instead of 2⁶.

**The prompt-content half is settled with it: keep the relaxed stance.** The system-prompt
template branches on `tf.params.autopilot` — per the changelog it *"relaxes the maintenance stance
on autopilot runs"* — and with the mode gone that branch has to resolve to one stance for
everybody. It resolves to the **relaxed** one, because `autopilotEnabled` is
`preferences.autopilot ?? true`: autopilot is on by default, so the relaxed stance is already what
nearly every run gets and collapsing to it changes nothing. Taking the strict branch would have
quietly changed behaviour for everyone while looking like a deletion.

### C2. The system prompt's source of truth is a GitHub issue — invert it
**TL;DR —** The repo file becomes the source of truth; delete `check-prompt-drift.mjs`, its workflow and the snapshot.
`scripts/check-prompt-drift.mjs` (124 LOC) fetches **issue #326** daily in CI and fails when
`prompts/system_prompt.md` no longer matches the markdown blocks in the issue body. A second block
"cannot ship verbatim" (it nests `${{ }}` fragments the renderer cannot parse), so it is
*snapshotted* instead and a human re-flattens it by hand when it changes.

So: the canonical artifact lives outside the repo, in a mutable comment thread; the repo is a
copy; a scheduled job detects the copy going stale; and one of the two blocks can only ever be
approximately synced. (The workflow's `paths:` filter already points at
`op-326-post-merge.snapshot.md`, while the file on disk is
`op-326-on-before-mergeable.snapshot.md` — the drift-checker has drifted.)

**Do:** the repo file is the source of truth. Review prompt changes in PRs, like everything else.
Delete `check-prompt-drift.mjs`, its workflow, the snapshot file, and the `${{ }}` nesting
limitation that forced the flattening.

### C3. `antiLazyPill` — rename or delete
**TL;DR —** Delete `antiLazyPill` — three comments apologise for the name, and C1 removes it anyway.
The config key is `antiLazyPill`, the flag is `--vanilla`, the concept is "include the built-in
system prompt", and the code comments apologise for this in three separate places ("the name is
the historical config key"). With zero users, breaking changes cost nothing (`AGENTS.md` says so
explicitly). Under C1 it disappears anyway.

### C4. `${{ }}` JS-in-markdown templating → plain string interpolation
**TL;DR —** Replace `${{ }}` JS-in-markdown with plain string interpolation.
`prompt-template.ts` evaluates JS fragments inside prompt markdown, against a `TfContext` whose
shape (`tf.params`, `tf.settings.technical_control`, `tf.presets.*.filePath`, `tf.session_name`)
is a mini-language. The scanner cannot nest (stops at the first `}}`), which is what forced the
flattening in C2 and what the `maintenance` preset comment works around. Two or three named
placeholders substituted by the caller would cover every real use.

---

## D. Session runtime and control flow

### D1. The `Driver` seam conflates two orthogonal axes
**TL;DR —** Split the `Driver` seam's two axes: which CLI to spawn vs. where the run executes.
Five "drivers": `claude-code`, `codex`, `cloud`, `actions`, `fake`. But `cloud` and `actions` are
**the same agent in a different place** — Claude Code on claude.ai and Claude Code in a GitHub
Actions runner. The seam models *"which agent"* and *"where it runs"* as one dimension, and the
CLI exposes both (`--agent` **and** `--run-on`, plus a `target: 'local'|'actions'|'web'`
preference).

The cost of that conflation is visible: `handsOff` had to be added as a **driver property that
disables half the run's phases** (`run.ts:430`, and again in the todo loop, the chat phase, the
checklist, the system prompt's `HANDS_OFF_PROTOCOL`). A property of *where* leaked into the
abstraction for *what*.

**Do:** if remote execution survives A6 at all, model it as a separate `location` with its own
lifecycle, and keep `Driver` to "which CLI do I spawn". Better: drop `cloud` and `actions`
entirely (A6) and the whole `handsOff` axis disappears with them — six conditionals across
`run.ts`, `steps.ts`, `system-prompt.ts` and `cli.ts`.

### D2. Two run paths that must not drift → one
**TL;DR —** One run path. Deletes `prompt-run.ts` (211 LOC) and the drift risk `composeRunSystem` exists to manage.
`runFramework` (the build path) and `runPrompt` (the direct-prompt path). `composeRunSystem`
exists specifically because the two "each inlined the composition and one nested the protocols
inside the built-in-prompt branch" (#500/#501). Once `Bootstrap` is gone (A3) and presets are gone
(A5), the build path *is* "one prompt, honoring gates" — which is exactly what `runPrompt` is.

**Do:** one path. Deletes `prompt-run.ts` (211 LOC) or most of `run.ts`, the divergence risk that
`composeRunSystem` was created to fix, and the `Kind{Build task or direct prompt?}` branch in the
flow diagram.

### D3. Two dashboard hosts + one relay host → one
**TL;DR —** One dashboard host. Deletes the capability probing and the whole degradation matrix.
The daemon serves the dashboard; `the-framework "prompt"` *also* starts a foreground per-run
dashboard on its own port with a `singleProjectProvider`; the relay is a third host. This is why
`dashboard-rpc/context.ts` probes six optional capabilities on every call and every RPC has an
"absent capability" branch.

Given the daemon is the stated architecture, the foreground dashboard is a second implementation
of the product's front door. **Do:** the CLI serves the dashboard, full stop. One host, no
capability probing, no graceful degradation matrix — see A6 for the seam-by-seam check that
keeping remote execution does not preserve any of it.

### D4. The CLI keeps four options and no verbs
**TL;DR —** Four options, no verbs. The daemon hands its child a JSON blob instead of 27 flags.
**67 flags → 4. 10 verbs → 1. And `cli.ts` (2,589 lines) stops being four things at once.**

The dashboard is the product's user interface. Every *setting* on the CLI is therefore either a
duplicate of a dashboard control or an encoding of something the user never types. Sorting all 67
flags by who actually supplies them:

**(1) The daemon's process API — 27 flags, zero human users.**
`--agent --auto-merge --auto-open-pr --auto-push-branch --autopilot --browser --context
--continue-run --cwd --eco-auto-planning --eco-auto-research --eco-auto-maintenance --model
--no-dashboard --on-before-mergeable --plan-run --queue-entry --resume-session --run-id --run-on
--technical --ticket --topic --transparent --unattended --vanilla --via`

These are `StartRunOptions` serialized onto a command line: `daemon-runtime.ts:155` spawns
`bin.js` with them, and every field of `StartRunOptions` carries a "maps to `--x`" comment. It is
an IPC format wearing a CLI's clothes — which is why it must *also* be human-facing, mutually
validated, tri-stated (`--auto-open-pr` / `--no-auto-open-pr` exist so an explicit off can survive
a repo file that says on), and documented in a 140-line help text.

**Do:** hand the child a JSON blob on a temp file or fd. These 27 stop existing as flags. The
tri-state dance goes with them: JSON has a real `false`, so `--no-*` pairs (7 flags) are
unnecessary. So does most of the "flags that cannot apply say so before the spending" validation,
because the daemon never constructs an invalid combination.

**(2) Duplicates of a dashboard control — the same 27, seen from the human side.**
Every one is already settable in Settings or the composer's options gear. Keeping both is what
forces `config-layers.ts` to exist: its entire job is reconciling *run flags* > project prefs >
repo file > user prefs, with each settled key remembering which tier decided it so the run can
narrate its provenance. **Delete the flag tier and that collapses to three; with B5 (drop the
per-project tier) it is two — repo file and user prefs — which is small enough not to need a
resolver at all.**

**(3) Flags belonging to features proposed for removal — ~23.**
`--deploy --cf-project --dokploy-url --dokploy-app --serve --serve-install --serve-build
--serve-port --serve-path --sandbox --scope` (A4); `--preset --kind --max-passes` (A5);
`--share --session-link` (A6); `--vanilla --technical --eco-*` (C1); `--max-cost` (E1);
`--resume` (D3); `--topic` (D7). They go with their features.

**(4) What survives: four options, no verbs. (Settled — see `MEMORY.md`.)**

```
the-framework [--host <addr>] [--port <n>]     # serve the dashboard in the foreground
the-framework --help | --version
```

`--host` and `--port` are kept because they are the two things a browser cannot be asked and a
dashboard cannot serve about itself; `--help` and `--version` because a command with options owes
the user both. Everything else goes:

| Dropped | Why |
|---|---|
| `--cwd` | The dashboard already registers a project by absolute path — `AddProjectPanel` has a `/absolute/path/to/repo` input behind `sendAddProject`. The flag duplicates a panel that exists. |
| `--daemon` / `--daemon-serve` | The CLI always runs in the foreground (below). There is no background mode to select. |
| `--fake` | Never typed by a human. `e2e/fake-agent-bin.ts` *appends it to its own child's argv* (`runCli([...args, '--fake'])`). It is an internal test seam — an env var or a separate internal bin. |
| `stop` | Ctrl-C is stop. |
| `doctor` | Already a dashboard read: `AgentReady` in `dashboard/types.ts`, plus the onboarding checklist deriving the same facts, plus the preflight that runs before every session anyway. Three implementations of one question; the CLI verb is the one nobody sees. |

**Keeping `--host` keeps the authentication story with it.** `daemon.ts:355` is
`isLoopbackHost(host) ? undefined : await ensureDaemonToken(…)` — a non-loopback bind is the sole
reason the daemon token exists, so `ensureDaemonToken`, the `daemonToken` registry key, the 401
gate in front of every route and `loopback-host.ts` all stay live. That is the price of the flag,
and it is a coherent one: a process spawner reachable from the network *is* remote code execution,
so the guard has to be there as long as the bind can be. Worth knowing that this is the single
feature holding ~200 LOC of security machinery upright, so it never reads as unexplained weight.

### D4b. The CLI always runs in the foreground; Ctrl-C closes everything
**TL;DR —** Foreground only. Deletes the global state file, the heartbeat, `ensureDaemon`, detached spawning and suspend/resume.

**Settled decision (`MEMORY.md`). It deletes more than the flag cleanup does.**

The daemon is currently a per-machine background service: it writes `~/.the-framework-daemon.json`,
re-asserts that record on a 5-second heartbeat (self-healing if something deletes it, yielding if
another daemon is live), and `ensureDaemon` either finds the running one or spawns a *detached,
unref'd* child that outlives the invoking shell. A foreground-only process needs none of that:

| Deleted by foreground-only | Where |
|---|---|
| The global daemon state file, `readDaemonState`, `writeDaemonState` | `daemon.ts:42,124-190` |
| The heartbeat and its self-heal / yield-to-a-live-peer logic | `daemon.ts:193-230, 449, 496` |
| `ensureDaemon` — find-or-spawn-detached, plus forwarding `--host` into the child | `daemon.ts:235-305` |
| "One daemon per machine, discovered from any repo" as a concept | `daemon.SPEC.md` |
| The `stop` verb and the stop-the-background-daemon path | `cli.ts` |

**Sessions become ordinary children.** Today they are spawned `detached: true, stdio: 'ignore'`
(`daemon-runtime.ts:155`) explicitly *"so it survives the CLI that asked for it"* — which is the
behaviour this decision reverses. Same process group means Ctrl-C reaches them, and two workarounds
go with it: the stderr-to-a-file dance (`daemon-runtime.ts:145` — *"a detached child must not block
on a dead parent's pipe"*) and the crash-went-nowhere problem it was papering over
(`daemon-runtime.ts:178`). It also shrinks the orphan-reconciliation story in the store, which
exists to heal sessions whose daemon died without them.

**Suspend/resume goes with it (settled).** `store/suspend.ts` records mid-flight sessions at
shutdown so the next boot resumes them, for up to a day. That made sense when shutdown was usually
incidental — a reboot, a crash. Under this decision Ctrl-C is a deliberate *"close everything"*,
and silently restarting the work it stopped contradicts what the user just said. Delete the module,
the `suspended.json` file, `resumableRuns` and the day-long staleness window; a session that should
continue is restarted from the dashboard, where the choice is visible.

**The consequence to be deliberate about: unattended work now needs a terminal left open.** The
product's headline is spending idle quota on the roadmap *"when nobody is at the keyboard"*. That
still works — you leave the window running, exactly as with any dev server — but it is now visible
and killable rather than invisible and persistent. That is arguably the better trade for a tool
that spends your subscription: nothing burns quota after you have closed it.

**The one real loss:** you can no longer start a session by typing `the-framework "fix the login
bug"` in a terminal. That is a genuine cost for a developer tool and should be a decision, not an
accident. It is consistent with the product's own pitch — *"stop babysitting your coding agents"*
describes someone watching a dashboard, not someone in a terminal — and if it is ever missed, one
verb (`the-framework "<prompt>"` → POST to the daemon, open the browser at the new session) brings
it back without reintroducing a single *setting*.

### D5. "run" vs "session" — pick one word
**TL;DR —** Pick one word — run or session — and rename. The cheapest large legibility win in the repo.
The SPECs say **session** throughout ("A session is one agent working one task…"). The code says
**run** throughout: `runId`, `run.json`, `runs/`, `RunStore`, `RunMeta`, `runFramework`,
`daemon-runtime`, `run-handoff`, `resolveRunCheckout`, `--run-id`. The dashboard mixes both
(`RunView.tsx`, `SessionActionsMenu.tsx`, `RunHistory.tsx`). There is even a ticket for it
(`2026-07-25_agents-instead-of-sessions.md` proposes a *third* word).

Pick one and rename. This is the cheapest large legibility win in the repo.

### D6. Four gate/choice mechanisms → one
**TL;DR —** One gate shape, one protocol block, one card. Deletes ~3 of 4 branches across 1,006 LOC.
`await-choices` (pick one), `await-multiselect` (pick any), `await-confirmation`
(approve/decline), plus the framework-emitted plan-approval gate (#304) that predates them, plus
`await-bind-project`/`await-create-project` for topic runs, plus the todo-loop's per-entry gate.
Each has its own protocol block, its own dashboard rendering, and its own resolution path;
`gate-keepalive.ts` exists to keep a parked run alive across all of them.

A single "the agent asks a question with N options; one or many may be picked" covers
choices, multiselect and confirmation (approve/decline is two options). The topic-bind gates are
a question whose options are the registered projects.

**Do:** one gate shape, one protocol block, one card. Deletes ~3 of the 4 branches in
`turn-gate.ts`/`await-gate.ts` (1,006 LOC combined) and the `confirm`/`multi` flags on
`ChoiceRequest`.

### D7. `topic` runs — question whether they earn their weight
**TL;DR —** Delete `topic` runs: a bind protocol, two gate kinds, a `bind` event and a mid-run checkout move, to save one click.
A project-less run starts in a scratch directory, advertises a bind protocol, resolves an
`await-bind-project` gate by registering a project, then **re-homes its checkout into that
project** mid-run. That is: a special system-prompt block, a project list injected as context, two
gate kinds, a `bind` event, a `BindProjectDeps` seam threaded through `run.ts`/`await-gate.ts`,
and a directory move with a conversation to carry along.

The alternative it argues against — *"pick a project first"* — costs the user one click.

---

## E. Autonomy — the loop that spends the quota

### E1. Three spending gates → one
**TL;DR —** One gate on *starting*. Delete `consumption-guard.ts` and `budgetUsd`; never interrupt a running session.
- `quota-boundary.ts` — the pro-rated week boundary, for unattended work (fails **closed**)
- `consumption-guard.ts` — polls quota during a run and pauses it (fails **open**)
- `budgetUsd` / `--max-cost` — a per-run USD cap
- plus `autoSpendOffset` (the slider), which "only ever *loosens*" for user-requested work

Four mechanisms answering "may this keep spending?", with two deliberately opposite failure
modes, and a slider that applies asymmetrically depending on who asked. The SPEC needs a paragraph
to explain that asymmetry, which is the tell.

**Do (settled): one gate that decides whether a session may *start*, and nothing that stops one
already running.** A running session is never interrupted for quota — not paused, not degraded,
not cut short. Interrupting mid-flight is the worst possible moment to economise: the tokens are
already spent, the work is half-done, and what you save is the cheap part while what you lose is
the expensive part. That deletes `consumption-guard.ts` and its fails-open polling outright, which
is also the one mechanism whose failure mode had to be argued for in the SPEC.

The **slider stays** (settled) as the single control over how much of the week's quota autonomous
work may consume, and `quota-boundary.ts` stays as the gate it feeds. What goes with the guard is
the asymmetry: with nothing to interrupt, the slider no longer needs "only ever *loosens* for
user-requested work" semantics — it is just the budget for unattended work, which is the only
thing it was ever really setting.

Delete `budgetUsd` too (a per-run USD cap is a different unit from the quota-week percentage
everything else speaks, and Claude Code subscriptions do not bill in USD).

### E2. Three claim mechanisms → one
**TL;DR —** Keep `.lock.md` and the pinned branch. Delete the queue-entry pin that re-derives claims from PR diffs.
An entry/ticket can be claimed by: (a) a **queue-entry pin** recorded as a run event and
re-derived from live runs + open PRs + *PR diffs on other machines*; (b) a **lock file** committed
and pushed beside the ticket on the default branch; (c) a **pinned branch** (`pinnedBranch` on a
routine job, with `stale-branch.ts` to release one left behind by a closed PR).

Three answers to "is someone already on this?", each with its own staleness story.

**Do (settled): keep (b) and (c), delete (a).** The queue-entry pin is the one that has to
*re-derive* a claim — from live runs, plus open PRs, plus PR diffs fetched from other machines —
which is a guess assembled from three sources at read time. The other two are claims someone
actually wrote down.

**And no, a `.lock.md` cannot do the triage job — the branch is doing something a file cannot.**
Two reasons, both structural:

1. **A `.lock.md` needs a ticket to sit beside.** The mechanism is a *sibling*:
   `tickets/<STEM>.lock.md` holding `CLAIMED: <AGENT_ID>`, and it works precisely because it is
   the file the ticketing format already defines, so stock prompts skip a locked ticket "with no
   cooperation from anyone who has not heard of this module". Triage has no such stem — its job is
   to *create and reshape the ticket set*, so at the moment it starts there is nothing to name the
   lock after. What needs claiming is the routine ("a triage is in flight"), not a row in
   `tickets/`.
2. **Creating a branch ref is atomic; writing a file is not.** `the-framework/triage-quick` either
   exists or it does not, and git's ref creation settles the race for free. Two daemons writing a
   lock file both read "absent", both write, both push — and the loser's push is rejected only if
   the branch tip moved, which is exactly the reconciliation the branch already does natively.

The cost of keeping it is honest and small: `stale-branch.ts` exists because a closed PR leaves the
branch behind and jams the routine forever, so the sweep asks the branch's PR history and releases
it only when *some PR existed and none is open*. That is one sweep, with a correct answer, guarding
a lock that cannot otherwise be released — cheaper than the cross-machine PR-diff derivation being
deleted.

### E3. The routine rotation is a scheduler in disguise — *rejected for now*
**TL;DR —** **Rejected for now.** The rotation, all five routines and every preset stay.

All five routines (`update-tickets`, `triage-quick`, `triage-consensual`, `plan-tickets`,
`maintenance`), the drain job, the rotation cursor, the cooldown, the concurrency cap, the
per-routine off-switches and the six ticket-shaped presets stay exactly as they are.

**Two consequences to carry forward.** The P4 ticket
(`2026-07-31_spike-plan-blocked-by-queue.md`, *"the rotation is unreachable with a standing
backlog"*) must be **fixed** — it was going to dissolve with the rotation, and now it is a live bug
against live code. And `stale-branch.ts` belongs to **E2**, not here: it is what makes the pinned
branch lock releasable, and E2 keeps it.

### E4. Four background sweeps on four timers → one tick
**TL;DR —** One daemon tick running a list of jobs; intervals become "every Nth tick".
`ci-watch` (~1 min), `merged-worktrees` (10 min), `auto-pm` (10 min), `maintenance` (calendar),
`conversation-committer` (debounced), `stale-branch` (inside ci-watch), plus the quota poller and
the daemon heartbeat. Each with its own interval, its own preference re-read, and its own
stand-down reporting.

**Do:** one daemon tick that runs a list of jobs. Intervals become "every Nth tick". One place to
look when "nothing is happening".

Two of those timers are already gone by the time this is reached: `conversation-committer` dies
with `conversations/` (B3), and the daemon heartbeat dies with the background daemon (D4b). So
this proposal is smaller than the list above suggests — but `stale-branch` stays on it, since E2
keeps the lock it releases.

### E5. `merged-worktrees` + `worktrees` + retention policy
**TL;DR —** One rule: only remove what has been pushed to the remote. Replaces every retention rule.
Three interacting rules: a clean finish removes the worktree; a failure/stop keeps it; a merged
branch reclaims it later (via two different "landed" signals because squash-merge hides the local
one); deleting a session keeps the branch but drops the archive. Plus a prune verb, plus a manual
Remove button that shares the implementation.

**Do (settled): one rule — only remove what has been pushed to the git remote.** Every deletion
becomes recoverable, because the remote holds a copy; nothing local is ever the last copy of work.
That replaces all of it: no clean-vs-failed distinction (a failed session's uncommitted diff is
committed and pushed to its branch, then the worktree goes), no two "landed" signals, no retention
policy, no age-based prune. The question stops being *what state did this session end in* and
becomes *is it on the remote yet* — one predicate, checkable at any moment, with a single failure
mode (the push failed, so the worktree stays and you can see why).

It also subsumes the manual Remove button and the prune verb into the same check, and removes the
need for a `--keep` escape hatch: the reason to keep a worktree was fear of losing the diff, and a
pushed branch is not lost.

### E6. `no PR number is ever stored` — store the PR number
**TL;DR —** Store the PR number, instead of a three-way name guess plus a timestamp heuristic plus a 117-LOC cache.
Every surface re-resolves the PR live from the session's branch, "falling back to the session-name
and run-id branches", preferring an open PR and accepting a closed one only if created after the
session started. That is a three-way branch-name guess plus a timestamp heuristic plus a cache
(`dashboard/cache.ts`, 117 LOC of stale-while-revalidate with a "pending, not failed" state) —
all to avoid persisting one integer.

The `branch` event (#1277) was added precisely because "before this event the branch was stamped
only at teardown, so any read before that guessed between three naming schemes." The lesson was
*record the fact*; apply it to the PR too.

---

## F. Dashboard

### F1. Vike is doing nothing — use plain Vite
**TL;DR —** Plain Vite with an `index.html`. Vike's whole net contribution is one prerendered file.
`+config.ts` sets `ssr: false`, `prerender: true`; `+route.ts` returns `true` for every path with a
comment saying its return value "is deliberately not read"; `+onBeforePrerenderStart.ts` exists
only to name `/` so an `index.html` gets emitted at all; the app then routes client-side in
`lib/route.ts` (96 LOC). The daemon serves the built files statically.

Net contribution of Vike + vike-react: one prerendered `index.html`. **Do:** plain Vite with an
`index.html`. Deletes `vike`, `vike-react`, the `pages/`+`layouts/` scaffolding, and the
`+config`/`+route`/`+onBeforePrerenderStart` indirection.

### F2. `the-framework` exports 406 symbols to one consumer
**TL;DR —** Export only what the dashboard imports — 406 symbols down to a handful.
`src/index.ts` is 390 lines exporting ~406 named symbols. Its only consumers are the dashboard
(via `.`, `./client`, `./dashboard-rpc`) and its own CLI. Everything exported is public API that
must stay coherent, be re-exported through the right subpath, and stay browser-safe (there is a
standing rule that `system-prompt.ts` must not import `node:fs` because the dashboard renders it).

**Do:** export what the dashboard imports and nothing else — the type-checker will tell you
exactly what that is. Then the "must stay node-free" constraint applies to a handful of modules
instead of being a repo-wide hazard.

### F3. Telefunc + a capability-probing context → plain HTTP handlers
**TL;DR —** Plain `POST /rpc/<name>` handlers. Cheap only after D3, which collapses the context to nothing.
Telefunc requires a build-time transform, a `telefunc-serve.ts` shim (192 LOC), a `register.ts`, a
`stream-channel.ts`, and `getContext()`-based capability probing in `context.ts` (126 LOC). Under
D3 (one host) the context collapses to nothing, and the RPC layer is ~40 read functions and ~15
commands — which is a `POST /rpc/<name>` handler and a typed client.

Not urgent, but worth reconsidering once D3 lands, because most of Telefunc's value here is
type-safety across a boundary that could just share types directly (the dashboard already imports
`@gemstack/the-framework` types).

### F4. Vendored `animate-ui` (1,225 LOC)
**TL;DR —** Depend on `animate-ui` or delete the animations. 1,225 vendored LOC.
A vendored animation primitive library (641 LOC in one highlight effect) inside the components
directory, alongside vendored shadcn `ui/` (1,562 LOC). The shadcn vendoring is idiomatic;
`animate-ui` is a dependency that was copied in. **Do:** depend on it, or delete the animations.

### F5. Dashboard feature surface vs. the goal — *rejected*
**TL;DR —** **Rejected.** Faceted filtering, sorting and the shareable filter URL all stay.

Faceted filtering (text, priority/effort/uncertainty as buckets *or* ranges, topics, planning
stage, project), sorting, group-by-project, and the filter view mirrored to the URL all stay.

## G. Process and repo hygiene

### G1. SDD: 898 `SPEC.md` files for 818 source files — *rejected*
**TL;DR —** **Rejected.** SDD stays as practised — which taxes every other item here. See the note below.

All 898 `SPEC.md` files stay, including the per-file, per-test and per-config ones
(`vite.config.SPEC.md`, `define.test.SPEC.md`, …).

**This taxes every other item in this document, which is the part to plan for.** At roughly one
spec per source file:

- **Deletions take their specs with them** — `discord/` is six modules plus siblings (A6), and the
  same holds for `relay.ts`, `preview.ts`, `consumption-guard.ts`, `store/suspend.ts`,
  `conversations.ts`, `logs.ts` and the `ai-sdk` package (A1).
- **Behaviour changes rewrite specs.** `daemon.SPEC.md` states *"one daemon per machine, recorded
  in a single global state file"* — D4b makes that false. The root SPEC's *"files are the seam"*
  and *"the dashboard never holds authoritative state"* are already contradicted by shipped
  features (#4, #5); with G1 rejected the fix is to correct the prose, not delete the file.
- **New code needs new specs** — B5's handoff ordinal and notification axes each arrive with one.

So **G3** is not a tidy-up at the end; it is a requirement of every step.

### G2. Delete the whole release history — changesets, changelogs, migration notes
**TL;DR —** Delete the release history: 77 changesets, 4 changelogs (2,861 lines), migration notes, semver → `0.0.0`.
`AGENTS.md`: *"The project isn't released, it has zero users. Thus, breaking changes aren't a
problem, so prefer clean code over breaking changes."* Alongside: 76 changesets, semver'd packages
(`ai-sdk@0.6.1`, `ai-autopilot@0.12.0`, `the-framework@1.4.2`), a `release.yml` workflow, and
migration notes in `ai-sdk/README.md` telling users how to update imports for a 0.3.0 move.

**Do (settled): remove all of it**, not just the pending changesets:

| | Size |
|---|---|
| Pending changesets (`.changeset/*.md`) | 77 files |
| Changesets tooling — `.changeset/config.json`, the `@changesets/cli` dev dependency, `release.yml` | — |
| `CHANGELOG.md` ×4 (`the-framework` 1,731 · `framework-dashboard` 537 · `ai-autopilot` 433 · `ai-sdk` 160) | 2,861 lines |
| Migration notes — `ai-sdk/README.md`'s *"Moved in `0.3.0`: … update `@gemstack/ai-sdk/mcp` imports"* | — |
| Semver versions (`1.4.2`, `0.12.0`, `0.6.1`, `0.4.1`) → `0.0.0` | — |

Two of the four changelogs leave anyway: A1 deletes `ai-sdk` with its 160 lines and its migration
note, A2 absorbs `ai-autopilot` with its 433.

**One thing to do first, and this review is the evidence for it.** The changelog is currently the
*only* written explanation of some live behaviour. C1's prompt-stance decision in this document is
sourced from `CHANGELOG.md:1339` — that `tf.params.autopilot` *"relaxes the maintenance stance on
autopilot runs"* is recorded there and nowhere else. Deleting the file without moving that first
turns a documented decision into unexplained code.

This is the same defect **G4** describes from the other side: explanations living in issue numbers
rather than in the source. So do the two together — sweep the changelogs for anything that explains
*why* live code behaves as it does, move it into the code or its `SPEC.md` (which, with **G1**
rejected, is staying and is the natural home), and only then delete. Everything else in those 2,861
lines is a record of how the code got here, which git already holds.

### G3. Stale docs contradicting the code
**TL;DR —** Fix the docs that describe a different product. With G1 rejected, this runs through every step rather than last.
- `packages/framework-dashboard/README.md`: *"De-risking prototype… side-by-side with the current
  `page.ts` MVP page (which is untouched)"* — it is the production dashboard; `page.ts` is gone.
- `packages/the-framework/README.md`: *"Status: MVP (#166)"*, and the entire document describes the
  from-scratch build CLI (`the-framework "a blog with comments"`), not the daemon + dashboard
  product the root SPEC describes. It documents ~40 flags including all of A4's.
- `packages/ai-sdk/README.md`: points at `@gemstack/ai-mcp` (package deleted in #1522) and
  describes a `@rudderjs/ai` relationship that no longer constrains anything here.
- Root `package.json` description: *"GemStack: a collection of high-quality, framework-agnostic
  tools. Home of @gemstack/ai-sdk."* — the repo is `the-framework`, a product.

**Do:** these resolve themselves under A1/A4. Until then they are actively misleading: every one
of them describes a *different product* than `SPEC.md` does.

### G4. Issue-number citations as the primary explanation
**TL;DR —** Keep issue numbers as a suffix, never as the explanation.
Nearly every doc comment cites issue numbers (`#326`, `#1372`, `#1467`, …) — often *only* issue
numbers, as in "the #1372 rule" or "Rom's call on #519". The repo has 50 commits; the issues live
elsewhere and some (like #326) are load-bearing artifacts (C2).

The comments that explain *what and why* in prose are excellent. The ones that delegate the why to
a number are a dangling pointer. **Do:** keep the number as a suffix, never as the explanation.

### G5. Test volume
**TL;DR —** No separate action — ~20k test LOC leave with the features above. Trim what remains last.
26,387 test LOC against ~31,441 source LOC in `the-framework`; 14,379 against 16,453 in `ai-sdk`.
Under A1/A4/A5/A6 roughly 20k of those tests are deleted along with what they test — which is the
point: **the fastest way to reduce test burden is to delete features, not tests.** No action item
beyond noting that the test suite is a lagging indicator of the surface area above, and should
shrink proportionally.

---

## H. Contradictions ledger

Every contradiction found, with the resolution that favours subtraction.

| # | Contradiction | Resolution |
|---|---|---|
| 1 | Root SPEC: *"The Framework never runs its own model calls"* — yet the stack's bottom two layers are a 15-provider AI SDK and an agent-orchestration engine | Delete `ai-sdk`, absorb the used slice of `ai-autopilot` (**A1, A2**) |
| 2 | `ai-autopilot` SPEC: *"don't trust a single pass… only an empty list counts as done"* — vs #1372: without a preset *nothing* reviews the build, and no preset is the default | The default won. Delete the loop/verdict/preset engine (**A5**) |
| 3 | `the-framework` README: *"takes you from an idea to a running app"* + deploy targets + serve gates — vs root SPEC: *"takes an idea, a ticket, or a queue entry to a reviewed pull request"* | Two products. Keep the second; delete the first (**A4**) |
| 4 | Root SPEC: *"Files are the seam… There is no direct process-to-process channel"* — vs relay HTTP, daemon→daemon HTTP, bridge HTTP, CDP proxy, Discord WebSocket | **The SPEC sentence is the wrong one.** Remote execution is core, so process-to-process channels are load-bearing: scope the claim to *"files are the seam within a machine"* (**G3**) |
| 5 | Root SPEC: *"The dashboard never holds authoritative state"* — vs *"The one exception is saved remote devices: their access tokens stay in this browser only"* | **Keep the exception, state it as a rule.** Remote devices stay, so an absolute that needs a carve-out in its own next sentence should not be written as an absolute (**G3**) |
| 6 | Driver SPEC: *"the seam is the code and the outcome, never the agent's individual tool calls"* — vs branching control flow on fenced blocks the agent emits, and draining its backlog one entry per turn | Honest framing: the seam is the agent's *final message*, which is a contract, not black-box treatment. Shrink the contract to one gate shape (**D6**) |
| 7 | *"Spend the whole week's quota, never starve the user"* — vs eco mode trimming prompt sections to save tokens, and a per-run USD cap | Delete eco (**C1**) and `budgetUsd` (**E1**) |
| 8 | Two off-switches for the built-in prompt (`--vanilla` / `--transparent`) with subtly different semantics | One switch (**C1**) |
| 9 | Config key `antiLazyPill` vs flag `--vanilla` vs concept "built-in prompt"; three comments apologise for the mismatch | Rename or delete (**C3**) |
| 10 | `eco.autoMaintenance` documented as *"Nothing to drop here"* — the flag acts on a different prompt | Delete (**C1**) |
| 11 | SPECs say **session**; code says **run**; a ticket proposes **agent** | Pick one, rename (**D5**) |
| 12 | *"One daemon per machine"* — vs a second, foreground, per-run dashboard host, plus a third relay host | One host (**D3**) |
| 13 | `Driver` models "which agent", but `cloud`/`actions` are the same agent elsewhere — forcing `handsOff` to disable half the run | Separate the axes, or delete the remote drivers (**D1**, **A6**) |
| 14 | Five representations of "work to do", with a promotion mechanism whose own SPEC says the state is *ambiguous* and needs a fork point | **Unresolved.** B1 (one ticket file with status + assignee) is rejected, so the ambiguity stays; `queue-promote.ts`'s fork-point diffing remains the way it is disambiguated |
| 15 | Three claim mechanisms (queue pin / lock file / pinned branch) for one question | One (**E2**) |
| 16 | Four committed records of one session (LOGS.md, conversation, archive, event log) — and the top-priority ticket is about the Discord mirror reading the wrong one | Event log is the record; one committed projection (**B3**) |
| 17 | `ANALYSIS_RESULT.md` written by every run, read by nothing; a backlog ticket exists to start reading it | Delete (**B2**) |
| 18 | Two spending gates that *"fail in opposite directions on purpose"*, plus a slider that applies asymmetrically | One gate, one policy (**E1**) |
| 19 | *"No PR number is ever stored"* — costing a three-way branch-name guess, a timestamp heuristic and a stale-while-revalidate cache | Store the PR number (**E6**) |
| 20 | System prompt's source of truth is GitHub issue #326; a daily CI job detects the repo drifting from it; one block can only be approximately synced; the drift-checker's own path filter is already stale | Repo is the source of truth (**C2**) |
| 21 | `AGENTS.md`: *"zero users, breaking changes aren't a problem"* — vs 76 changesets, semver, publish workflow, and 0.3.0 migration guidance | Drop the release machinery, or move `ai-sdk` out (**G2**) |
| 22 | Root `package.json`: *"GemStack: a collection of framework-agnostic tools. Home of @gemstack/ai-sdk"* — vs a repo named `the-framework` shipping a product | One identity (**G3**) |
| 23 | `framework-dashboard` README calls itself a prototype running beside a `page.ts` MVP that no longer exists | Rewrite or delete (**G3**) |
| 24 | SDD applied to test files and Vite configs — specs describing implementation | **Accepted, not resolved.** G1 is rejected: SDD stays as practised, specs for tests and configs included |
| 25 | `framework-detection` scores dependencies to pick a preset, and `run.ts` notes *"nothing about it reaches the agent's prompt"* — a detector whose only output is a log line | Delete (**A5**) |
| 26 | `Bootstrap`'s `scope` phase — *"the one and only interrogation"* — is a constant function in the product | Delete the spine (**A3**) |

---

## Suggested order of work

1. **A1** delete `ai-sdk` → **A2** absorb `ai-autopilot`. Biggest subtraction, zero product risk
   (nothing imports what is removed).
2. **A4** delete deploy/serve/sandbox/runner → **A3** delete `Bootstrap` → **A5** delete presets
   and loops. These three unlock each other; after them `run.ts` is a prompt loop.
3. **D2** merge the two run paths, **D1** split the `Driver` axes, **A6** cut the relay, the
   preview server and Discord's inbound half, **D3** one dashboard host. The conditional
   complexity in `dashboard-rpc`, `telefunc-serve` and `system-prompt` collapses — A6's
   seam-by-seam check shows the relay was paying for all of it.
4. **D4b** foreground-only → **D4** strip the CLI to its four options → then **B5** one config
   file, two tiers. In that order: foreground-only deletes the daemon's discovery, heartbeat and
   detached-spawn machinery, which is what most of the remaining flags and verbs exist to steer;
   doing D4 after steps 2–3 (which delete ~23 flags outright) makes it deletion rather than
   migration; and removing the flag tier is what lets `config-layers.ts` go entirely. B5 also
   carries the two preference *shapes* — the handoff ladder becoming one ordinal, and the
   notification matrix getting named axes.
5. **B3** one record (delete `conversations/` and `LOGS.md`), **E2** one claim (delete the
   queue-entry pin), **B2** delete `ANALYSIS_RESULT.md`. All three are contained now that B1 is
   rejected — the five work-item files stay, so none of them touches the ticket format itself.
6. **E1** one spending gate (delete `consumption-guard.ts`), **E5** the pushed-to-remote rule for
   worktrees, **E4** one daemon tick, **E6** store the PR number. The autonomy loop, in dependency
   order: E4 is smaller once D4b has deleted the heartbeat and B3 the conversation committer.
7. **C1**/**C2**/**C3**/**C4** prompt modes, the source of truth, `antiLazyPill`, and the
   `${{ }}` templating. Cheap and independent — do any time after A5 removes the presets C1's
   `--technical` selects.
8. **D6** one gate mechanism, **D7** `topic` runs. D6 wants C1 done first: with autopilot gone,
   auto-accept is no longer a mode competing with the gate shapes being consolidated.
9. **F1** Vike → plain Vite, **F3** Telefunc → plain HTTP handlers, **F2** trim the 406 exports,
   **F4** the vendored `animate-ui`. F3 is much cheaper after step 3, because one host means there
   is no capability-probing context left to port.
10. **D5** rename run→session, **G2** delete the release history, **G4** the issue-number
    citations — G2 and G4 together, since both are about explanations that live outside the code.
    Mechanical; last, so they rename and rewrite as little as possible. **G3** is the exception —
    with G1 rejected, keeping the specs true is not a step at the end but a requirement of every
    step above, since each deletion takes its `SPEC.md` files with it and each behaviour change
    rewrites them.
11. **G5** test volume — **last, and deliberately so.** The tests are the safety net for
    everything above; cutting them earlier would remove the evidence that steps 1–10 landed
    correctly. Trim once the shape is final.

**Rough scale:** A1–A6 alone remove on the order of **43,000–53,000 LOC of ~132,000** — about a
third of the repo — without touching anything the stated business goal needs. (A6 now contributes
~2,800 rather than the ~4,500 it was originally scoped at, since remote execution stays.)
