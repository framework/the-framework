The driver seam, as the npm package `agent-driver`: The Framework never calls a model of its own — it wraps a coding-agent CLI as a black box, and this package is that wrapper, published on its own because every product that drives a coding agent needs the same thing. A driver is started once per agent, bound to the agent's workspace; each prompt lets the wrapped CLI's own loop run one full turn on the user's own subscription, and The Framework gates on outcomes — the turn's final message, the code produced, the exit — never on the agent's individual tool calls.

## User story

- The user picks which coding-agent CLI does the work — Claude Code (`claude`) or Codex (`codex`) — and the run target: this device, a GitHub Actions runner, or a Claude Code cloud session.
- The user watches an agent live on the dashboard: its streamed text, which tools it reached for, its final message, what the turn spent.
- The user clicks Stop, or the daemon dies hard; no agent process keeps burning CPU afterwards.
- Unattended work stands down at the quota boundary, which needs an honest reading of where the account's quota stands.
- The whole product can be demoed and tested offline, with no CLI installed and no model.

## Glossary

- **turn** — one prompt to the wrapped CLI: the CLI's own loop runs to completion, and the turn resolves with the CLI's final message, plus the CLI's session id and the turn's usage when the CLI reports them.
- **framing** — the role text a driver delivers as the wrapped CLI's system prompt: fixed for the agent when the driver starts, optionally extended per turn.

## Business logic — TL;DR

- **A black box, gated on outcomes** - drive by prompting, verify by result; a crashed turn never passes as a finished one, and the wrapped CLI's internal loop stays untouched and swappable.
- **One seam, five implementations** - Claude Code locally, Codex locally, a GitHub Actions workflow run per turn, and the scripted fake driver ship in the package; The Framework's own hand-off to a Claude Code cloud session (the `web` run target) implements the same contract from outside it — the proof that the contract is enough for a third party.
- **Bring your own subscription** - every driver runs on the user's own account and auth; The Framework holds no model API key and never reads the user's credentials.
- **Progress is visible, never load-bearing** - drivers stream progress events for the dashboard; control flow never branches on them.
- **No stray processes** - each spawned CLI runs as its own process group, stopped as a whole tree and reaped even on a hard daemon exit.

## Business logic

### A black box, gated on outcomes

#### User story

The user trusts The Framework to run agents unattended, so a turn that actually failed must never be treated as finished work.

#### Business logic

A driver does four things: start bound to a workspace, prompt for a turn, read a file the agent produced, and tear down. Everything else — which tools the CLI used, how it looped — stays inside the wrapped CLI. Verification happens on the outcome: the turn's final message, the code in the workspace (or on the branch a remote turn pushed), and the CLI's exit. A CLI that exits non-zero fails its turn even when it streamed text first.

#### Rationale

Gating on individual tool calls would couple The Framework to each CLI's internals and break the subscription-auth story. Keeping the seam at the code and the outcome is what lets a second coding-agent CLI slot in behind the same four moves.

### One seam, five implementations

#### User story

The user picks the driver and the run target; everything above the seam behaves identically.

#### Business logic

Claude Code local and Codex each spawn their CLI afresh per turn and share one process engine — spawn in an own process group, prompt over stdin, stream the output through the CLI's own dialect, gate on the exit — differing only in command line and output dialect. The `actions` implementation runs each turn as a GitHub Actions workflow run, with continuity carried by the branch the previous run pushed. The fake driver replays scripted turns in memory for tests and offline demo runs. The `web` run target's implementation lives in The Framework, not here: it hands the whole task to a cloud session on claude.ai — hands-off, exactly one hand-off for the agent's life — and needs The Framework's daemon and browser bridge to do it. Each implementation carries a stable implementation id (`claude-code`, `codex`, `claude-web`, `github-actions`, `fake`), the set fixed by the package; one driver has an implementation per place it can run, and the product maps the id back to the user's driver choice.

### Bring your own subscription

#### User story

The user already pays for Claude or ChatGPT; The Framework must add no separate model bill and never handle their credentials.

#### Business logic

Claude Code runs on the user's Claude subscription and Codex on their ChatGPT subscription; the CLI authenticates itself, so The Framework never reads or holds a token. A workflow run authenticates with an OAuth token the repo holds, minted by the user's own `claude setup-token`. What a turn spent is reported as usage (tokens always, a price only when the CLI prices its turns); where the account's quota stands is a separate account-wide read that only the Claude Code driver can answer — a driver that cannot answer omits the ability rather than fake a number.

### Progress is visible, never load-bearing

#### User story

The user follows an agent on the dashboard as it works.

#### Business logic

While a turn runs, a driver streams progress events: the prompt started, the CLI announced its session id, a chunk of text, a tool was used (its name only, never the arguments), the turn settled, where the account stands against its rate limit, an error, or a notice about something the driver worked around. Every surface renders them; nothing gates on them, and a listener that throws never breaks the agent.

### No stray processes

#### User story

The user clicks Stop — or the daemon crashes — and expects a quiet machine.

#### Business logic

A wrapped CLI spawns a deep subtree (workers, shell tool calls, MCP servers); stopping only the top process orphans the rest, which keeps burning CPU. Every long-lived child therefore runs as its own process-group leader and is stopped as a whole group — politely first, forcibly after a grace window — and every live child is registered so that even a hard daemon exit reaps every agent's tree on the way out.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
