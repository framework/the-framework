The Framework: autonomous AI programming. The user registers repositories as projects in a browser dashboard and states what to build or fix; a coding agent [2] — Claude Code or Codex, on the user's own subscription — works the task unattended in a checkout [3] of its own, stops only for decisions a human must make, and publishes the result as a pull request it opens itself. The dashboard starts that work by running the project's own start hook [4] and never names the tool behind it; everything it then shows, live or long afterwards, it reads from the files that tool keeps. While nobody is at the keyboard, a scheduler the project's own hook starts with the dashboard works the agent queue [7] one entry at a time and keeps the queue fed on a schedule: issues become tickets, tickets get plans, planned tickets are queued — standing down before unattended work could eat into the quota a human will want. The product never calls a model itself, and the user's own checkout is never touched.

## Context

**User story**:
- A developer registers a repository, types what they want or picks one of the project's commands [9], and gets a reviewable pull request without babysitting: the agent [1] asks only when a real decision is needed and otherwise finishes on its own.
- A developer answers an agent's question [5] hours later, from the dashboard, and the same agent picks up where it stopped.
- A developer walks away with the scheduler on. It drains the agent queue [7] one entry at a time, each agent's pull request armed by the agent itself to merge once its checks pass; it never starves work the developer asks for.
- Nothing The Framework removes on its own initiative is lost: it only removes what is already on the git remote.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent [2] in its own checkout [3], on its own branch, started through the project's start hook [4] and shown in the dashboard from the files its tool keeps.
[2] coding agent: the CLI doing the actual work: Claude Code or Codex.
[3] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch.
[4] start hook, resume hook: the one shell line under `start`, and the one under `resume`, in a project's `.the-framework/hooks.yml`; each answers the agent's id as JSON on stdout. The dashboard runs the line and reads what it answers; what the line names is the user's business.
[5] question: what an agent's turn ended on, asking the user to choose between options; the agent ends `waiting` [6], its checkout kept, and the answer resumes it.
[6] waiting: how an agent that ended on a question [5] reads: not working, its checkout kept, resumed by the answer or by the user's next message.
[7] the agent queue: `TODO_AGENTS.md` on the `agent-data` branch [8]: every task agents will work next, in priority sections, worked top-down.
[8] the `agent-data` branch: the branch of a project's repository used as a file store for everything agents share: tickets, the agent queue [7], the runs [11]. Born as an orphan, written through one sync → commit → push cycle.
[9] command: one of the project's skills [10] written to be run by a person, never picked up by the coding agent on its own (its front matter says `disable-model-invocation: true`), read off the folders the coding agents read them from; typed as `/<name>`, optionally followed by an argument. The Framework ships none of them and no prompt text of its own.
[10] skill: a capability an agent is taught — `branches`, `tickets`, `queue`, `logs` — each a package with the instructions the agent reads (its `SKILL.md`, linked into the checkout where the coding agent's harness looks for skills), a command on the agent's PATH, and an API the product calls.
[11] run: only the `logs` skill's record of one agent on the `agent-data` branch [8]: a card (what was asked, the branch, the pull request, how it ended, what it cost) and a diary (what the agent said). Never the unit of work.
[12] card / diary: an agent's record in the `logs` skill's two shapes: the card `<id>.json` and the diary `<id>.jsonl`. While the agent has a checkout they sit under the checkout's `.the-framework/`, written by the tool that runs the agent; when it ends they are recorded on the `agent-data` branch [8] and the checkout is reclaimed.
[13] inbox: `.the-framework/inbox.jsonl` in an agent's checkout: one JSON line per message or answer, which the agent's session takes when a turn ends.
[14] quota boundary: the share of the quota week that may be spent by now, rising with the clock; unattended work stands down past it, work a human asked for never does.
[15] the Claude web bridge: the daemon's bridge endpoints plus the Chrome extension: carries the question a cloud session on claude.ai is parked on into the dashboard, and types the pick back into the session.
[16] session name: the name an agent gives its own work (`[a-z0-9-]+`); its branch is renamed to `agent-<session name>` and the dashboard labels the agent by it.
[17] device: another machine's daemon the user saved by URL and token, to start agents on it from this dashboard.
[18] cloud anchor: an empty commit pushed before a task leaves this machine, unique to the agent: the branch a cloud session later pushes descends from it, which is how the daemon recognizes that branch as the agent's.

## Business logic — TL;DR

- **How the packages fit together** - one product package on top of six libraries it is built from, plus the scheduler, the command [9] packages and two companions; the product is a dashboard over what the others do.
- **From a prompt to a pull request** - the dashboard runs the project's start hook [4]; the tool that line names gives the agent [1] a checkout [3] and drives the coding agent [2], which publishes its own work; the dashboard shows all of it by reading the agent's card and diary [12].
- **Answering an agent, and saying more to it** - a question [5] ends an agent waiting [6] with its checkout kept; a message reaches a working agent through its inbox [13] and an ended one through the resume hook [4]; Stop signals the process the card names.
- **While nobody is at the keyboard** - the scheduler works the queue and keeps it fed, standing down at the quota boundary [14]; the daemon itself only keeps every project's `agent-data` branch [8] in step with the remote, notifies, and tidies what cloud sessions left behind.
- **Work that runs somewhere else** - an agent can be started on a device [17] running another daemon and followed from this dashboard like a local one.

## Business logic

### How the packages fit together

#### Context

**Business logic story**: the product is one npm package, `framework`; what it is built from is published as libraries so the coding-agent side of it — driving a coding agent [2], keeping shared files on a branch, the skills [10] — can stand on its own, and so that what starts agents is replaceable by whatever a project's start hook [4] names.

#### Business logic

- `packages/framework` — the product: the `the-framework` CLI (four options, no verbs), the daemon it runs in the foreground (Ctrl-C closes the dashboard; an agent [1] is not the daemon's process and goes on to its end), and the dashboard the daemon serves — the product's only user interface. It runs no coding agent [2] and names no tool: it starts an agent through the project's start hook [4] and reads the agent's card and diary [12] for everything it shows. It ships no prompt text. Depends on all six libraries below.
- `packages/agent-driver` — the driver seam: one contract for driving a coding agent [2] as a black box, with the Claude Code, Codex, GitHub Actions and fake implementations; it keeps the agent's card and diary [12], reads the inbox [13] when a turn ends, and reports the question [5] a turn ended on. The Framework prompts one turn at a time, lets the coding agent's own loop run to completion, and learns everything from the turn's final message: it never gates on the agent's individual tool calls, holds no model key, and runs on the user's own subscription.
- `packages/agent-data` — a branch of the project's repository used as a file store: the `agent-data` branch [8], checked out under `.branches/`, written through one sync → commit → push cycle that re-applies when a push loses a race. A library, not a skill: read by code, never by an agent. Every skill depends on it; nothing else does.
- `packages/skill-branches`, `packages/skill-tickets`, `packages/skill-queue`, `packages/skill-logs` — the four skills [10]: an agent's own checkout [3] and branch; the tickets with their plans and claims; the agent queue [7]; the record of every run [11]. Tickets, queue and runs live on the `agent-data` branch, never on a code branch, so the default branch stays code only. No skill depends on another.
- `packages/skill-work-queue` — the first command [9] skill: a job for an agent, one skill file and no code, composing the four skills [10] without naming one; a project tracks it as `.claude/skills/work-queue`, and both the dashboard's launcher and the scheduler fire it by its slash command, `/work-queue`. One package per command, `@gemstack/skill-<command>`; nothing depends on it.
- `packages/skill-update-tickets`, `packages/skill-plan-tickets`, `packages/skill-triage` — the routine commands, one package each of the same shape: bring the tickets up to date with the issue tracker, queue a plan for every unplanned ticket, queue the tickets whose plan says they are ready (the quick wins and the consensual work, two modes of one command, each on its own schedule line). The schedule says how often at most each runs, and only while a check finds work.
- `packages/skill-plan`, `packages/skill-research`, `packages/skill-maintainability`, `packages/skill-readability`, `packages/skill-security-audit`, `packages/skill-ux`, `packages/skill-maintenance`, `packages/skill-market-research`, `packages/skill-suggest-new-tickets`, `packages/skill-suggest-new-features`, `packages/skill-suggest-tickets-to-work-on`, `packages/skill-post-merge-cleanup` — the commands a person fires from the launcher, one package each of the same shape. One plans: plan writes a ticket for the task typed after the slash command and, under it, a plan naming the ways to do the work and the one the agent recommends, then stops; a person queues the ticket. Four work on the part of the project typed after the slash command and open a pull request a person merges: a maintainability refactor, a readability refactor, a security audit, a UX review. Three write tickets: market research, new tickets, new features. One queues work: maintenance, a maintainability refactor and a security audit per part that needs one. Two change nothing and end on a written result a person reads: research, rating how obviously well the code solves each problem it solves, and suggest-tickets-to-work-on, ranking the tickets to work on next. One writes up merged pull requests: post-merge-cleanup opens a pull request bringing the knowledge files up to date with what they decided and taught; a schedule can fire it, hourly say.
- `packages/agent-scheduler` — the scheduler: a tool like `agent-driver`, one command line and one small process per project, that reads the project's tracked `agent-schedule.md` (per command [9] a check that says there is work, an interval that says how often at most, or both, and `off` for a command that runs only on a machine where a person switched it on), ticks every minute, and starts one agent per due command in its own checkout, recording every run [11] on the `agent-data` branch. Its command line is also what a project's start hook and resume hook [4] name in this monorepo. Depends on `agent-driver`, `agent-data`, the branches and the logs packages; never on The Framework, which never depends on it.
- `packages/chrome-extension` — the far end of the Claude web bridge [15], a Chrome extension reading claude.ai in a signed-in browser; it talks to the daemon over HTTP only.
- `packages/the-framework.ai` — the marketing site at https://the-framework.ai; it presents the product and shares no code with it.
- `.github/workflows` — every push builds, type-checks and tests the monorepo; the website deploys itself from the default branch; and one workflow is the far end of the `github-actions` driver implementation, running one turn per workflow run.

### From a prompt to a pull request

#### Context

See `## Context`.

#### Business logic

The user activates a project from the dashboard, picked in the OS folder picker behind a trust confirmation: any dirty state is committed first, a `.the-framework/` directory is created with its ignore file, and the project is registered in the daemon's one user file. From the project's home the user picks one of the project's commands [9] or types their own prompt, and picks the coding agent [2] and the model if the defaults are not wanted. The commands are the project's own skills [10] written to be run by a person, read from the folders the coding agents read them from; they are in the launcher's `/` list and its Commands menu. A skill that teaches the agent how to use the tickets, the queue or the logs is not listed.

Start runs the project's start hook [4], handing it the prompt and the picks, and the line answers the id of the agent [1] it began. The daemon holds nothing about that agent: no process, no slot, no cap — the click is the brake. A project that names no start hook cannot start an agent from the dashboard, and the launcher says so rather than falling back to something of ours.

What the line names is the user's business; in this monorepo it is the scheduler, which gives the agent a fresh checkout [3] — a git worktree under `.branches/` on the branch `agent-<id>`, its dependency directories linked from the project's checkout, the skills [10] linked in where the coding agent's harness looks and their commands on the PATH — and drives the coding agent through one prompt: the command's own skill file is the whole instruction. There is no system prompt of ours, and no gate on the agent's turns.

The coding agent names its work before its first change (the session name [16]; the branch is renamed to `agent-<session name>`), commits as it goes — nothing is ever committed on its behalf — and publishes its own work through the skills in its checkout: it pushes its branch, opens its own pull request, and arms GitHub's auto-merge on it when the work was asked for that way. When the user ticked "Post-merge cleanup" in the launcher, that merge is held instead: once the agent ends with a pull request, a fresh agent runs `/post-merge-cleanup` on the same branch, and the merge is armed only after it ends done. The tool running the agent keeps the agent's card and diary [12] in the checkout as it works, records both on the `agent-data` branch [8] when the agent ends, and reclaims the checkout once the work is on the remote — never before.

The dashboard is a projection of those files throughout. It tails the agent's diary to the browser as the agent writes it and reads the recorded diary long afterwards, so watching now and reading later show the same record.

### Answering an agent, and saying more to it

#### Context

See `## Context`.

#### Business logic

A turn that ends on a question [5] ends the agent there, waiting [6], with its checkout kept. The question is shown wherever the agent is listed and in the dashboard's one cross-project list of everything waiting on a human, longest-waiting first. Answering hands the chosen option's label to the project's resume hook [4], which continues that same agent — the same id, the same record, the same branch, the coding agent's own session resumed — so a question answered hours later costs nothing but the wait. Only what the agent actually offered can be answered.

The user can also simply say something to an agent. While it is working the words are appended to its inbox [13] and the agent takes them when its turn ends; once it has ended they go through the resume hook instead. An agent that ends while the words are still on their way has them taken back out of the inbox and resumed with, so nothing is left in a file nobody will read. Either way the user is told when the agent could not be reached.

Stop signals the process the agent's card [12] names, when that process is this machine's and alive; there is nothing else to stop, because the agent is not the daemon's to own.

### While nobody is at the keyboard

#### Context

See `## Context`.

#### Business logic

The unattended work is the scheduler's: it ticks, decides which of the project's commands [9] are due, and starts one agent each, standing down before the quota boundary [14] so that what it spends never eats into what a human will want. The dashboard shows those agents exactly as it shows the user's own, because they leave the same files. Its usage panel draws where the account stands against that boundary, and its one handle moves how far past the boundary every project's scheduler may start work, through each project's own `offset` line in `.the-framework/hooks.yml`. Settings lists every project's scheduled commands, each with a checkbox that decides, on this machine only, whether the scheduler starts that command on its own, through each project's own `switch` line; the tracked `agent-schedule.md` stays the team's default.

The daemon's own background work starts no agent. On one shared clock it keeps every project's `agent-data` branch [8] in step with the remote and records what a project cannot converge, announces what is new on two feeds — what needs a human (an open question, a pull request to review, unpushed commits) and plain activity — to the browser and, when configured, to Discord, and tidies what cloud sessions left behind: it adopts the branch a session pushed by its ancestry from the cloud anchor [18], and expires dead cloud refs.

### Work that runs somewhere else

#### Context

**User story**: the user wants an agent on another machine of theirs, and to follow it from this dashboard as if it were local.

#### Business logic

A device [17] is another machine's daemon the user saved by URL and token: the local daemon forwards the start to it, that daemon runs its own project's start hook [4], and the agent's events are streamed back and its steering forwarded, so it renders like a local agent. The token never leaves the two daemons and is never persisted with the agent.

An agent on a GitHub Actions runner or in a Claude Code cloud session cannot be started from the dashboard for now; each returns as its own step. What stays ready for them is the daemon's side: the Claude web bridge [15] — in the user's own Chrome or in a Chrome for Testing the daemon downloads and drives itself — which carries a cloud session's question into the dashboard and types the pick back, the adoption of the branch such a session pushes, and the sweep of the refs it leaves behind.
