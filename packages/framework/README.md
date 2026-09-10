# framework

**The Framework** — autonomous AI programming: humans make the important decisions
while coding agents run unattended.

You register your repos. From then on, agents work on them: each agent gets a throwaway
checkout of the repo, does its work, and hands the result off as a pull request. Your own
checkout is never touched.

```bash
npm i -g framework

cd ~/code/my-repo
the-framework      # serves the dashboard at http://127.0.0.1:4200
```

## The CLI is four options and no verbs

```
the-framework          Serve the dashboard in the foreground. Ctrl+C closes it and
                       every agent it is running.

  --port <n>           Dashboard port (default: 4200).
  --host <addr>        Bind address (default: 127.0.0.1). A non-loopback address
                       exposes the dashboard to your network and generates a shared
                       token; the printed URL carries it, and any request without it
                       gets 401. Exposing a process spawner to the network is a
                       security decision.
  -h, --help           Show this help.
  -v, --version        Print the version.
```

Everything else is the dashboard. It is the product's user interface, and where a
agent's prompt, its options, its coding agent and its checkout are chosen. The dashboard
spawns each agent as its own process, handing it one JSON spec rather than a
command line — so an agent's configuration is never also a human-facing flag
surface.

## How it works

The Framework does not run its own agent, and never makes its own model calls. It
drives a coding agent as a **black box**: it sends a prompt, lets the agent's own
loop run a full turn, then reads the code and the turn's final message. It gates on
outcomes, never on the agent's individual tool calls — so the wrapped agent keeps
its own subscription auth and stays swappable behind the driver seam
([`Driver`](../agent-driver/src/types.ts) in the `agent-driver` package; Claude Code and Codex today).

Everything the framework learns from a turn, it learns by parsing that turn's final
message: the session name the agent gave its work (the branch is renamed to match), the
views it wants shown, the ready-for-merge signal, and the questions it stops to ask.

- **One daemon per machine.** Running the CLI in any registered repo finds it. It
  serves the dashboard, spawns agents, and runs the background work — the idle
  sweeps, notifications, chat, the CI watch.
- **An agent is one task being worked**, in its own checkout on its own
  branch. It streams what it does as events; you can watch, answer its questions,
  and chat with it live — or not be there at all.
- **Work leaves as a pull request.** When an agent ends with real work, the work is
  pushed and a pull request opened. An agent that committed nothing publishes nothing.
- **When nobody is around**, the daemon plays product manager: it drains the
  confirmed-task queue, refills it by triaging and planning tickets, keeps CI green
  on the PRs it opened, and merges them once checks pass — all bounded by the
  account's own quota week.

## Layout

- `src/` — the CLI, the daemon, the agent lifecycle, git handoff, autonomy, and
  the chat surfaces. Node only.
- `dashboard/` — the browser app: a Vite SPA the daemon serves as static files,
  talking back over plain HTTP. See [its README](./dashboard/README.md).

A `LOGIC.md` sits beside every source file and directory, describing the business
logic it implements, in prose written to be read instead of the code.
[`LOGIC.md`](./LOGIC.md) at the package root is the place to start.

## Status

Pre-release, published from the `0.x` line. There are no users to keep compatible,
so the code prefers being clean over being backward-compatible.
