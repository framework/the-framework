The Framework: autonomous AI programming. The user registers repositories as projects in a browser dashboard and states what to build or fix; a coding agent — Claude Code or Codex, on the user's own subscription — works the task unattended in a checkout [3] of its own, stops only for decisions a human must make, and hands the result off as a pull request. While nobody is at the keyboard, a scheduler the user starts in the project works the agent queue [7] one entry at a time, each entry by an agent that publishes its own pull request set to merge on green, and the daemon keeps the pull requests it opened green — both standing down before unattended work could eat into the quota a human will want. The product never calls a model itself, and the user's own checkout is never touched.

## Context

**User story**:
- A developer registers a repository, types what they want, and gets a reviewable pull request without babysitting: the agent [1] asks only when a real decision is needed and otherwise finishes on its own.
- A developer walks away with the scheduler on. It drains the agent queue [7] one entry at a time, each agent's pull request merging on green, and the daemon fixes red CI on its own pull requests; neither starves work the developer asks for.
- Nothing The Framework removes on its own initiative is lost: it only removes what is already on the git remote.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends. Started from the dashboard by the user, or by the daemon.
[2] driver: a coding agent wrapped as a black box: start it in a directory, prompt it for one turn, stream what it does, resume it later. The user's driver choice is `claude` or `codex`; the driver implementations are `claude-code`, `codex`, `github-actions`, `claude-web` and `fake`.
[3] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch.
[4] gate: a question with options at which an agent stops and waits for an answer: it emits the question in its turn's final message, the dashboard shows it as a card, and the answer re-prompts the agent. When nobody can answer, the recommended option is taken.
[5] handoff: what happens to an agent's work when the agent ends, as one ladder of four levels: `local` (keep the work in its checkout), `push` (push its branch), `pr` (also open a pull request — the default), `merge` (also merge it).
[6] the `agent-data` branch: the branch of a project's repository used as a file store for everything agents share: tickets, the agent queue, the runs. Born as an orphan, written through one sync → commit → push cycle.
[7] the agent queue: `TODO_AGENTS.md` on the `agent-data` branch: every task agents will work next, in priority sections, worked top-down.
[8] skill: one of the four capabilities an agent is taught — `branches`, `tickets`, `queue`, `logs` — each a package with the instructions the agent reads (its `SKILL.md`, linked into the checkout where the coding agent's harness looks for skills), a command on the agent's PATH, and an API the product calls.
[9] location: where an agent's turns run: `local` (this machine), `actions` (a GitHub Actions runner), or `web` (a Claude Code cloud session).
[10] sweep: a background job the daemon runs on its clock: the CI watch, the notification watchers, the data sync, the sweep that reclaims checkouts, the branch-links sweep, the cloud scratch sweep, cloud work adoption.
[11] quota boundary: the share of the quota week that may be spent by now, rising with the clock; unattended work stands down past it, work a human asked for never does.
[12] the Claude web bridge: the daemon's bridge endpoints plus the Chrome extension: carries the question a cloud session is parked on into the dashboard, and types the pick back into the session.
[13] hands-off: said of an agent whose work leaves this machine, so its first prompt is the whole agent: an agent whose location is `web`.
[14] session name: the name an agent gives its own work (`[a-z0-9-]+`); its branch is renamed to `agent-<session name>` and the dashboard labels the agent by it.
[15] ready for merge: the signal an agent emits when it believes its work is complete: it flips the agent's badge from building to ready and authorizes the handoff.
[16] run: the `logs` skill's record of one agent on the `agent-data` branch: a card (what was asked, the ticket, the branch, the pull request, how it ended, what it cost) and a diary (what the agent said).
[17] device: another machine's daemon the user saved by URL and token, to run agents on it from this dashboard.
[18] cloud anchor: an empty commit a web agent pushes before its task leaves this machine, unique to the agent: the branch the cloud session later pushes descends from it, which is how the daemon recognizes that branch as the agent's.

## Business logic — TL;DR

- **How the packages fit together** - one product package on top of six libraries it is built from, plus two companions; every user-facing behavior is the product's, the libraries are the seams it is built on.
- **From a prompt to a pull request** - the user starts an agent [1] from the dashboard; the daemon gives it a checkout [3], frames the coding agent, honors the gates [4] it stops at, and publishes the work per its handoff [5] level when it ends.
- **While nobody is at the keyboard** - on one shared clock the daemon keeps its pull requests green and merges them, notifies, keeps every project's `agent-data` branch [6] in step with the remote, and reclaims what is on the remote — the one agent it starts on its own gated by the quota boundary [11].
- **Work that runs somewhere else** - an agent's location [9] can be a GitHub Actions runner, a Claude Code cloud session (with the Claude web bridge [12] carrying its questions home), or a device [17] running another daemon; each is followed from this dashboard like a local agent.

## Business logic

### How the packages fit together

#### Context

**Business logic story**: the product is one npm package, `framework`; what it is built from is published as libraries so the coding-agent side of it — driving a coding agent, keeping shared files on a branch, the four skills [8] — can stand on its own.

#### Business logic

- `packages/framework` — the product: the `the-framework` CLI (four options, no verbs), the daemon it runs in the foreground (Ctrl-C closes it and every agent [1] it is running), the agent lifecycle, the dashboard the daemon serves — the product's only user interface — and every prompt an agent is sent, as markdown. Depends on all six libraries below.
- `packages/agent-driver` — the driver [2] seam: one contract for driving a coding agent as a black box, with the Claude Code, Codex, GitHub Actions and fake implementations; the product adds its own cloud-session implementation behind the same contract. The Framework prompts one turn at a time, lets the coding agent's own loop run to completion, and learns everything from the turn's final message: it never gates on the agent's individual tool calls, holds no model key, and runs on the user's own subscription.
- `packages/agent-data` — a branch of the project's repository used as a file store: the `agent-data` branch [6], checked out under `.branches/`, written through one sync → commit → push cycle that re-applies when a push loses a race. A library, not a skill: read by code, never by an agent. Every skill depends on it; nothing else does.
- `packages/skill-branches`, `packages/skill-tickets`, `packages/skill-queue`, `packages/skill-logs` — the four skills [8]: an agent's own checkout [3] and branch; the tickets with their plans and claims; the agent queue [7]; the record of every run [16]. Tickets, queue and runs live on the `agent-data` branch, never on a code branch, so the default branch stays code only. No skill depends on another.
- `packages/skill-work-queue` — the first command skill: a job for an agent, one skill file and no code, composing the four skills [8] without naming one; a project tracks it as `.claude/skills/work-queue`, and the scheduler fires it by its slash command, `/work-queue`. One package per command, `@gemstack/skill-<command>`; nothing depends on it.
- `packages/agent-scheduler` — the scheduler: a tool like `agent-driver`, one command line and one small process per project, that reads the project's tracked `agent-schedule.md`, ticks every minute, and starts one agent per due command in its own checkout, recording every run on the `agent-data` branch. Depends on `agent-driver`, `agent-data`, the branches and the logs packages; never on The Framework, which never depends on it.
- `packages/chrome-extension` — the far end of the Claude web bridge [12], a Chrome extension reading claude.ai in a signed-in browser; it talks to the daemon over HTTP only.
- `packages/the-framework.ai` — the marketing site at https://the-framework.ai; it presents the product and shares no code with it.
- `.github/workflows` — every push builds, type-checks and tests the monorepo; the website deploys itself from the default branch; and one workflow is the far end of the `github-actions` driver implementation, running one turn per workflow run.

### From a prompt to a pull request

#### Context

See `## Context`.

#### Business logic

The user activates a project from the dashboard, picked in the OS folder picker behind a trust confirmation: any dirty state is committed first, a `.the-framework/` directory is created with its ignore file and layout marker, and the project is registered in the daemon's one user file. From the project's home the user types a prompt or picks a preset, choosing the driver [2], the model, the location [9] and the handoff [5] level if the defaults are not wanted.

The daemon gives the agent [1] a fresh checkout [3] — a git worktree under `.branches/` on the branch `agent-<id>`, its dependency directories linked from the project's checkout, the four skills [8] linked in where the coding agent's harness looks and their commands on the PATH — checks that the chosen driver's coding agent can actually start, and spawns one process for the agent with its whole configuration as one JSON file. That process frames the coding agent with the built-in system prompt (plus the project's `SYSTEM.md` and the signal protocols), renders the user's text into the prompt's user slot, and lets the driver run a turn.

The coding agent names its work before its first change (the session name [14]; the branch is renamed to `agent-<session name>`), commits as it goes — nothing is ever committed on its behalf — and ends each turn with a final message The Framework parses. A question with options is a gate [4]: the dashboard shows it where it happened, the user's pick is written to the agent's control file and re-prompts the agent, an unattended agent takes the recommended option, and a pick marked to stop ends the agent. The message may also carry markdown views for the dashboard's right rail, an error the user must fix, the pull request's title and body, and the ready-for-merge signal [15].

Everything the agent does is appended as events to `.the-framework/events.jsonl` in its checkout; the daemon tails that file to the browser, so watching now and reading later show the same record. Once the opening work settles, a build agent works the agent queue [7] one entry per turn, and then takes the user's own messages, each continuing the same driver session; a settled agent reads as waiting for the user, not as finished.

When the agent ends, the handoff [5] runs at the level in force — by default push the branch and open a pull request named and described by the agent, with the issue reference of the ticket it worked; a merge is armed by configuration but authorized only by the agent's ready-for-merge signal, and a withheld merge is reported with its reason. An agent that committed nothing publishes nothing and leaves no branch behind. The run [16] is recorded on the `agent-data` branch [6] the moment the agent ends, and its checkout is reclaimed by a later sweep [10] once its work is on the remote — never before.

### While nobody is at the keyboard

#### Context

See `## Context`.

#### Business logic

The daemon runs its sweeps [10] on one shared clock. The one agent it starts on its own is the CI watch's fix agent, and only when the user switched that on. That start is refused, with its reason logged once per failing head commit, when the quota cannot be read or when the account is past the quota boundary [11]: the pro-rated share of the quota week that has elapsed, rising continuously with the clock and shifted by the user's spend offset. The chosen model's own week gates it the same way.

The CI watch polls the pull requests The Framework is waiting to land: it merges one once its checks pass, and when a check goes red it starts one unattended fix agent per failing head commit, at most two attempts per pull request; a pull request older than a week is a human's to land. The notification watchers announce what is new on two feeds — what needs a human (an open question, a pull request to review, unpushed commits) and plain activity (an agent started or finished) — to the browser and, when configured, to Discord. Other sweeps reclaim the checkouts whose work is on the remote, adopt the branches cloud sessions pushed, and expire dead cloud refs.

### Work that runs somewhere else

#### Context

**User story**: the user wants an agent to run on a fresh GitHub Actions runner, in a Claude Code cloud session on claude.ai, or on another machine of theirs — and to follow it from this dashboard as if it were local.

#### Business logic

An agent's location [9] is chosen at start and never changes. On `actions`, every turn is one workflow run on a GitHub Actions runner, with continuity carried by the branch the previous run pushed; the agent is followed like a local one. On `web`, the agent is hands-off [13]: the driver pushes a cloud anchor [18], the Claude web bridge's [12] extension creates the cloud session through claude.ai's repository picker on the chosen model, and the local agent ends there, with a link to the session. The bridge then carries any question the session parks on into the dashboard's open questions and types the pick back; the daemon later recognizes the branch the session pushed by its ancestry from the cloud anchor, records it on the run [16], and opens the armed pull request itself when the session opened none. The bridge runs either in the user's own Chrome or in a Chrome for Testing the daemon downloads and drives itself.

A device [17] is another machine's daemon the user saved by URL and token: the local daemon forwards the start to it, streams the agent's events back and forwards steering, so the agent renders like a local one; the token never leaves the two daemons and is never persisted with the agent.
