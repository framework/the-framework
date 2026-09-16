The world the backend end-to-end stories run in: one daemon per story, its business logic wired exactly as the real daemon wires it, on throwaway state, with agents [1] spawned as real child processes through `fake-agent-bin.ts` so the whole production agent lifecycle runs offline against a scripted coding agent [2].

## Glossary

[1] agent: the unit of work: one task worked by a coding agent under The Framework's control, in its own checkout, on its own branch, streaming events, handed off when it ends.
[2] coding agent: the CLI doing the actual work: Claude Code or Codex.
[3] registry: `~/.the-framework.json`, the file that lists the projects and keeps the user's preferences.
[4] preferences: the user's dashboard settings, kept in the registry.
[5] relay: running an agent on a device: the local daemon forwards the start, streams the events back and forwards steering, so the agent renders like a local one.
[6] quota: the account's subscription allowance, as the coding agent reports it: a session window and a quota week, each with a percentage used.
[7] quota boundary: the share of the quota week that may be spent by now, rising with the clock; unattended work stands down past it, work a human asked for never does.
[8] bridge browser: the Chrome for Testing the daemon runs for the Claude web bridge.
[9] preflight: the check that the chosen driver's coding agent can start an agent, run before a checkout is spent.
[10] the agent queue: `TODO_AGENTS.md` on the `agent-data` branch: every task agents will work next, in priority sections, worked top-down.
[11] the `agent-data` branch: the branch of a project's repository used as a file store for everything agents share: tickets, the agent queue, the runs.
[12] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch.
[13] reclaim: removing a finished agent's checkout once its work is on the remote.
[14] launcher: the Start form on a project's own page in the dashboard.
[15] event stream: everything an agent does, one event per line appended to `.the-framework/events.jsonl` in its checkout; every surface (dashboard, terminal, archive, run) is a projection of it.
[16] agent spec: the one JSON file the daemon hands a spawned agent process with its whole configuration.
[17] turn: one prompt sent to the driver; the coding agent's own loop runs to completion and answers with a final message.
[18] gate: a question with options at which an agent stops and waits for an answer: it emits the question in its turn's final message, the dashboard shows it as a card, and the answer re-prompts the agent.

## Business logic — TL;DR

- **A daemon on throwaway state** - each story stands up its own home directory and its own configuration home, where the registry [3], the preferences [4] and the daemon's state live, so story files running side by side never see each other's projects in the cross-project reads; closing the world stops the agents [1] it spawned the way daemon shutdown does, waits out each agent's teardown under the agent's own lock, and removes everything it made.
- **The dashboard's context, as the daemon wires it** - every dashboard RPC a story calls addresses this world: starting agents, adding projects, the events source, relayed [5] agents, the preferences and the Discord credentials from the registry; what the daemon keeps live is replaced by values the story sets: the quota [6] reading (with the quota boundary [7] read off the same reading), no project errors, and a bridge browser [8] that is off; the driver preflight [9] always passes, since no coding agent [2] is installed.
- **Projects are real repositories** - a project is a real git repository with an initial commit and a bare `origin`, registered through the same Add-project RPC as the dashboard's dialog; the tickets and the agent queue [10] a story seeds land on the `agent-data` branch [11], where the product reads them, never in the working tree; the `origin` is there because a checkout [12] is reclaimed [13] only once its work is on the remote, and a fixture with nowhere to push would keep every checkout forever.
- **Agents are started and observed as the dashboard does it** - an agent starts through the same Start RPC as the launcher [14], with the prompt, the kind and the options the story gives; a story waits for a status through the same agents list the sidebar reads; waits for the checkout to be retired, since an agent's record flips to done before teardown archives its checkout and acting on the agent in that window is what a user does by clicking Push the instant it finishes; and follows the agent's event stream [15] through the same relocating tail the dashboard's live feed uses, so the final events are seen even after teardown moves the stream into the agent's record; the agent spec [16] of every agent the world spawned can be read back, oldest first.
- **A scripted gate** - a story can have the fake coding agent's first turn [17] stop at a gate [18] of one of three shapes (a single choice, a multi-select checklist, a plan confirmation) for the agents started inside a block; the switch is removed afterwards so the next story's agents do not inherit it.
