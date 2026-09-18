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
the-framework          Serve the dashboard in the foreground. Ctrl+C closes it; the
                       agents it started go on to their own end.

  --port <n>           Dashboard port (default: 4200).
  --host <addr>        Bind address (default: 127.0.0.1). A non-loopback address
                       exposes the dashboard to your network and generates a shared
                       token; the printed URL carries it, and any request without it
                       gets 401. Exposing the daemon to the network is a security
                       decision.
  -h, --help           Show this help.
  -v, --version        Print the version.
```

Everything else is the dashboard. It is the product's user interface, and where an agent's
prompt, its coding agent and its model are chosen. There is no option that begins an agent:
the command cannot start one at all.

## How it works

The Framework runs no coding agent, makes no model call, and names no tool. Starting an
agent is running **one shell line the project itself names** — its `start` hook, in the
project's own `.the-framework/hooks.yml`:

```yaml
start: npx agent-scheduler run --detach "$PROMPT" ${DRIVER:+--driver "$DRIVER"}
resume: npx agent-scheduler run --detach --resume "$RUN_ID" ${TEXT:+"$TEXT"} ${ANSWER:+--answer "$ANSWER"}
check: npx agent-scheduler check ${DRIVER:+--driver "$DRIVER"}
offset: npx agent-scheduler offset -- "$POINTS"
```

The line is given the prompt and the user's picks in its environment, and answers one JSON
document whose `id` names the agent it began. From there the agent belongs to whatever that
line started. A project with no `start` line cannot start an agent from the dashboard, and the
dashboard says so. `npx agent-scheduler init`, run in the project, writes the lines above (and
the scheduler's `open` and `close` lines) into the file, keeping any line already there.

The `check` line is what the launcher runs before a Start, with the picked coding agent in
`DRIVER`: it answers one JSON document with `problems` (a coding agent not installed or logged
out: said in red) and `warnings` (said in amber), each line naming its own fix. A project
with no `check` line shows nothing there.

The `offset` line is how the usage panel's slider (and Settings → Automation → Spend offset)
reaches the scheduler: it runs in every project that has it, with the percentage points in
`POINTS` — how far past the quota boundary the project's scheduler may start unattended work.
The panel reads the value back from the schedulers' own state. The `--` keeps a negative value
from being read as an option.

The dashboard is a **projection of the agent's own files**. The agent's tool keeps the
agent's card (`<id>.json`) and diary (`<id>.jsonl`) under `.the-framework/` in the agent's
checkout, and copies both onto the project's `agent-data` branch when the agent ends.
Everything the dashboard shows — live, and months later — it reads from those two files.

Steering goes back the same way, never over a channel:

- **What you say to a working agent** becomes a line in its `inbox.jsonl`, which the agent's
  tool reads when a turn ends.
- **What you say to an agent that has ended** — your words, or your answer to the question it
  stopped on — runs the project's `resume` hook, which continues that same agent.
- **Stop** is a signal to the process the agent's card names.

So a working agent and a finished one render identically, and an agent on another machine
needs only its lines carried home.

- **One daemon per machine.** Running the CLI in any registered repo finds it. It serves
  the dashboard, runs each project's hooks, and runs the background work — the notifications
  and the cloud sweeps.
- **An agent is one task being worked**, in its own checkout on its own branch. You can watch
  it, answer its questions, and say more to it — or not be there at all.
- **What you can ask for is your project's own commands**: its skills, read from
  `.claude/skills/` and `.agents/skills/`, plus free text and the prompts you save. The
  Framework ships no prompt text.
- **Work leaves as a pull request**, opened by the agent itself. An agent that committed
  nothing publishes nothing.

## Layout

- `src/` — the CLI, the daemon, the hooks, the reading of a project's agents, and the server
  side of the dashboard. Node only.
- `dashboard/` — the browser app: a Vite SPA the daemon serves as static files,
  talking back over plain HTTP. See [its README](./dashboard/README.md).

A `LOGIC.md` sits beside every source file and directory, describing the business
logic it implements, in prose written to be read instead of the code.
[`LOGIC.md`](./LOGIC.md) at the package root is the place to start.

## Status

Pre-release, published from the `0.x` line. There are no users to keep compatible,
so the code prefers being clean over being backward-compatible.
