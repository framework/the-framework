The browser's side of the daemon's call surface: one module of typed stubs per group of calls the daemon answers, mirroring `src/dashboard-rpc/` one to one, so that every page of the dashboard reaches the daemon through a stub that carries the daemon's own signature for that call and nothing is addressed by hand. The stubs hold no logic: what each call validates, refuses and answers is the daemon's, described beside `src/dashboard-rpc/`; how a call travels (by name, same origin, arguments and answer as JSON, a failed call thrown with the daemon's reason) is the transport's, in `lib/rpc.ts`.

## Context

**Business logic story**: the dashboard is a projection of the files the daemon and the agents [1] write, and every button on it is one call to the daemon. The dashboard and the daemon live in one package, so instead of a contract kept in sync by hand, each stub is declared against the implementation it calls: the daemon's modules are imported for their types only, which the build erases, so none of the daemon's code reaches the browser while every signature does.

**Problem**: a call renamed or re-shaped on the daemon's side and not in the browser is otherwise a request the daemon cannot answer, or an answer the page cannot read, and a page that breaks only when the user reaches that button.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch, started through the project's start hook and shown in the dashboard from the files its tool keeps.
[2] command: one of the project's skills written to be run by a person, never picked up by the coding agent on its own (its front matter says `disable-model-invocation: true`), read off the folders the coding agents read them from (`.claude/skills/`, `.agents/skills/`); typed as `/<name>`, optionally followed by an argument.
[3] start hook: The one shell line under `start:` in the project's `.the-framework/hooks.yml`, which starts an agent and answers its id. The resume hook, under `resume:`, continues an ended agent.
[4] checkout: An agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch.
[5] next step: What a person can do with an ended agent's work from the dashboard: open a pull request for its branch, or merge the pull request it has.
[6] the Claude web bridge: The daemon's bridge endpoints plus the Chrome extension: carries the question a cloud session is parked on into the dashboard, and types the pick back into the session. The bridge browser is the Chrome for Testing the daemon runs for it.
[7] event / event stream: Everything an agent does, in order, read off the agent's diary: the file its tool writes one line at a time, in the agent's checkout while it has one and on the data branch once it is recorded.
[8] pick: The answer to a question an agent ended on: the option or options the user chose.
[9] the agent queue: `TODO_AGENTS.md` on the `agent-data` branch: every task agents will work next, in priority sections, worked top-down.
[10] preferences: The user's dashboard settings, kept in the registry (`~/.the-framework.json`, which also lists the projects).
[11] quota: The account's subscription allowance, as the coding agent reports it: a session window and a quota week, each with a percentage used.
[12] quota boundary: The share of the quota week that may be spent by now, rising with the clock; unattended work stands down past it, work a human asked for never does.
[13] device: Another machine's daemon the user saved by URL and token, to run agents on it from this dashboard.
[14] spend offset: the user's adjustment of the quota boundary, in percentage points of the week: how far past it unattended work may start. Each project's scheduler holds its own, as `spendOffset` in its state file. The offset hook, under `offset:` in `.the-framework/hooks.yml`, sets it.
[15] schedule switch: a person's choice, on one machine, whether a scheduled command (a line of the project's `agent-schedule.md`) runs there; the project's scheduler keeps it in its state file. The switch hook, under `switch:` in `.the-framework/hooks.yml`, sets it.
[16] widget: a browser module one of a project's packages brings to the dashboard, named by the package's `exports["./dashboard"]`; it adds pages to the dashboard and reads its data through its own package's command.

## Business logic — TL;DR

- **Typed against the daemon** - every stub is declared with the daemon's own signature for the call it makes, so a call renamed or re-shaped on the daemon's side is a type error in the dashboard's build rather than a broken page.
- **Projects** (`projects.ts`) - the registered projects with what the daemon finds wrong with each, adding one, picking its directory on the daemon's machine, the onboarding suggestion, and what the launcher offers for a project: its commands [2] and whether it has a start hook [3]; and a scheduled command's schedule switch [15], set through the project's switch hook.
- **Reads** (`reads.ts`) - everything the pages read about a project or an agent [1]: the agent history and one agent's replay, documents and tickets, the cross-project rollups, a checkout's [4] files and diffs, its git status and what the agent left behind, which decides its next step [5], and the Claude web bridge's [6] state.
- **The live event stream** (`events.ts`) - the subscription to one agent's events [7] as they are written, re-exported from the transport because a stream is not a call.
- **Actions** (`control.ts`) - everything the user does to an agent or a project: what the user says to an agent (stop, pick [8], message), the bridge's answer and its browser, starting an agent, pull request and merge, removing a checkout or deleting an agent, opening a checkout in an app, and the ticket and agent queue [9] actions.
- **Preferences** (`preferences.ts`) - reading, replacing or patching the preferences [10], a project's shared saved prompts, the installed editors, and whether the Discord credentials are set and saving them.
- **Quota** (`quota.ts`) - the quota [11] reading against the quota boundary [12], and setting the spend offset [14] through every project's offset hook.
- **Devices** (`devices.ts`) - whether each saved device [13] answers, checked by the daemon with the token the browser holds and never keeps.
- **Widgets** (`widgets.ts`) - which widgets [16] the registered projects bring, and a widget running one of its own package's commands in one project.

## Business logic

### Typed against the daemon

#### Context

See `## Context`.

#### Business logic

Each stub names the call it makes and is declared with the daemon's own function signature for that call, imported as a type from the module in `src/dashboard-rpc/` that implements it. A call the daemon no longer exports under that name, or whose arguments or answer changed, fails the dashboard's type check, so the mismatch is found at build time and never as a request the daemon cannot answer. The stub's file and position carry no meaning: the daemon answers a call by the name it exports it under (the table is `src/dashboard-rpc/index.ts`'s), and that same name is what the stub sends. Because the daemon's modules are imported for their types only, the browser bundle contains none of the daemon's code. The live event stream [7] is the one thing in this directory that is not a stub: it is a subscription with its own client in `lib/rpc.ts`, re-exported here so that everything the dashboard reaches the daemon for sits in one directory.
