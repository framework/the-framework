The product: turnkey AI orchestration that wraps a coding-agent CLI (Claude Code today) as a black box and takes an idea, a ticket, or a queue entry to a reviewed pull request — a CLI, a per-machine daemon, and a localhost dashboard over agents that run unattended.

## User Stories

- The user installs globally or runs via `npx`; one command serves the dashboard and the daemon, and Ctrl-C takes everything down with it.
- The user activates a repo from the dashboard and it becomes a registered project, with an onboarding checklist derived from real facts rather than clicks.
- The user starts an agent by typing a prompt (attended) or picking a preset (unattended) — from the composer, a ticket row, a queue entry, a routine, or the CLI.
- The user watches a live transcript, answers the agent's questions inline where they happened, chats with it, stops and resumes it, and reopens a finished agent as the same conversation.
- The user reads the exact system prompt an agent ran under, layers their own instructions on top of the built-in one, and saves custom presets privately or into the repo for the team.
- The user receives finished work as a pull request, and can arm auto-merge so it lands once the agent signals ready and checks are green.
- The user removes an agent's checkout — or lets the daemon reclaim idle ones — and can always recover the work from the agent's branch.
- The user browses a cross-project ticket list, filters it, shares the filtered view as a URL, and queues or starts work from a ticket.
- The user walks away and the daemon keeps working the roadmap: draining the confirmed queue, refilling it by triaging and planning tickets, fixing red CI on its own PRs, and merging on green.
- The user sets no budget: unattended work stands down past the elapsed share of the quota week, and work the user asked for is never starved.
- The user runs agents on another machine's daemon, a GitHub Actions runner, or a Claude cloud session, and answers their questions from the local dashboard.
- The user is notified — browser or Discord — when an agent needs a human.

## Flows — TL;DR

- Activating a repo commits its dirty state, seeds the framework's own files, and registers the project; a preflight refuses a doomed agent before anything is spent.
- The user starts an agent — composer, ticket row, queue entry, routine, onboarding, or CLI — and the daemon spawns it detached, relaying it when aimed at a saved remote device.
- Every agent works in its own git worktree on its own branch, so the user's checkout is never touched.
- The driver runs each turn as a black box and everything learned from a turn is parsed from its final message; which CLI drives and where it executes are two swappable axes.
- A question parks the agent as an answerable card, chat continues the same conversation, and unattended agents take the recommended answer.
- After its main task, the agent drains its queue file one gated entry per turn.
- A finished agent's work is committed, pushed, and opened as a pull request — unless the agent is empty, which publishes nothing.
- Removal follows one rule — the checkout goes only once the remote has the work — so every deletion is recoverable.
- While nobody is around, the daemon drains the confirmed queue, refills it by triaging and planning tickets, and phrases every refusal as a reason.
- Configuration arms auto-merge, the agent's own ready signal authorizes it, and the CI watch merges green PRs and puts one fix agent on red ones.
- Unattended work stands down past the elapsed share of the account's quota week; work the user asked for is never starved.
- One daemon per machine serves the dashboard from the files agents write, and agents can also run on a saved device, GitHub Actions, or a Claude cloud session — or drive a real browser the user can take over.
- What must outlive a process — agent history, tickets, the queue — lands in git on the framework's data branch.
- One path composes every agent's recorded system prompt, presets are one catalog, and two switches (vanilla, transparent) dial the wrapping down.

## Flows

```mermaid
flowchart TD
    Trigger["Composer / routine / queue play button / CLI"] --> Workspace["Own git worktree,<br/>own branch"]
    Workspace --> Drive["Driver runs the agent<br/>turn by turn"]
    Drive --> Prompt["One opening prompt,<br/>honoring gates"]
    Prompt --> Parse["Parse each turn's final message<br/>(name, views, gates, ready-for-merge)"]
    Parse --> Gates["Await gates & live chat"]
    Gates -->|answer| Parse
    Parse --> Backlog["Drain the agent's own backlog,<br/>one entry per turn"]
    Backlog --> Settle["Settle: quality hook → handoff → archive"]
    Settle --> Handoff["Commit → push → open PR<br/>(empty agents skip)"]
    Handoff --> Teardown["Teardown & retention"]
```

**Setup.** When the user activates a repo, any dirty state is committed first — so the activation commit is clean — then the `.the-framework/` state directory is created and `.gitignore` is taught which parts stay untracked. The project is registered in a per-machine registry in the user's home, which also holds the user's dashboard preferences (project settings override user settings, only for keys a project may override) and the daemon's secrets. Before an agent spawns anything, a preflight probes the driver CLI it picked, so a missing prerequisite fails early and clearly; a guard the picked driver cannot honor is announced rather than silently ignored.

**Start.** The user starts an agent from the dashboard composer, a routine's "Run now", a queue entry's play button, onboarding, or the CLI. The daemon resolves the project, allocates the workspace, refuses only a duplicate agent on the same checkout — concurrent worktree agents are the normal case — and spawns the agent as a detached process. An agent aimed at a saved remote device is relayed to that device's daemon.

**Workspace.** The user's checkout — uncommitted work included — is never touched: every agent gets its own git worktree on its own branch, so concurrent agents never fight. Dependency directories are shared from the parent checkout instead of reinstalled. A non-git project falls back to the main checkout, one agent at a time; a git project whose worktree creation failed does **not** fall back — the start fails, because a failed agent is recoverable and a checkout with stray edits is not.

**Driving the work.** The work the user watches is driven turn by turn: the driver runs each turn as a black box to completion, and everything The Framework learns from a turn, it learns by parsing the turn's final message — the session name the agent invented (the branch is renamed to match), agent-authored views for the dashboard, the ready-for-merge signal, and blocking gates. Which CLI does that driving is a swappable axis (the *driver*), and where it executes is another (the *location*); the CLI keeps its own subscription auth, and The Framework never runs its own model calls for the coding work. A build and a verbatim prompt are the same path — one opening prompt, honoring gates; what differs is which prompt opens the agent and whether its own backlog is worked afterwards. A hands-off location (a cloud session) drops every phase after the work is dispatched, because there is nothing to read back.

**Gates and chat.** When the agent stops to ask, the user finds the question where it happened: the agent parks, and the question becomes a card — choices in the dashboard, a message on Discord, a notification. The answer travels back over the agent's control file (a file in its workspace the daemon appends to and the agent tails), and the agent continues from there. The one exception is an answer the agent marked as ending it — which is how declining a plan stops the work rather than building on a rejected one. The user can also speak unprompted; each message continues the same conversation, and an idle attended agent stays open waiting for the next one. Unattended agents take the recommended answer instead of parking on a question nobody is there to answer.

**The agent's own backlog.** Once its main task is done, the agent works what is queued for it one entry per turn: the framework hands it the next entry, the agent completes exactly that one, and the framework — never the agent — checks it off. The user is asked before each entry — a per-entry gate that an unattended agent answers itself.

**Settle and handoff.** The user receives finished work as a pull request: the handoff runs only on the success path — pending work is committed, the branch pushed, and a PR opened. The handoff first decides whether the agent is *empty* — no commits, or only bookkeeping files changed — and empty agents are never published. Settling is strictly ordered: a final quality turn (which queues the quality presets as backlog entries and folds new learnings into the project docs) → the git handoff → close and archive the agent's history. Publishing is one ladder — keep it local, push, open a PR, merge — and each rung includes the ones below it. Unset means open a pull request: that is the zero-config promise, an agent left alone publishes itself.

**Teardown and retention.** Whatever the user removes, the work survives: one rule decides every removal — the work is committed to the agent's branch, the branch is pushed, and the checkout goes only once the remote has it — so nothing local is ever the last copy, and every deletion is recoverable. A push that cannot land keeps the checkout, and the background sweep retries it later; a repo with nowhere to push keeps everything, which is the honest answer rather than a special case. The branch and the archived history always survive the worktree. An agent that died on a transient error is retried in the same worktree before being declared failed, and a finished one can be reopened later — its history restored so it continues as the same conversation. Acting on an agent the instant it finishes is safe: everything that touches its checkout takes its turn rather than racing, so a click that lands mid-teardown waits a beat instead of failing.

**Autonomy.** The roadmap the daemon works while the user is away lives in one file: the queue file (`TODO_AGENTS.md`), the durable, priority-ordered list of confirmed work, kept on the framework's own data branch. Agents write it directly; a *ticket*, by contrast, is a proposal for a human to accept. Every change to it — an agent's addition, a drain's check-off — goes through the data branch's serialized write cycle, so every machine and cloud session converges on the same queue. An entry tied to a ticket is claimed through the ticket's own lock file, which agents on other machines see; an entry without a ticket is pinned only in this daemon's memory while its agent runs — the queue file itself is the record of what is left. On a timer, per project, the daemon asks one policy question — "is now a good time to spend quota on our own roadmap?" — checking the cheapest facts first. A non-empty queue is drained one entry per agent; an empty queue is refilled by rotating through updating tickets from GitHub → quick triage → consensual triage → ticket planning. Ticket planning fans out several agents, each pinned to exactly one ticket and claimed via a lock file beside the ticket, so agents on other machines see the claim too. A calendar-paced maintenance sweep sits outside the rotation and takes precedence when due. Every refusal is phrased as a reason, so a setting never reads as a bug.

**Merging and CI watch.** When the user arms auto-merge, configuration only *arms* it; what *authorizes* the merge is the agent's own ready-for-merge signal plus an empty backlog of its own. An armed-but-unauthorized merge is recorded as withheld, with the reason. The daemon polls the PRs the framework is waiting to land. Green checks on an armed PR: merge it — merge-on-green works even where GitHub's native auto-merge is off. Red checks: one unattended fix agent per failing head commit, told to land the fix on the PR's own branch; after two failed attempts the failure is evidently not one an agent can fix and a human keeps it. Housekeeping retires what is safe: checkouts whose work is already on the remote are reclaimed, and a pinned routine branch left behind by a closed PR is released so the routine can fire again.

**Spending limits.** The user never sets a budget, because the whole quota policy is one line: unattended work may spend up to the pro-rated share of the account's week that has elapsed, rising continuously with the clock. There is nothing to configure — the week is read from the account itself. Two properties fall out: nothing is left on the floor (the boundary reaches the full allowance exactly as the week resets), and background work cannot starve the user (unattended work stands down past the boundary). A slider moves that stand-down line for unattended work — by default it sits just past the boundary, and it is re-read live, so raising it takes effect without a restart; work the user asks for is never gated on quota at all. The two directions fail differently on purpose: no readable quota means unattended work does not start, while user-requested work carries on. The gate is on *starting*, and only on starting: an agent already going is never interrupted to economise — by then the tokens are spent, the work is half-done, and what is saved is the cheap part while what is lost is the expensive part.

**Surfaces.** One daemon per machine serves the dashboard, and everything the user sees in it is read from the files agents write. Non-local binds demand a shared token, because a daemon that spawns processes on a reachable port is remote code execution. When the user targets a saved remote device, the local daemon — never the browser — talks to the device's daemon and streams its events back over the local origin. The device's token is saved only in the user's own browser and handed to the local daemon per call. An agent can also run elsewhere: on a Claude cloud session (fire-and-forget: it opens its own PR), or on GitHub Actions (dispatch, poll, read back the uploaded transcript; continuity between turns is the branch the previous turn pushed). A browser extension inside the user's own claude.ai tab bridges cloud sessions back, so a question a cloud agent parks on becomes a dashboard card. An agent can launch a real Chrome that both it and a watching user attach to at once; when it hits a login wall, captcha, or 2FA it parks on a gate and hands the browser over — it never types a password. On Discord, notification watchers post agent activity and what needs a human; Discord is a way out, not a way in.

**What lands in git.** One record of what happened, kept in git on the framework's own data branch (`tf-data`) where the user can always find it: each agent's own event log, archived at close under a per-user directory keyed by the git identity — so cleaning the repo cannot erase the past, and two people on one repo do not conflict. Tickets — `tickets/<DATE>_<SLUG>.md`, the human-facing roadmap, with optional plan and claim siblings, parsed tolerantly. And the queue file. Every one of these writes goes through the same serialized sync-apply-commit-push cycle, so machines converge instead of clobbering each other.

**Prompts and presets.** The user can read precisely what an agent ran under, because one assembly path composes the system prompt for every agent — the built-in protocol, the extra protocol each capability brings, the user's own system file, and the picked context — and the exact composed text is recorded. Two switches dial the wrapping down: *vanilla* drops the enhanced prompt while keeping the framework integration, and *transparent* is the master off-switch — no framework channel at all, the CLI raw. Presets (triage, research, security audit, drain-the-queue, …) are one catalog with prompt text authored as prose; custom presets save to either the user tier (follows the person, private) or the project tier (travels with the repo, shared). A per-repo config file (`the-framework.yml`) records the handoff rung and the two switches a project works under, resolved layer over layer.

## Rationales

- **One recorded PR number.** The PR number is recorded on the agent the moment one is opened, so every surface reads the same number instead of re-deriving it and disagreeing.
- **Publishing rungs nest.** Because each publishing rung includes the ones below it, a PR always implies a push — no combination of switches can contradict itself.
- **One opening path for builds and verbatim prompts.** Two orchestrators would drift apart; the only real differences are which prompt opens the agent and whether its backlog is worked afterwards.
- **Removal asks one question: is the work safe yet?** How an agent ended has several answers, and none of them bears on whether its work is recoverable.
- **The queue file is the record.** A claim reassembled at read time from agent records, PRs, and other machines' diffs can disagree with itself; the file cannot.
- **Two prompt switches, not modes.** Vanilla and transparent compose independently; a catalog of named modes multiplies instead.

## Glossary

- **agent** — one task worked by one spawned run of the driver, streaming events as it goes; the unit that is watched, steered, published, retried, and archived.
- **driver** — the coding-agent CLI that does the work (Claude Code today, Codex too); swappable per agent.
- **location** — where an agent executes: the local machine, a saved remote device, a GitHub Actions runner, or a Claude cloud session.
- **attended / unattended** — whether a human is expected at the keyboard: an attended agent parks on its questions; an unattended one takes the recommended answer and carries on.
- **composer** — the dashboard's prompt box: type a prompt or pick a preset to start an agent, or send the next message to a live one.
- **gate** — a question an agent parks on, shaped as options; an option can be marked to stop the agent rather than resume it.
- **ticket** — a proposal for a human to accept, kept as a file under `tickets/`.
- **queue entry** — one item of confirmed work in the queue file `TODO_AGENTS.md`, kept on the framework's data branch.
- **routine** — a recurring unattended job the daemon fires on its own — the queue drain, the ticket-refill rotation, the maintenance sweep; each can be switched off individually, and "Run now" fires one by hand.
- **preset** — a cataloged prompt that starts an unattended agent (triage, research, security audit, …).
- **empty agent** — an agent whose run left no commits (or only bookkeeping changes); it publishes nothing.
- **handoff** — how far a finished agent publishes its work: the ladder keep-it-local → push → open a PR → merge, where each rung includes the ones below it; unset means a PR.
- **quota week** — the subscription's own weekly usage window, read from the account's quota readout; unattended spending is measured against the share of it that has elapsed.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
