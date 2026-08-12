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
`~/.the-framework` registry (35 preference keys + secrets).

---

## Part 2 — Every user-facing feature, and its verdict

The full product as a user meets it, with a **Keep / Simplify / Remove** call on each and a
pointer to the proposal in Part 3. Nothing is omitted: features I propose deleting are listed
beside the ones that survive, so the cost of each proposal is visible in user terms rather than in
lines of code.

**Tally: 165 user-facing features — 94 Keep, 22 Simplify, 49 Remove.**

The product a user actually came for — *register a repo, describe work, watch an agent do it,
get a PR, and let it keep working while you sleep* — is entirely inside the Keep column.

### Setup

| # | Feature | Verdict | Ref |
|---|---|---|---|
| 1 | Install globally or run via `npx` | Keep | |
| 2 | `the-framework` spins up the dashboard and finds/starts the daemon | Keep | |
| 3 | Activate a repo (commits dirty state, creates `.the-framework/`, teaches `.gitignore`, registers it) | Keep | |
| 4 | Auto-register every repo under a configured "repos directory" | Keep | |
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
| 14 | Start a session from a queue entry's play button | Simplify — merges into #13 | B1 |
| 15 | "Run now" on a routine | Keep | |
| 16 | CLI `the-framework` — start/find the daemon and open the dashboard | Keep | |
| 17 | CLI `the-framework stop` | Keep | |
| 18 | CLI `the-framework doctor` | Keep | |
| 19 | CLI `the-framework --fake` — deterministic offline demo | Keep — it is what CI runs | |
| 20 | CLI bootstrap arguments: `--port`, `--host`, `--daemon`, `--cwd` | Keep — the dashboard cannot configure itself into existence | D4 |
| 21 | **Every other CLI setting — 60 of the 67 flags**, each mirroring a dashboard control or encoding what the daemon passes its own child | **Remove** — the dashboard is the only interface | D4 |
| 22 | CLI `the-framework [intent...]` — build an app from scratch | **Remove** | A4 |
| 23 | CLI `the-framework prompt <text>` — one verbatim prompt | **Remove** as a verb — the *path* survives as the only run path | D2, D4 |
| 24 | CLI `the-framework research [what]` | **Remove** as a verb — it is a preset in the composer | D4 |
| 25 | CLI `the-framework maintain` — sweep repos for un-reviewed commits | **Remove** as a verb — folds into the daemon tick | E3, E4 |
| 26 | CLI `the-framework worktrees [rm\|prune\|sweep]` | **Remove** as a verb — it is the session actions menu | D4, E5 |
| 27 | CLI `the-framework relay` — host a watch relay | **Remove** | A6 |
| 28 | CLI `--resume` — reopen the last session's dashboard read-only | **Remove** — it is a URL in the dashboard | D3 |
| 29 | Start a session by typing a prompt in a terminal | **Remove** — the one real loss; see D4 | D4 |
| 30 | Topic sessions: start with no project, bind to one mid-run | **Remove** — costs the user one click up front | D7 |
| 31 | Custom presets saved to the user tier (private) or project tier (shared) | Simplify — one tier | B5 |

### The preset catalog (16 user-visible entries)

| # | Feature | Verdict | Ref |
|---|---|---|---|
| 32 | Research (rate problem variability, then pick what to deep-dive) | Keep | |
| 33 | Maintainability | Keep | |
| 34 | Readability | Keep | |
| 35 | Security audit | Keep | |
| 36 | UX (auto) | Keep | |
| 37 | Maintenance (periodic codebase sweep) | Keep | |
| 38 | Market research | Keep | |
| 39 | Import tickets from GitHub | Keep | |
| 40 | Update from GitHub | Simplify — one of six ticket-shaped presets | E3 |
| 41 | Plan tickets (aka spike) | Keep | |
| 42 | Suggest new tickets | Simplify — collapse with #40, #43, #44 | E3 |
| 43 | Suggest new features | Simplify — collapse | E3 |
| 44 | Suggest tickets to work on | Simplify — collapse | E3 |
| 45 | Spin up agents working on the AI queue | Keep | |
| 46 | Add quick-win work to AI Queue (triage-quick) | Simplify — one triage preset, not two | E3 |
| 47 | Add consensual work to AI Queue (triage-consensual) | Simplify — collapse with #46 | E3 |

### Watching and steering a session

| # | Feature | Verdict | Ref |
|---|---|---|---|
| 48 | Live event stream rendered as a transcript | Keep | |
| 49 | The agent's questions render as answerable cards inline, where they happened | Keep | |
| 50 | A large scope becomes a `PLAN_<session>.agent.md` with a live Approve/Decline gate; declining stops the session and hands control back | Keep — as a section of the ticket | B1 |
| 51 | An ambiguous prompt becomes a ranked list of interpretations to pick from | Keep | |
| 52 | A settled session reads as "waiting for you", not as a status that only changes when it ends | Keep | |
| 53 | `ANALYSIS_RESULT.md` written into the repo every run (scope, ambiguity, plan yes/no) | **Remove** — nothing reads it | B2 |
| 54 | Three gate shapes: pick-one, pick-many, approve/decline | Simplify — one shape covers all three | D6 |
| 55 | Chat with a live session; each message continues the same agent conversation | Keep | |
| 56 | Stop button (aborts the same signal Ctrl+C does) | Keep | |
| 57 | Resume a stopped session with reduced options | Keep | |
| 58 | Reopen a finished session — history restored, same conversation | Keep | |
| 59 | Changed files with diffs | Keep | |
| 60 | Git status bar | Keep | |
| 61 | Agent-authored markdown views pushed to the right rail | Keep | |
| 62 | Docs rail (surfaced PLAN / TODO files) | Simplify — one work-item format to surface | B1 |
| 63 | History rail (past sessions), with full-prompt tooltips | Keep | |
| 64 | Session actions: stop, open in editor, open folder, open on GitHub, remove worktree, delete session, copy session id, copy resume command | Keep | |
| 65 | Session action: Serve / preview the app | **Remove** | A6 |
| 66 | Session action: copy a shareable watch link | **Remove** | A6 |
| 67 | Session action: Merge when finished (arm auto-merge mid-session) | Keep | |
| 68 | Live browser screencast inline, degrading to a last still | **Remove** | A6 |
| 69 | Hand the browser to the human on a login wall / captcha / 2FA | **Remove** | A6 |
| 70 | A session is a URL you can paste, reload and bookmark | Keep | |
| 71 | The agent names the session; the branch is renamed to match | Keep | |
| 72 | Ready-for-merge status flips the session badge | Keep | |
| 73 | Live spend readout per session | Keep | |
| 74 | See the exact system prompt the agent ran under | Keep | |

### Overview page

| # | Feature | Verdict | Ref |
|---|---|---|---|
| 75 | Quota bar first — week track with pace and projection | Keep | |
| 76 | Open-questions hub: every session's unanswered question, across all projects, answerable in place | Keep | |
| 77 | Agents working now | Keep | |
| 78 | The full AI queue of every project, uncollapsed | Keep — as the ticket list | B1 |
| 79 | Routine work panel | Keep | |
| 80 | Hottest tickets | Keep | |
| 81 | Projects sidebar | Keep | |

### Tickets

| # | Feature | Verdict | Ref |
|---|---|---|---|
| 82 | Cross-project ticket list | Keep | |
| 83 | Faceted filtering: text, priority/effort/uncertainty as buckets *or* ranges, topics, planning stage, project | Simplify — text search + priority sort | F5 |
| 84 | Sorting and group-by-project toggle | Simplify | F5 |
| 85 | The whole filter view mirrored to the URL so it can be shared | Simplify | F5 |
| 86 | Ticket detail page | Keep | |
| 87 | A plan page when a plan exists; a button to start a session writing one when it doesn't | Keep — as a section of the ticket | B1 |
| 88 | Queue a ticket into the AI queue | Keep — becomes a status change | B1 |
| 89 | Tickets carry a GitHub issue link, so merging closes the issue | Keep | |

### Handoff and what lands in git

| # | Feature | Verdict | Ref |
|---|---|---|---|
| 90 | Every session gets its own git worktree and branch; your checkout is never touched | Keep | |
| 91 | Dependency directories shared from the parent checkout instead of reinstalled | Keep | |
| 92 | A failed or stopped session keeps its checkout for inspection | Keep | |
| 93 | Commit what the agent left uncommitted | Keep | |
| 94 | Push the branch (on by default) | Keep | |
| 95 | Open a PR (on by default) | Keep | |
| 96 | Auto-merge — armed by config, authorized by the agent's ready signal | Keep | |
| 97 | Empty sessions publish nothing | Keep | |
| 98 | Handoff panel: push / open PR / merge, as buttons | Keep | |
| 99 | A withheld merge is reported with its reason | Keep | |
| 100 | Conversations committed to the repo (readable chat, not the tool-call transcript) | Keep | |
| 101 | `LOGS.md` — a committed human-readable project log, one entry per session | **Remove** — derivable from the event log | B3 |
| 102 | Session history archived in the repo under per-user directories | Keep — merged with #100 | B3 |
| 103 | Post-merge quality follow-ups queued (maintainability / security / readability) | Keep | |
| 104 | Knowledge folded back into `DECISIONS.md` / `FACTS.md` / `INSIGHTS.md` at merge | Simplify — one knowledge directory | B4 |

### Autonomy — what happens when nobody is at the keyboard

| # | Feature | Verdict | Ref |
|---|---|---|---|
| 105 | Auto PM: drain the confirmed queue, refill it when empty | Keep | |
| 106 | Five routines (update-tickets, triage-quick, triage-consensual, plan-tickets, maintenance) | Simplify — two jobs | E3 |
| 107 | Each routine individually switchable off | **Remove** | E3 |
| 108 | Every stand-down reported with its reason ("it is a setting, not a bug") | Keep | |
| 109 | Concurrency cap: how many unattended agents per project | Keep | |
| 110 | Fan-out planning: several agents, one ticket each | Keep | |
| 111 | Cross-machine ticket claims so two agents never double-work | Simplify — one claim mechanism | E2 |
| 112 | CI watch: merge a PR once its checks pass | Keep | |
| 113 | CI watch: one fix session per red head commit, max two attempts | Keep | |
| 114 | Reclaim the checkout of a session whose branch has landed | Simplify | E5 |
| 115 | Release a pinned routine branch left behind by a closed PR | **Remove** — goes with pinned branches | E3 |
| 116 | The session drains its own TODO backlog, one entry per turn | **Remove** — merges into the ticket model | B1 |

### Spending

| # | Feature | Verdict | Ref |
|---|---|---|---|
| 117 | Usage panel: quota consumed, pace, projection | Keep | |
| 118 | Unattended work stands down past the pro-rated share of the week | Keep | |
| 119 | Work you asked for is never starved | Keep | |
| 120 | Spend-offset slider | **Remove** — its asymmetric semantics are the complexity | E1 |
| 121 | Per-session USD cost cap (`--max-cost`) | **Remove** — wrong unit for a subscription | E1 |
| 122 | In-run consumption guard that pauses a session mid-flight | Simplify — merge into #118 | E1 |
| 123 | Eco mode: trim prompt sections to save tokens | **Remove** — contradicts "spend the whole week" | C1 |

### Configuration

| # | Feature | Verdict | Ref |
|---|---|---|---|
| 124 | `the-framework.yml` — per-repo defaults that travel with the code | Keep | |
| 125 | `SYSTEM.md` — your own instructions on top of the built-in prompt | Keep | |
| 126 | Global user preferences | Simplify — 35 keys is too many | B5 |
| 127 | Per-project preference overrides (a third tier) | **Remove** — the repo file already does this | B5 |
| 128 | The run narrates which layer decided each setting | **Remove** — goes with the tier | B5 |
| 129 | Theme (system / light / dark) | Keep | |
| 130 | Preferred editor | Keep | |
| 131 | Model picker | Keep | |
| 132 | Agent picker (Claude Code / Codex) | Keep | |
| 133 | Claude Code permission mode passthrough | Keep | |
| 134 | `--context <dir>` — narrow the agent's focus | Keep | |
| 135 | Vanilla mode (drop the built-in prompt, keep the emit protocols) | **Remove** — one off-switch is enough | C1 |
| 136 | Transparent mode (raw `claude -p`, nothing framework-authored) | Keep — as the *only* off-switch | C1 |
| 137 | Autopilot mode | Simplify — it is an auto-accept timeout, not a mode | C1 |
| 138 | Technical mode | **Remove** — only selects preset variants | C1, A5 |

### Remote execution and sharing

| # | Feature | Verdict | Ref |
|---|---|---|---|
| 139 | Bind the daemon to the network behind a generated shared token | Keep | |
| 140 | Relay: publish a session so teammates watch it live, read-only | **Remove** | A6 |
| 141 | Watch mode (the same app rendering one session read-only) | **Remove** — goes with the relay | A6 |
| 142 | Saved remote devices: run a session on another machine's daemon | **Remove** | A6 |
| 143 | Run on a GitHub Actions runner (`--run-on actions`) | **Remove** | A6, D1 |
| 144 | Run on a Claude Code cloud session (`--run-on web`) | **Remove** | A6, D1 |
| 145 | Chrome extension bridging claude.ai questions back to the dashboard | **Remove** | A6 |
| 146 | Answer a cloud session's question from the dashboard (typed back into claude.ai) | **Remove** — goes with #145 | A6 |
| 147 | Browser-bridge token setting | **Remove** — goes with #145 | A6 |

### Notifications and chat

| # | Feature | Verdict | Ref |
|---|---|---|---|
| 148 | Browser notifications | Keep | |
| 149 | Discord notifications: sessions started and finished | Keep | |
| 150 | Discord notifications: what needs a human (open PR, parked question, unpushed commits) | Keep | |
| 151 | Discord chatbot: answer a parked question, steer a live session, start one | **Remove** | A6 |
| 152 | Discord reply mirror: the session's answers posted back to the channel | **Remove** — goes with #151 | A6 |

### The from-scratch build product

| # | Feature | Verdict | Ref |
|---|---|---|---|
| 153 | Point at an empty directory and the agent scaffolds a whole app | **Remove** | A4 |
| 154 | `--scope prototype\|full` | **Remove** | A4 |
| 155 | `--serve` — gate the loop on the app actually booting and answering | **Remove** | A4 |
| 156 | `--sandbox docker` — run the serve check in a throwaway container | **Remove** | A4 |
| 157 | A live preview link to the built app on the dashboard | **Remove** | A4 |
| 158 | One-click "show me the app" preview, no agent involved | **Remove** | A6 |
| 159 | `--deploy cloudflare\|dokploy` | **Remove** | A4 |
| 160 | Five domain presets (software / web / data-science / product / biological-science) | **Remove** — off by default already | A5 |
| 161 | `--kind bug-fix\|major-change` selecting which review chain gates the build | **Remove** | A5 |
| 162 | Framework detection ("Detected Vike, confidence 0.8") | **Remove** — the output is a log line | A5 |
| 163 | `--max-passes` review-loop budget | **Remove** — the loop is off by default | A3, A5 |
| 164 | Read-only mode checkboxes showing the review policy in effect | **Remove** — goes with #160 | A5 |
| 165 | `--browser` — give the agent a real browser (navigate, console, network, DOM, screenshots) | **Remove** | A6 |

### What a user loses, stated plainly

Worth being honest about, rather than hiding behind the LOC counts:

- **Building an app from nothing.** After A4 the product only works on repos that exist. That is
  what the root SPEC already describes; the from-scratch path is the older product.
- **Running work anywhere but this machine.** No Actions runner, no cloud session, no second
  device. Sessions run on the daemon's own machine.
- **Sharing a live session with a teammate.** No relay, no watch links. A PR is the sharing
  mechanism.
- **Driving the agent's browser.** No screencast, no captcha handoff, no `--browser` tools.
- **Chatting with sessions from Discord.** Notifications stay; two-way chat goes.
- **Deploying.** Never really shipped (`cloudflare` and `dokploy` adapters, plan-only for
  everything else).
- **Doing anything from a terminal except opening the dashboard.** No `the-framework "fix the
  login bug"`, no `research` / `prompt` / `maintain` / `worktrees` verbs, and no settings flags —
  the CLI keeps four bootstrap arguments and three verbs (D4). This is the one loss that is not a
  channel but a *habit*, and the one most likely to be missed.

Every one of these is a *distribution or execution channel*, not the core loop. None of them is
load-bearing for "make the important decisions, let AI do the rest" — and each is currently paying
rent across the whole codebase in conditional branches, capability probing, and extra hosts.

---

## Part 3 — Suggestions

Ordered by impact. Each item states the subtraction, the argument, and what replaces it.

---

## A. System level — the package stack (largest wins)

### A1. Delete `@gemstack/ai-sdk` entirely — the product does not use it
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

### A6. Cut the surface count from ~10 to 2
**~4,500 src LOC + their tests, and a large share of the conditional complexity everywhere else.**

The product currently ships: localhost dashboard, terminal narration, a hosted **relay**,
**remote devices** (daemon→daemon), **Discord notifications**, **Discord chatbot**, **Discord
reply mirror**, a **Chrome extension** bridging claude.ai, a **CDP browser screencast proxy**, and
an **app preview server**. For a product with zero users.

| Surface | LOC | Argument for removal |
|---|---|---|
| Relay (`relay.ts`, `relay-endpoints.ts`, `relay-dispatch.ts`, `relay-run.ts`, `dashboard-rpc` relay branches) | ~510 | Unauthenticated read-only sharing, "a keystone for shared sessions, not the final product". It is the *third* host the RPC layer must degrade for. |
| Remote devices (`remote-run.ts` + forwarding allowlist in `dashboard-rpc`) | ~350 | Daemon-to-daemon session forwarding with a browser-held token. This is the one documented exception to "the dashboard holds no authoritative state" — it exists to break its own rule. |
| Chrome extension + cloud driver + bridge endpoints/store/sessions | ~1,900 | An entire browser extension, a cross-origin daemon route, a token, an answer queue, and a DOM scraper — to recover questions from a fire-and-forget target that, by its own design, "opens its own PR" and needs nothing read back. |
| Browser + screencast + proxy (`browser.ts`, `browser-stream.ts`, `browser-proxy.ts`) | ~680 | Launching Chrome with a shared CDP port and proxying frames so a human can solve a captcha. Real feature, enormous surface, orthogonal to the goal. |
| Preview (`preview.ts`, `preview-runtime.ts`) | ~470 | "One click boots the project's app to show it." A link to `npm run dev` in the README does this. |
| Discord ×3 (bot, reply mirror, notification watchers, credentials, webhook) | ~1,160 | Three subsystems with two independent transports (bot token *and* webhook) so each works without the other. Notifications are the only part with a clear job. |

**Do:** keep the localhost dashboard and (at most) Discord *notifications*. Everything else is a
distribution channel for a product that has not yet proven its core loop.

The compounding win is larger than the LOC: the relay and remote-device hosts are why
`dashboard-rpc/context.ts` exists (capability probing, graceful degradation per RPC), why
`telefunc-serve.ts` carries a `DashboardContext` with six optional seams, and why every read has
a "degrades where a capability is absent" branch.

---

## B. Data model — one concept, many files

### B1. Five representations of "work to do" → one
Today:

| File | Meaning |
|---|---|
| `tickets/<date>_<slug>.md` | a proposal a human may accept |
| `tickets/<slug>.plan.md` | that ticket's plan |
| `tickets/<slug>.lock` | who is working it (committed + pushed to the default branch) |
| `TODO_AGENTS.md` | confirmed queue, priority-sectioned, promoted between branches |
| `TODO_<SESSION>.agent.md` | the session's own backlog, drained one entry per turn |
| `PLAN_<SESSION>.agent.md` | the session's plan, gated for approval |

Six file formats, three parsers, one promotion mechanism (`queue-promote.ts`, 268 LOC, with
fork-point diffing to distinguish "the run added this" from "a human removed this"), one lock
mechanism (`ticket-locks.ts`, 187 LOC), and one claim-derivation that reads *PR diffs* to see if
an entry is claimed elsewhere.

**A ticket file with a `Status:` and an `Assignee:` header is the whole model.** "Queued" is a
status. "Claimed" is an assignee. "Plan" is a section. The queue's *order* is the priority header
that already exists on every ticket.

That single change deletes: `TODO_AGENTS.md` and its format spec, `queue-promote.ts` and the
whole branch-promotion problem (tickets live on the default branch already, which is exactly why
locks had to go there), `ticket-locks.ts` as a separate mechanism, `todo_format.md`, the queue
parser, `findTodoBacklog`/`nextQueuedTicket`/`ticketFromQueueEntry`, the `queue-entry` event, and
the `session-todo-open` merge-withhold reason.

> The strongest evidence this is one concept wearing five hats: `queue-promote.ts`'s SPEC has to
> explain that "on the run's branch but absent in the checkout" is *ambiguous* and needs a fork
> point to disambiguate. That ambiguity is manufactured by putting mutable shared state in a file
> that per-session branches also edit.

### B2. `ANALYSIS_RESULT.md` is write-only — delete it
The system prompt instructs the agent to create it and add three entries (ambiguous yes/no,
scope size, …). Nothing reads it. There is a P2 ticket to *start* reading it
(`2026-07-25_show-prompt-analysis.md`). An artifact that has existed long enough to earn a
backlog item for being read is an artifact to delete, not to wire up.

### B3. Four records of "what happened" → one
`LOGS.md` (one entry per run, committed), `.the-framework/conversations/<runId>.md` (the readable
chat, committed), `.the-framework/<user>/sessions/*` (archived session history, committed),
`.the-framework/{events.jsonl,run.json,runs/*}` (the live/archived event log, gitignored) — plus
the branch and the PR, which are also records.

`LOGS.md` is derivable from the archive. The archive is the event log. The conversation is a
projection of the event log (`driver` text events + human turns) — which is precisely what
ticket `2026-07-28_discord-mirror-read-events.md` (P5, top of the queue) is about: the Discord
mirror currently *polls and diffs the conversation markdown* instead of reading the event log,
because the two exist in parallel.

**Do:** the event log is the record. Commit **one** rendered projection of it per session (call it
the conversation) at teardown. Delete `LOGS.md` (`logs.ts`, 267 LOC + its escaping rules against
prompt-forged entries), and fold the per-user archive directory into it.

### B4. Knowledge-base sprawl → one file
`GOAL.md`, `BUSINESS_LOGIC.md`, `knowledge-base/DECISIONS.md`, `FACTS.md`, `INSIGHTS.md`,
`MARKET_RESEARCH.md`, `knowledge-base/**.md` (catch-all), plus repo-root `MEMORY.md` (a *different*
external convention), plus `AGENTS.md`, plus `SYSTEM.md`, plus 898 `SPEC.md` files.

The agent is asked to sort each learning into the right one of these. The distinction between a
"fact", an "insight" and a "decision" is not one an agent will apply consistently, and no consumer
branches on it — `BUSINESS_KNOWLEDGE_DOCS` is just a list read at start and written at merge.

**Do:** one `knowledge-base/` directory, free-form, listed as one context bullet. Delete
`GOAL.md`/`BUSINESS_LOGIC.md` as separate concepts (they are knowledge). Reconcile `MEMORY.md`
with it — right now the repo carries two competing "what agents should remember" conventions from
two different external specs.

### B5. Two config files + four preference tiers → one file, two tiers
`the-framework.yml` (repo), `~/.the-framework` registry (user globals + per-project overrides +
secrets + token), plus per-run flags. `config-layers.ts` exists solely to resolve
run > project > repo-file > user with "the nearest tier that *set* something wins", and each
settled key remembers its provenance so the run can narrate it. `run-options.ts` exists to map
preferences into run options. `preferences.ts` in the dashboard (436 LOC) mirrors the tiers again.

For a single-user local tool, **repo file + user file** is enough; per-project overrides in the
user file duplicate what the repo file already does, and the repo file is the one that should win
for repo-shaped settings. Dropping one tier deletes the provenance tracking and the narration
that goes with it.

Also: 35 preference keys is too many for a product with no users. At least these are removable
outright under A5/A6/C1: `technical`, `vanilla`, `transparent`, `eco*` ×4, `browser`, `bridge`,
`target`, `notifyBrowser`.

---

## C. Prompting — the mode matrix and the source of truth

### C1. Five prompt "modes" → one switch
Today, orthogonally combinable: `antiLazyPill` (aka `--vanilla`), `--transparent`, `eco`
(`autoPlanning`, `autoResearch`, `autoMaintenance`), `--autopilot`, `--technical`. That is a
2×2×2×2×2×2 space of system channels, of which the tests can only pin a few.

Specific findings:
- **`--vanilla` and `--transparent` are two off-switches for the same thing.** Vanilla drops the
  built-in prompt and context docs but keeps the emit protocols; transparent drops everything.
  One boolean with the transparent semantics is enough — "vanilla" leaves the agent able to signal
  gates that no longer have prompt content telling it to.
- **`eco.autoMaintenance` acts on a different prompt than the one it lives in.** Its own doc says
  *"Nothing to drop here"* — the section moved out in #556 and the flag now reaches into
  `on-before-mergeable-prompt.ts`. A flag in the wrong home is a flag to delete.
- **Eco contradicts the spending policy.** Eco exists to save tokens; the product's headline
  spending rule is *"Spend the whole week's quota, never starve the user… nothing is left on the
  floor."* Trimming a ~60-line system prompt to save tokens, in a system that deliberately spends
  its entire weekly allowance on unattended work, is not a real economy.
- **`--technical` only selects preset variants**, and presets go under A5.
- **`autopilot`'s whole remaining effect is the choice-gate countdown** — its own doc says so
  (#556 moved the maintenance section out, #801). It is not a mode; it is
  `autoAcceptChoicesAfterMs`.

**Do:** keep one `--raw` (no framework prompt, no protocols) for debugging, and one
`autoAcceptGates` boolean. Delete the rest, plus `dropSection`, `ECO_SECTION_HEADINGS`,
`applyEco`, and the tests pinning heading names against the template.

### C2. The system prompt's source of truth is a GitHub issue — invert it
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
The config key is `antiLazyPill`, the flag is `--vanilla`, the concept is "include the built-in
system prompt", and the code comments apologise for this in three separate places ("the name is
the historical config key"). With zero users, breaking changes cost nothing (`AGENTS.md` says so
explicitly). Under C1 it disappears anyway.

### C4. `${{ }}` JS-in-markdown templating → plain string interpolation
`prompt-template.ts` evaluates JS fragments inside prompt markdown, against a `TfContext` whose
shape (`tf.params`, `tf.settings.technical_control`, `tf.presets.*.filePath`, `tf.session_name`)
is a mini-language. The scanner cannot nest (stops at the first `}}`), which is what forced the
flattening in C2 and what the `maintenance` preset comment works around. Two or three named
placeholders substituted by the caller would cover every real use.

---

## D. Session runtime and control flow

### D1. The `Driver` seam conflates two orthogonal axes
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
`runFramework` (the build path) and `runPrompt` (the direct-prompt path). `composeRunSystem`
exists specifically because the two "each inlined the composition and one nested the protocols
inside the built-in-prompt branch" (#500/#501). Once `Bootstrap` is gone (A3) and presets are gone
(A5), the build path *is* "one prompt, honoring gates" — which is exactly what `runPrompt` is.

**Do:** one path. Deletes `prompt-run.ts` (211 LOC) or most of `run.ts`, the divergence risk that
`composeRunSystem` was created to fix, and the `Kind{Build task or direct prompt?}` branch in the
flow diagram.

### D3. Two dashboard hosts + one relay host → one
The daemon serves the dashboard; `the-framework "prompt"` *also* starts a foreground per-run
dashboard on its own port with a `singleProjectProvider`; the relay is a third host. This is why
`dashboard-rpc/context.ts` probes six optional capabilities on every call and every RPC has an
"absent capability" branch.

Given "one daemon per machine" is the stated architecture, the foreground dashboard is a second
implementation of the product's front door. **Do:** the CLI starts (or finds) the daemon and opens
the browser. One host, no capability probing, no graceful degradation matrix.

### D4. The CLI has no settings — only bootstrap arguments
**67 flags → 7. 10 verbs → 3. And `cli.ts` (2,589 lines) stops being four things at once.**

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

**(4) What genuinely survives — 7 flags, 3 verbs.**
The chicken-and-egg set: you cannot configure the dashboard from the dashboard before it exists,
and you cannot ask a browser where to bind a socket.

| Kept | Why it cannot be a dashboard setting |
|---|---|
| `--port` | The dashboard is not reachable yet |
| `--host` | Binding to the network is a security decision made before anything is served |
| `--daemon` | Foreground vs background is a property of *this* invocation |
| `--cwd` | Which project — the one thing typed before a project is registered |
| `--fake` | The offline/CI path; there is no human to click anything |
| `-h`, `-v` | Table stakes |

Verbs: `the-framework` (start/find the daemon, open the dashboard), `the-framework stop`,
`the-framework doctor`. Everything else — `research`, `prompt`, `maintain`, `worktrees`, `relay`,
`[intent...]` — is a dashboard action, or goes with its feature.

**The one real loss:** you can no longer start a session by typing `the-framework "fix the login
bug"` in a terminal. That is a genuine cost for a developer tool and should be a decision, not an
accident. It is consistent with the product's own pitch — *"stop babysitting your coding agents"*
describes someone watching a dashboard, not someone in a terminal — and if it is ever missed, one
verb (`the-framework "<prompt>"` → POST to the daemon, open the browser at the new session) brings
it back without reintroducing a single *setting*.

### D5. "run" vs "session" — pick one word
The SPECs say **session** throughout ("A session is one agent working one task…"). The code says
**run** throughout: `runId`, `run.json`, `runs/`, `RunStore`, `RunMeta`, `runFramework`,
`daemon-runtime`, `run-handoff`, `resolveRunCheckout`, `--run-id`. The dashboard mixes both
(`RunView.tsx`, `SessionActionsMenu.tsx`, `RunHistory.tsx`). There is even a ticket for it
(`2026-07-25_agents-instead-of-sessions.md` proposes a *third* word).

Pick one and rename. This is the cheapest large legibility win in the repo.

### D6. Four gate/choice mechanisms → one
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
A project-less run starts in a scratch directory, advertises a bind protocol, resolves an
`await-bind-project` gate by registering a project, then **re-homes its checkout into that
project** mid-run. That is: a special system-prompt block, a project list injected as context, two
gate kinds, a `bind` event, a `BindProjectDeps` seam threaded through `run.ts`/`await-gate.ts`,
and a directory move with a conversation to carry along.

The alternative it argues against — *"pick a project first"* — costs the user one click.

---

## E. Autonomy — the loop that spends the quota

### E1. Three spending gates → one
- `quota-boundary.ts` — the pro-rated week boundary, for unattended work (fails **closed**)
- `consumption-guard.ts` — polls quota during a run and pauses it (fails **open**)
- `budgetUsd` / `--max-cost` — a per-run USD cap
- plus `autoSpendOffset` (the slider), which "only ever *loosens*" for user-requested work

Four mechanisms answering "may this keep spending?", with two deliberately opposite failure
modes, and a slider that applies asymmetrically depending on who asked. The SPEC needs a paragraph
to explain that asymmetry, which is the tell.

**Do:** one gate, one policy, one failure mode: *unattended work stops when quota is unreadable or
past the boundary; user-requested work never stops.* That is already the intent — it just needs to
be one function instead of three modules plus a slider with conditional semantics. Delete
`budgetUsd` (a per-run USD cap is a different unit from the quota-week percentage everything else
speaks, and Claude Code subscriptions do not bill in USD).

### E2. Three claim mechanisms → one
An entry/ticket can be claimed by: (a) a **queue-entry pin** recorded as a run event and
re-derived from live runs + open PRs + *PR diffs on other machines*; (b) a **lock file** committed
and pushed beside the ticket on the default branch; (c) a **pinned branch** (`pinnedBranch` on a
routine job, with `stale-branch.ts` to release one left behind by a closed PR).

Three answers to "is someone already on this?", each with its own staleness story. Under B1
(status + assignee on the ticket, on the default branch) there is exactly one, and it is the one
that already works cross-machine.

### E3. The routine rotation is a scheduler in disguise
Five routines (`update-tickets`, `triage-quick`, `triage-consensual`, `plan-tickets`, plus a
calendar-paced `maintenance` outside the rotation), a drain job outside the rotation, per-routine
opt-out preferences, a rotation cursor, a cooldown, a concurrency cap, a fan-out flag, and a
documented failure mode where *"the rotation is unreachable with a standing backlog"* (P4 ticket,
`2026-07-31_spike-plan-blocked-by-queue.md`).

Also: `triage-quick` and `triage-consensual` are two triage routines, and `update-tickets`,
`suggest-new-tickets`, `suggest-tickets-to-work-on`, `suggest-new-features` and `import-tickets`
are five more ticket-shaped presets.

**Do:** two jobs. *"If there is confirmed work, do the next piece."* *"Otherwise, spend one
session improving the backlog."* The second one is a prompt, not five. That deletes the rotation
cursor, the precedence rules, the per-routine opt-outs, the "which routine is jammed" reporting,
and the P4 ticket along with them.

### E4. Four background sweeps on four timers → one tick
`ci-watch` (~1 min), `merged-worktrees` (10 min), `auto-pm` (10 min), `maintenance` (calendar),
`conversation-committer` (debounced), `stale-branch` (inside ci-watch), plus the quota poller and
the daemon heartbeat. Each with its own interval, its own preference re-read, and its own
stand-down reporting.

**Do:** one daemon tick that runs a list of jobs. Intervals become "every Nth tick". One place to
look when "nothing is happening".

### E5. `merged-worktrees` + `worktrees` + retention policy
Three interacting rules: a clean finish removes the worktree; a failure/stop keeps it; a merged
branch reclaims it later (via two different "landed" signals because squash-merge hides the local
one); deleting a session keeps the branch but drops the archive. Plus a prune verb, plus a manual
Remove button that shares the implementation.

The keep-on-failure rule is the only one earning its keep (it holds the uncommitted diff). The
rest is disk management on a developer machine. **Do:** remove the worktree on any terminal state
after committing outstanding work to the branch; keep a single `--keep` escape hatch. Everything
is reconstructable from the branch, which the SPEC already guarantees.

### E6. `no PR number is ever stored` — store the PR number
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
`+config.ts` sets `ssr: false`, `prerender: true`; `+route.ts` returns `true` for every path with a
comment saying its return value "is deliberately not read"; `+onBeforePrerenderStart.ts` exists
only to name `/` so an `index.html` gets emitted at all; the app then routes client-side in
`lib/route.ts` (96 LOC). The daemon serves the built files statically.

Net contribution of Vike + vike-react: one prerendered `index.html`. **Do:** plain Vite with an
`index.html`. Deletes `vike`, `vike-react`, the `pages/`+`layouts/` scaffolding, and the
`+config`/`+route`/`+onBeforePrerenderStart` indirection.

### F2. `the-framework` exports 406 symbols to one consumer
`src/index.ts` is 390 lines exporting ~406 named symbols. Its only consumers are the dashboard
(via `.`, `./client`, `./dashboard-rpc`) and its own CLI. Everything exported is public API that
must stay coherent, be re-exported through the right subpath, and stay browser-safe (there is a
standing rule that `system-prompt.ts` must not import `node:fs` because the dashboard renders it).

**Do:** export what the dashboard imports and nothing else — the type-checker will tell you
exactly what that is. Then the "must stay node-free" constraint applies to a handful of modules
instead of being a repo-wide hazard.

### F3. Telefunc + a capability-probing context → plain HTTP handlers
Telefunc requires a build-time transform, a `telefunc-serve.ts` shim (192 LOC), a `register.ts`, a
`stream-channel.ts`, and `getContext()`-based capability probing in `context.ts` (126 LOC). Under
D3 (one host) the context collapses to nothing, and the RPC layer is ~40 read functions and ~15
commands — which is a `POST /rpc/<name>` handler and a typed client.

Not urgent, but worth reconsidering once D3 lands, because most of Telefunc's value here is
type-safety across a boundary that could just share types directly (the dashboard already imports
`@gemstack/the-framework` types).

### F4. Vendored `animate-ui` (1,225 LOC)
A vendored animation primitive library (641 LOC in one highlight effect) inside the components
directory, alongside vendored shadcn `ui/` (1,562 LOC). The shadcn vendoring is idiomatic;
`animate-ui` is a dependency that was copied in. **Do:** depend on it, or delete the animations.

### F5. Dashboard feature surface vs. the goal
The overview page renders: quota bar, open-questions hub, active agents, the full AI queue,
routine work, hot tickets, an onboarding checklist. Plus pages for tickets (with client-side
faceted filtering across text/priority/effort/uncertainty/topics/planning-stage/project, sorting,
group-by, and URL mirroring — `ticket-filter.ts` is 418 LOC), per-ticket, per-plan, settings, and
a session view with transcript, diffs, git status, handoff panel, agent-authored views, docs,
history rails, and a 347-line actions menu.

For 77 tickets, a faceted filter bar with range/bucket modes on four numeric dimensions is
strictly more machinery than the data. **Do:** text search + sort by priority. Revisit at 1,000
tickets.

---

## G. Process and repo hygiene

### G1. SDD: 898 `SPEC.md` files for 818 source files
7,012 lines of spec, one file per source file *and per directory* — **including per test file**
(`story-session-lifecycle.test.SPEC.md`, `client-construction.test.SPEC.md`,
`define.test.SPEC.md`, `vite.config.SPEC.md`). A spec for a Vite config and a spec for a test
file are specs describing implementation.

Every one of these must be kept in sync by hand or by an agent, forever, and they are the reason
the repo has 992 markdown files. The high-level ones (package, subsystem, subdirectory) are
genuinely excellent and are how this review was possible. The per-file ones are a second copy of
the doc comments already in the source.

**Do:** keep `SPEC.md` at the package and directory level (~70 files, and they carry almost all of
the 7,012 lines' value). Delete the per-file ones, and never write one for a test or a config.

### G2. 76 pending changesets for a product with zero users
`AGENTS.md`: *"The project isn't released, it has zero users. Thus, breaking changes aren't a
problem, so prefer clean code over breaking changes."* Alongside: 76 changesets, semver'd packages
(`ai-sdk@0.6.1`, `ai-autopilot@0.12.0`, `the-framework@1.4.2`), a `release.yml` workflow, and
migration notes in `ai-sdk/README.md` telling users how to update imports for a 0.3.0 move.

**Do:** pick one. If there are no users, drop changesets and version from `0.0.0` until there are.
If `ai-sdk` has users, it belongs in its own repo (A1) — which resolves the contradiction from the
other side.

### G3. Stale docs contradicting the code
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
Nearly every doc comment cites issue numbers (`#326`, `#1372`, `#1467`, …) — often *only* issue
numbers, as in "the #1372 rule" or "Rom's call on #519". The repo has 50 commits; the issues live
elsewhere and some (like #326) are load-bearing artifacts (C2).

The comments that explain *what and why* in prose are excellent. The ones that delegate the why to
a number are a dangling pointer. **Do:** keep the number as a suffix, never as the explanation.

### G5. Test volume
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
| 4 | Root SPEC: *"Files are the seam… There is no direct process-to-process channel"* — vs relay HTTP, daemon→daemon HTTP, bridge HTTP, CDP proxy, Discord WebSocket | Files are the seam *locally*. Cut the remote surfaces and the rationale becomes true again (**A6**) |
| 5 | Root SPEC: *"The dashboard never holds authoritative state"* — vs *"The one exception is saved remote devices: their access tokens stay in this browser only"* | Delete remote devices; the exception disappears (**A6**) |
| 6 | Driver SPEC: *"the seam is the code and the outcome, never the agent's individual tool calls"* — vs branching control flow on fenced blocks the agent emits, and draining its backlog one entry per turn | Honest framing: the seam is the agent's *final message*, which is a contract, not black-box treatment. Shrink the contract to one gate shape (**D6**) |
| 7 | *"Spend the whole week's quota, never starve the user"* — vs eco mode trimming prompt sections to save tokens, and a per-run USD cap | Delete eco (**C1**) and `budgetUsd` (**E1**) |
| 8 | Two off-switches for the built-in prompt (`--vanilla` / `--transparent`) with subtly different semantics | One switch (**C1**) |
| 9 | Config key `antiLazyPill` vs flag `--vanilla` vs concept "built-in prompt"; three comments apologise for the mismatch | Rename or delete (**C3**) |
| 10 | `eco.autoMaintenance` documented as *"Nothing to drop here"* — the flag acts on a different prompt | Delete (**C1**) |
| 11 | SPECs say **session**; code says **run**; a ticket proposes **agent** | Pick one, rename (**D5**) |
| 12 | *"One daemon per machine"* — vs a second, foreground, per-run dashboard host, plus a third relay host | One host (**D3**) |
| 13 | `Driver` models "which agent", but `cloud`/`actions` are the same agent elsewhere — forcing `handsOff` to disable half the run | Separate the axes, or delete the remote drivers (**D1**, **A6**) |
| 14 | Five representations of "work to do", with a promotion mechanism whose own SPEC says the state is *ambiguous* and needs a fork point | One ticket file with status + assignee (**B1**) |
| 15 | Three claim mechanisms (queue pin / lock file / pinned branch) for one question | One (**E2**) |
| 16 | Four committed records of one session (LOGS.md, conversation, archive, event log) — and the top-priority ticket is about the Discord mirror reading the wrong one | Event log is the record; one committed projection (**B3**) |
| 17 | `ANALYSIS_RESULT.md` written by every run, read by nothing; a backlog ticket exists to start reading it | Delete (**B2**) |
| 18 | Two spending gates that *"fail in opposite directions on purpose"*, plus a slider that applies asymmetrically | One gate, one policy (**E1**) |
| 19 | *"No PR number is ever stored"* — costing a three-way branch-name guess, a timestamp heuristic and a stale-while-revalidate cache | Store the PR number (**E6**) |
| 20 | System prompt's source of truth is GitHub issue #326; a daily CI job detects the repo drifting from it; one block can only be approximately synced; the drift-checker's own path filter is already stale | Repo is the source of truth (**C2**) |
| 21 | `AGENTS.md`: *"zero users, breaking changes aren't a problem"* — vs 76 changesets, semver, publish workflow, and 0.3.0 migration guidance | Drop the release machinery, or move `ai-sdk` out (**G2**) |
| 22 | Root `package.json`: *"GemStack: a collection of framework-agnostic tools. Home of @gemstack/ai-sdk"* — vs a repo named `the-framework` shipping a product | One identity (**G3**) |
| 23 | `framework-dashboard` README calls itself a prototype running beside a `page.ts` MVP that no longer exists | Rewrite or delete (**G3**) |
| 24 | SDD applied to test files and Vite configs — specs describing implementation | Directory-level specs only (**G1**) |
| 25 | `framework-detection` scores dependencies to pick a preset, and `run.ts` notes *"nothing about it reaches the agent's prompt"* — a detector whose only output is a log line | Delete (**A5**) |
| 26 | `Bootstrap`'s `scope` phase — *"the one and only interrogation"* — is a constant function in the product | Delete the spine (**A3**) |

---

## Suggested order of work

1. **A1** delete `ai-sdk` → **A2** absorb `ai-autopilot`. Biggest subtraction, zero product risk
   (nothing imports what is removed).
2. **A4** delete deploy/serve/sandbox/runner → **A3** delete `Bootstrap` → **A5** delete presets
   and loops. These three unlock each other; after them `run.ts` is a prompt loop.
3. **D2** merge the two run paths, **D1**/**A6** cut surfaces, **D3** one dashboard host. The
   conditional complexity in `dashboard-rpc`, `telefunc-serve` and `system-prompt` collapses.
4. **D4** strip the CLI to bootstrap arguments (do it *after* step 2–3, which delete ~23 flags
   outright, so it is mostly deletion rather than migration) → then **B5**, because removing the
   flag tier is what lets `config-layers.ts` go entirely.
5. **B1** one work-item format, **B3** one record, **E2** one claim. This is the deepest change
   and the one that most improves "simple to reason about" — do it once the surface is smaller.
6. **C1**/**C2**/**C4** prompt modes and source of truth. Cheap, independent, do any time.
7. **D5** rename run→session, **G1**/**G3** docs. Mechanical; do last so it renames less code.

**Rough scale:** A1–A6 alone remove on the order of **45,000–55,000 LOC of ~132,000** — about a
third to 40% of the repo — without touching anything the stated business goal needs.
