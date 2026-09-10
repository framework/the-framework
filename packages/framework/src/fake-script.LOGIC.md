The scripted offline demo agent [1]: a fake driver [2] whose turns [3] play out building "A paginated orders page backed by an orders table, with sign-in." with no coding agent [4] and no model, so the whole flow — events, spend, gates [5], the handoff — runs and can be demonstrated offline, driven through the same driver seam a real coding agent is.

## Context

**User story**: the user (or a test) starts an agent with the `fake` driver implementation and watches a plausible agent build an orders app in the dashboard or the terminal; with one environment variable the demo instead stops to ask a question, so the gate cards can be seen and answered offline.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends.
[2] driver: a coding agent wrapped as a black box: start it in a directory, prompt it for one turn, stream what it does, resume it later. The driver implementations are `claude-code`, `codex`, `github-actions`, `claude-web` and `fake`.
[3] turn: one prompt sent to the driver; the coding agent's own loop runs to completion and answers with a final message.
[4] coding agent: the CLI doing the actual work: Claude Code or Codex.
[5] gate: a question with options at which an agent stops and waits for an answer: it emits the question in its turn's final message, the dashboard shows it as a card, and the answer re-prompts the agent. When nobody can answer, the recommended option is taken.
[6] pick: the answer to a gate: the option or options chosen, by the user or automatically.
[7] driver session: the coding agent's own conversation for one agent, which the driver can resume by its session id.

## Business logic — TL;DR

- **The default demo is one build turn** - the build answers that it built the orders app, shows three tool actions and reports a small spend, and that turn is the whole agent.
- **Three variants stop to ask** - `FRAMEWORK_FAKE_AWAIT=choices|multiselect|confirmation` makes the build turn end on a gate (a single choice, a checklist, or a plan approval), and a second turn answers once the pick [6] arrives.
- **An unknown variant is the default** - any other value plays the plain demo.

## Business logic

### The default demo is one build turn

#### Context

**Business logic story**: with no preset and no serve configuration nothing reviews the build, so the build turn is the entire agent.

#### Business logic

The script is one turn [3]: the final message "Built the orders app: an orders schema and migration, a paginated /orders page, and a sign-in stub.", preceded by three tool actions (two file writes and one shell command) and reporting a plausible per-turn usage — US$0.02, 1,800 input tokens, 600 output tokens, 12,000 cache-read tokens, 800 cache-creation tokens — so the demo shows spend accumulating. The driver session [7] reports the id `fake-orders-app`. The fake driver in the `agent-driver` package repeats the last scripted turn once the script is exhausted, so a longer agent [1] is never starved.

### Three variants stop to ask

#### Context

**User story**: the gate [5] cards (a single choice, a checklist with defaults, a plan approval) can be seen and answered offline. The dashboard must be on, so that someone can pick or the recommended option is taken.

#### Business logic

The environment variable `FRAMEWORK_FAKE_AWAIT` selects a variant whose build turn [3] ends on a gate [5]:

- `choices`: "Which auth approach for the orders page?", between "Session cookies" ("simple, server-side", the recommended option) and "JWT" ("stateless, more moving parts"), after one file read.
- `multiselect`: the checklist "Which problems should I deep-dive for alternatives?" over "auth model" ("rated 3/10", pre-checked), "pagination" ("rated 7/10") and "orders schema" ("rated 2/10", pre-checked), after a read and a search.
- `confirmation`: the plan approval "Approve the plan for the orders app?" about the file `PLAN_fake-orders-app.agent.md`, between "Approve" (recommended) and "Decline", which is marked to stop the agent [1] rather than resume it, after one file write.

The Framework shows the gate and waits; when the pick [6] arrives it re-prompts, and the second scripted turn answers "Applied your answer and finished building the orders app." with two more actions and the same usage. Nothing reviews after it, so the agent ends there.

### An unknown variant is the default

#### Context

See `## Context`.

#### Business logic

A value of `FRAMEWORK_FAKE_AWAIT` that names no variant, or no variable at all, plays the plain one-turn demo.
