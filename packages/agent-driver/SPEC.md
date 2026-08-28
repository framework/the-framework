The npm package `agent-driver`: a coding-agent CLI wrapped as a black box, for any product that drives coding agents without calling a model of its own. A driver is started once per agent, bound to the agent's workspace; each prompt lets the wrapped CLI's own loop run one full turn on the user's own subscription, and the caller gates on outcomes — the turn's final message, the code produced, the exit — never on the agent's individual tool calls.

## User story

- The user picks which coding-agent CLI does the work — Claude Code (`claude`) or Codex (`codex`) — and where it runs: this device, a GitHub Actions runner, or a Claude Code cloud session.
- The user watches an agent live in the caller's UI: its streamed text, which tools it reached for, its final message, what the turn spent.
- The user clicks Stop, or the caller's process dies hard; no agent process keeps burning CPU afterwards.
- Unattended work stands down at the quota boundary, which needs an honest reading of where the account's quota stands.
- The whole product can be demoed and tested offline, with no CLI installed and no model.

## Glossary

- **caller** — the product that embeds the package and drives agents through it.
- **turn** — one prompt to the wrapped CLI: the CLI's own loop runs to completion, and the turn resolves with the CLI's final message, plus the CLI's session id and the turn's usage when the CLI reports them.
- **framing** — the role text a driver delivers as the wrapped CLI's system prompt: fixed for the agent when the driver starts, optionally extended per turn.
- **hand-off** — the caller giving a whole task to a coding-agent session that runs and pushes on its own, such as a Claude Code cloud session. Its **anchor** is the commit that session pushed; the caller recognises the session's branch afterwards by that commit's ancestry.

## Business logic — TL;DR

- **A black box, gated on outcomes** - drive by prompting, verify by result; a crashed turn never passes as a finished one, and the wrapped CLI's internal loop stays untouched and swappable.
- **One seam, four drivers in the box** - Claude Code locally, Codex locally, a GitHub Actions workflow run per turn, and the scripted fake driver ship in the package; the contract also fixes an id for a fifth implementation built outside it, a Claude Code cloud session — the proof that the contract is enough for a third party.
- **Bring your own subscription** - every driver runs on the user's own account and auth; the caller holds no model API key and never reads the user's credentials.
- **Progress is visible, never load-bearing** - drivers stream progress events for the caller's UI; control flow never branches on them.
- **No stray processes** - each spawned CLI runs as its own process group, stopped as a whole tree and reaped even on a hard exit of the calling process.

## Business logic

### A black box, gated on outcomes

#### User story

The user trusts the caller to run agents unattended, so a turn that actually failed must never be treated as finished work.

#### Business logic

A driver does four things: start bound to a workspace, prompt for a turn, read a file the agent produced, and tear down. Everything else — which tools the CLI used, how it looped — stays inside the wrapped CLI. Verification happens on the outcome: the turn's final message, the code in the workspace (or on the branch a remote turn pushed), and the CLI's exit. A CLI that exits non-zero fails its turn even when it streamed text first.

#### Rationale

Gating on individual tool calls would couple the caller to each CLI's internals and break the subscription-auth story. Keeping the seam at the code and the outcome is what lets a second coding-agent CLI slot in behind the same four moves.

### One seam, four drivers in the box

#### User story

The user picks the CLI and where it runs; everything above the seam behaves identically.

#### Business logic

Claude Code local and Codex each spawn their CLI afresh per turn and share one process engine — spawn in an own process group, prompt over stdin, stream the output through the CLI's own dialect, gate on the exit — differing only in command line and output dialect. The `actions` implementation runs each turn as a GitHub Actions workflow run, with continuity carried by the branch the previous run pushed. The fake driver replays scripted turns in memory for tests and offline demo runs. Each implementation carries a stable implementation id, and the contract fixes the set (`claude-code`, `codex`, `claude-web`, `github-actions`, `fake`): one CLI has an implementation per place it can run, and the caller maps the id back to the user's choice. `claude-web` is reserved for a driver built outside the package — one that hands the whole task to a Claude Code cloud session on claude.ai, which needs a browser the package does not have.

### Bring your own subscription

#### User story

The user already pays for Claude or ChatGPT; the caller must add no separate model bill and never handle their credentials.

#### Business logic

Claude Code runs on the user's Claude subscription and Codex on their ChatGPT subscription; the CLI authenticates itself, so the caller never reads or holds a token. A workflow run authenticates with an OAuth token the repo holds, minted by the user's own `claude setup-token`. What a turn spent is reported as usage (tokens always, a price only when the CLI prices its turns); where the account's quota stands is a separate account-wide read that only the Claude Code driver can answer — a driver that cannot answer omits the ability rather than fake a number.

### Progress is visible, never load-bearing

#### User story

The user follows an agent in the caller's UI as it works.

#### Business logic

While a turn runs, a driver streams progress events: the prompt started, the CLI announced its session id, a chunk of text, a tool was used (its name only, never the arguments), the turn settled, where the account stands against its rate limit, an error, or a notice about something the driver worked around. The caller renders them; nothing gates on them, and a listener that throws never breaks the agent.

### No stray processes

#### User story

The user clicks Stop — or the caller's process crashes — and expects a quiet machine.

#### Business logic

A wrapped CLI spawns a deep subtree (workers, shell tool calls, MCP servers); stopping only the top process orphans the rest, which keeps burning CPU. Every long-lived child therefore runs as its own process-group leader and is stopped as a whole group — politely first, forcibly after a grace window — and every live child is registered so that even a hard exit of the calling process reaps every agent's tree on the way out.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
