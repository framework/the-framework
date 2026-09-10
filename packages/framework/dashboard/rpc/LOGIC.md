The browser's side of the daemon's call surface: one module of typed stubs per group of calls the daemon answers, mirroring `src/dashboard-rpc/` one to one, so that every page of the dashboard reaches the daemon through a stub that carries the daemon's own signature for that call and nothing is addressed by hand. The stubs hold no logic: what each call validates, refuses and answers is the daemon's, described beside `src/dashboard-rpc/`; how a call travels (by name, same origin, arguments and answer as JSON, a failed call thrown with the daemon's reason) is the transport's, in `lib/rpc.ts`.

## Context

**Business logic story**: the dashboard is a projection of the files the daemon and the agents [1] write, and every button on it is one call to the daemon. The dashboard and the daemon live in one package, so instead of a contract kept in sync by hand, each stub is declared against the implementation it calls: the daemon's modules are imported for their types only, which the build erases, so none of the daemon's code reaches the browser while every signature does.

**Problem**: a call renamed or re-shaped on the daemon's side and not in the browser is otherwise a request the daemon cannot answer, or an answer the page cannot read, and a page that breaks only when the user reaches that button.

## Glossary

[1] agent: The unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends. Started from the dashboard by the user, or by the daemon.
[2] preflight: The check that the chosen driver's coding agent can start an agent, run before a checkout is spent.
[3] driver: A coding agent wrapped as a black box: start it in a directory, prompt it for one turn, stream what it does, resume it later. The user's driver choice is `claude` or `codex`.
[4] checkout: An agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch.
[5] handoff: What happens to an agent's work when the agent ends, as one ladder of four levels: `local` (keep the work in its checkout), `push` (push its branch), `pr` (also open a pull request — the default), `merge` (also merge it).
[6] the Claude web bridge: The daemon's bridge endpoints plus the Chrome extension: carries the question a cloud session is parked on into the dashboard, and types the pick back into the session. The bridge browser is the Chrome for Testing the daemon runs for it.
[7] event / event stream: Everything an agent does, one event per line appended to `.the-framework/events.jsonl` in its checkout; every surface (dashboard, terminal, archive, run) is a projection of it.
[8] pick: The answer to a gate: the option or options chosen, by the user or automatically.
[9] the agent queue: `TODO_AGENTS.md` on the `agent-data` branch: every task agents will work next, in priority sections, worked top-down.
[10] preferences: The user's dashboard settings, kept in the registry (`~/.the-framework.json`, which also lists the projects).
[11] quota: The account's subscription allowance, as the coding agent reports it: a session window and a quota week, each with a percentage used.
[12] quota boundary: The share of the quota week that may be spent by now, rising with the clock; unattended work stands down past it, work a human asked for never does.
[13] Auto PM: The daemon's unattended product management: drain the agent queue, and refill it by running the routines.
[14] sweep: A background job the daemon runs on its clock: Auto PM, the CI watch, the notification watchers, the sweep that reclaims checkouts, the branch-links sweep, the cloud scratch sweep, cloud work adoption.
[15] device: Another machine's daemon the user saved by URL and token, to run agents on it from this dashboard.

## Business logic — TL;DR

- **Typed against the daemon** - every stub is declared with the daemon's own signature for the call it makes, so a call renamed or re-shaped on the daemon's side is a type error in the dashboard's build rather than a broken page.
- **Projects** (`projects.ts`) - the registered projects with what the daemon finds wrong with each, adding one, picking its directory on the daemon's machine, the onboarding suggestion, whether the repository allows auto-merge, and the preflight [2] of the chosen driver [3].
- **Reads** (`reads.ts`) - everything the pages read about a project or an agent [1]: the agent history and one agent's replay, documents and tickets, the cross-project rollups, a checkout's [4] files and diffs, its git status and what the agent's handoff [5] left behind, the project's `SYSTEM.md`, and the Claude web bridge's [6] state.
- **The live event stream** (`events.ts`) - the subscription to one agent's events [7] as they are written, re-exported from the transport because a stream is not a call.
- **Actions** (`control.ts`) - everything the user does to an agent or a project: steering (stop, pick [8], message, handoff), the bridge's answer and its browser, starting an agent, push, pull request and merge, removing a checkout or deleting an agent, opening a checkout in an app, and the ticket and agent queue [9] actions.
- **Preferences** (`preferences.ts`) - reading, replacing or patching the preferences [10], a project's shared custom presets, the installed editors, and whether the Discord credentials are set and saving them.
- **Quota and Auto PM** (`quota.ts`) - the quota [11] reading against the quota boundary [12], what Auto PM [13] last decided, and an Auto PM sweep [14] run on demand.
- **Devices** (`devices.ts`) - whether each saved device [15] answers, checked by the daemon with the token the browser holds and never keeps.

## Business logic

### Typed against the daemon

#### Context

See `## Context`.

#### Business logic

Each stub names the call it makes and is declared with the daemon's own function signature for that call, imported as a type from the module in `src/dashboard-rpc/` that implements it. A call the daemon no longer exports under that name, or whose arguments or answer changed, fails the dashboard's type check, so the mismatch is found at build time and never as a request the daemon cannot answer. The stub's file and position carry no meaning: the daemon answers a call by the name it exports it under (the table is `src/dashboard-rpc/index.ts`'s), and that same name is what the stub sends. Because the daemon's modules are imported for their types only, the browser bundle contains none of the daemon's code. The live event stream [7] is the one thing in this directory that is not a stub: it is a subscription with its own client in `lib/rpc.ts`, re-exported here so that everything the dashboard reaches the daemon for sits in one directory.
