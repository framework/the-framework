The daemon's [1] dashboard-serving side: the one HTTP server that hosts the browser app, every projection [2] behind what that app shows, and every action it fires. Nothing here draws anything — the sibling `dashboard/` directory at the package root does — and nothing here holds state of its own: every answer is computed from the files the daemon and its agents [3] write, so a page reloaded months later reads the same record.

## Context

**User story**: the user opens the dashboard and sees, without configuring anything, what every agent [3] on this machine is doing, what needs them, what their projects' tickets and agent queue [4] hold, and where the account's quota [5] stands — and from the same pages they answer an agent's question, chat with it, open or merge its pull request, or hand a task to another machine.

## Glossary

[1] the daemon: the one foreground process per machine: serves the dashboard and runs the sweeps; it starts no agent itself, it runs a project's start hook when the user presses Start.
[2] projection: an answer computed on demand from the files the daemon and its agents write, never from state kept in memory.
[3] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch, started through the project's start hook and shown in the dashboard from the files its tool keeps.
[4] the agent queue: every task agents will work next, in the order they will be taken, kept by a project package (the `queue` skill keeps it as `TODO_AGENTS.md` on the `agent-data` branch, in priority sections) and read through the command that package declares.
[5] quota: the account's subscription allowance, as the coding agent reports it: a session window and a quota week, each with a percentage used.
[6] handoff: what becomes of an agent's work once the agent has ended: its branch pushed, a pull request opened for it, the pull request merged. The agent does it itself; on a finished agent's page the "Open PR" and "Merge" buttons do it by hand.
[7] gate: a question with options an agent's turn ended on: the agent ends waiting for the answer, the dashboard shows the question as a card, and the answer resumes the agent.
[8] the Claude web bridge: the daemon's bridge endpoints plus the Chrome extension: carries the question a cloud session is parked on into the dashboard, and types the pick back into the session.
[9] relay: running an agent on a device — another machine's daemon the user saved by URL and token: the local daemon forwards the start, streams the events back and forwards steering, so the agent renders like a local one.
[10] intervention: something that needs a human — an open question, a pull request to review, unpushed commits — one of the two notification feeds. The other is activity: an agent started or finished.
[11] schedule switch: a person's choice, on one machine, whether a scheduled command (a line of the project's `agent-schedule.md`) runs there; the project's scheduler keeps it in its state file, and the schedule line is the default where nobody switched the command.
[12] widget: a browser module one of a project's packages brings to the dashboard, named by the package's `exports["./dashboard"]`; it adds pages to the dashboard and reads its data through its own package's command.

## Business logic — TL;DR

- **One server, four surfaces** (`server.ts`, `rpc-serve.ts`, `static.ts`, `widget-serve.ts`, `http.ts`, `content-type.ts`, `bundle.ts`, `index.ts`) - the built browser app as static files, the projects' widgets' [12] files beside it, the remote procedures with the live event stream behind a same-origin guard, and, on a bind that is not loopback, a shared token in front of everything; the relay [9] and the Claude web bridge [8] are the two surfaces reachable from elsewhere, each with a token of its own.
- **What the pages read** (`dashboard.ts`, `projects.ts`, `overview.ts`, `open-questions.ts`, `queue.ts`, `scheduler-state.ts`, `quota.ts`, `docs.ts`, `types.ts`) - the project list that survives a renamed directory, the cross-project Overview with its lanes (its tickets through the provider a project's package declares, `../store/tickets.ts`), every unanswered gate [7] across projects, the agent queue [4] as the browser needs it, each project's scheduler state as the scheduler's own file says it (with its scheduled commands and this machine's schedule switch [11] of each), the quota [5] panel, the documents shown beside an agent [3], and the vocabulary all of it is spoken in.
- **What an agent's checkout holds** (`file-diff.ts`, `file-read.ts`, `file-status.ts`, `git-status.ts`) - the changed files with their diffs, one file's content, and the branch's state, each capped and each refusing what falls outside the checkout.
- **Getting the work out** (`agent-handoff.ts`) - what a finished agent left on its branch, and the "Open PR" and "Merge" buttons: which pull request is the agent's, and when the branches provider is asked to publish or land it.
- **GitHub, once** (`gh.ts`, `github.ts`, `cache.ts`) - every GitHub fact the product reads and the one it writes go through the `gh` CLI in one place, behind a cache that collapses concurrent asks and serves a stale answer while it refreshes.
- **Telling the user** (`interventions.ts`, `activity.ts`, `keyed-watcher.ts`, `keys.ts`, `discord-webhook.ts`) - two feeds, what needs a human [10] and what merely happened, each announced once by identity rather than by count, to the browser and to Discord when the user asked for it.
- **The Claude web bridge** (`bridge-endpoints.ts`, `bridge-store.ts`, `bridge-starts.ts`, `bridge-sessions.ts`, `bridge-question.ts`) - the daemon's half of the bridge [8]: which cloud sessions the extension should serve, the questions it reports and the answers it collects, the sessions it must create, and how a bridged question becomes the same card a local agent's gate gets.
- **Agents on another machine** (`remote-run.ts`, `relay-endpoints.ts`) - both halves of the relay [9]: the local daemon that forwards a start and streams the events back, and the device's daemon that runs an ordinary local agent for it.
- **Work handed to the cloud** (`web-start-endpoints.ts`) - how an agent whose work leaves this machine asks for its cloud session and learns what became of it.
- **Talking to an agent** (`run-inbox.ts`) - a message or an answer goes to the agent's inbox while it works, else to the project's resume hook.
- **Opening things on this machine** (`open-in-app.ts`) - a project opened in the user's editor or file browser.
