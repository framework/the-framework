Composes an agent's system channel — the built-in system prompt, the repo-context bullets, the sections an agent outside a checkout The Framework created needs, the user's own `SYSTEM.md`, and the emit protocols — at one assembly point every agent goes through, so no path can drift from another. Deliberately free of filesystem access: the dashboard renders the very same composition in the browser to show the whole prompt before an agent starts (reading `SYSTEM.md` off disk lives elsewhere and is handed in as plain text).

## User story

- The user wants to steer every agent in a repo with their own standing instructions, by committing a `SYSTEM.md` at the workspace root — without giving up the built-in prompt.
- The user turns the built-in prompt off (vanilla) to run agents on their own instructions only, or drops everything framework-authored (transparent) to get the raw wrapped CLI.
- The user picks in-context directories in the dashboard to narrow the focus of an agent that can reach every registered repo.
- The dashboard shows the exact system channel an agent will receive, before it starts.
- A hands-off agent has to land its own work, because nothing on this machine sees its workspace.
- A hands-off agent must not park a cloud session forever on a question nobody attached can answer — unless the Claude web bridge is on, in which case its questions do reach the user and it should ask them.

## Glossary

- **system channel** — everything the framework injects as the session's system prompt, as distinct from the user prompt that carries the task itself.
- **emit protocols** — the two framework-authored texts appended to the system channel that pin *how* the agent signals at a turn boundary: the await protocol (how to stop and ask an awaited choice, so a gate can be detected in the turn's final message) and the signal protocol (how to emit the non-blocking lifecycle signals — setSessionName(), setReadyForMerge(), markdown views, error reports, a pull-request description).

## Business logic — TL;DR

- **The built-in system prompt is a template in two halves** - the system half frames the session; the user-prompt half is the slot the user's prompt lands in. The boundary is fixed by the template itself, so a user prompt that contains the boundary heading can never move it.
- **The agent's repo context rides in the channel** - a `Context:` block lists the user's picked directories and then the framework's context docs, each with a one-line gloss; the two roadmap docs — the tickets and the agent queue — say they live on the `tickets` branch and send the agent to the `tickets` skill for them.
- **Composition is additive and ordered** - context first, then the built-in prompt, then — for an agent outside a checkout The Framework created — the two sections that have it branch, and read and write the tickets, with git itself, and then the user's `SYSTEM.md`; a repo can keep the built-in prompt *and* add its own, replace it, or leave both off.
- **Vanilla drops everything framework-authored except the emit protocols** - the built-in prompt, the context docs, and those two sections all go together; the user's own dirs and `SYSTEM.md` survive, and the emit protocols stay because they are the contract the dashboard's gates run on, not prompt content.
- **Transparent drops the whole channel** - no prompt, no docs, no protocols: the agent runs byte-identical to the raw wrapped CLI. It overrides every other option.
- **Per-agent capability sections** - an agent with a real browser attached is told so; a hands-off agent is told to land its own work; the signal protocol is always the last thing in the channel.

## Business logic

### The built-in system prompt and its two halves

#### User story

The user types one prompt; the agent must analyze it before coding — an ambiguous prompt becomes a ranked choice list, a large scope becomes a plan to approve, a very large one also spins off a backlog for the backlog loop — and the work must move onto its own `agent-<session name>` branch before the first change.

#### Business logic

The built-in system prompt is a template whose text lives in the package's `prompts/system_prompt.md`. It carries the analyze-the-prompt flow, the session-name step, the alternatives flow, and the after-changes steps; the workspace rules are the `branches` skill's. For an agent in a checkout The Framework created — a daemon-started agent on this machine, with `branches` on its PATH — the session-name step sends it to the `branches` skill, which the `skill-branches` package links into the checkout where the agent's harness looks for skills; nothing about the workspace rides in the channel. For any other agent (a terminal run in the user's own checkout, a GitHub Actions runner, a cloud session) the "Branch management" section is appended right after the built-in prompt, before the user's own system prompt: the fallback that has the agent create its `agent-<session name>` branch with git itself. It is framework-authored, so vanilla drops it with the built-in prompt — the session-name step is exactly what the vanilla follow-up must not run.

### The repo context, and reaching the tickets from outside a daemon-made checkout

#### User story

Every agent should start knowing what the repo has learned about itself — its goal, decisions, facts, insights, market research — and where the roadmap and the confirmed-task queue live, in a format it can actually follow.

#### Business logic

The context docs are the files the agent keeps in context, rendered as commented bullets under the `Context:` head: `knowledge-base/DECISIONS.md`, `GOAL.md`, `BUSINESS_LOGIC.md`, `knowledge-base/FACTS.md`, `knowledge-base/INSIGHTS.md`, `knowledge-base/MARKET_RESEARCH.md`, the `knowledge-base/**.md` catch-all, `tickets/**.md`, and `TODO_AGENTS.md`. A subset — the business-knowledge docs (`DECISIONS.md`, `FACTS.md`, `INSIGHTS.md`) — is what the agent also folds new knowledge back into at merge; the rest are read-only pointers. A repo's own `README.md` is deliberately left out: it already covers the overview.

Two of the docs are not the agent's to edit by hand — `tickets/**.md` and `TODO_AGENTS.md` — because they live on the `tickets` branch rather than in the agent's checkout. Their bullets say so and send the agent to the `tickets` skill, which is where their format, and every way of reading and changing them, is written down. No format text of their own rides in the channel. The user's picked in-context directories, when any, come first on the `Context:` line, framing whatever follows.

In a checkout The Framework created, that skill is the checkout's: the package links it where the agent's harness looks for skills, and the `tickets` command is on the agent's PATH. Anywhere else — a terminal run in the user's own checkout, a GitHub Actions runner, a cloud session — neither is true, so the channel carries a temporary bridge instead, right after the built-in prompt and after the branch section that is its counterpart: how to read and write the branch, and claim a ticket, with git alone, followed by the skill's own text so the formats exist in exactly one place. Temporary is the word the code uses for it: it exists only until skills are committed into the repository itself, and then it goes.

#### Rationale

Before it was carried this way, the format was pointed at as a path under `node_modules/`, which only resolves when the framework happens to be a root dependency of the repo it works on — not for a global or npx install, not in a fresh worktree before an install. The agent was told to follow a format it could not open, and both governed files drifted from it with nothing to notice. The format is now the skill's, which the agent either has as a skill or is handed here — nothing to go and find, and nothing materialized into the user's repo.

### Modes: additive by default, vanilla, transparent

#### User story

A repo owner decides how much of The Framework's voice their agents get: the built-in prompt plus their own instructions, their own only, or a fully raw wrapped agent.

#### Business logic

By default the channel is the context block, the built-in prompt, the branch and tickets sections an agent outside a daemon-made checkout gets, and then the user's `SYSTEM.md` (a blank one adds nothing). Vanilla removes every framework-authored piece of prompt content — the built-in prompt, the context docs, and those sections, driven by the one switch so they cannot fall out of step — while keeping the user's own dirs and `SYSTEM.md`. Transparent short-circuits everything: the system channel is empty, emit protocols included, so the agent receives exactly what the raw wrapped CLI would; it overrides every other option.

### The emit protocols and the per-agent capability sections

#### User story

The dashboard's gates and ready for merge must work even when the built-in prompt is off; an agent with a browser attached should actually use it; a hands-off agent must land its own work, and must decide instead of parking when nothing can answer it.

#### Business logic

The emit protocols are appended unconditionally (transparent aside): they are the emit contract the turn-boundary parsing depends on, not prompt content, so a vanilla agent still gets them — the drift that once dropped them from vanilla builds is exactly what the single assembly point exists to prevent. Nothing is ever appended after them, which is what lets the dashboard show the complete channel up front.

Two further protocols are conditional on the agent, not on the prompt:

- The **browser protocol** — the agent has a real browser wired; use it rather than fetching pages blind — rides ahead of the emit protocols.
- The **hands-off protocol** — nothing here sees this session's workspace, so commit the work and open a pull request for it before ending — rides after the await protocol, and is added for every hands-off agent.

Both survive vanilla, none survives transparent, and the signal protocol is always last. A hands-off agent's gates are the same as any agent's: the channel says nothing about whether its questions can be answered.

#### Rationale

Without the browser section, the tools are wired but never mentioned, and the agent reaches for blind fetching while the browser preview sits unused.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
