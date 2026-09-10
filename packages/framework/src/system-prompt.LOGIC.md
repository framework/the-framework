Composes the system channel every agent [1] starts with, and renders the user's own prompt into the built-in system prompt's [2] user slot. The channel is, in a fixed order: the in-context line, the built-in system prompt with its fallback sections for an agent outside a checkout [3] The Framework created, the project's `SYSTEM.md`, then the protocols that pin how the agent signals. It is pure, which is what lets the dashboard show the exact prompt before an agent starts.

## Context

**User story**: the user opens a project's launcher [4], sees the whole prompt the agent will receive, and starts it; the agent then names its work, asks through gates [5], shows views [6] and signals ready for merge [7] the way the channel told it to. Switching an agent to vanilla [8] keeps only the user's own instructions; transparent [9] runs the raw coding agent [10].

**Problem**: the same channel serves a build started from the dashboard, a prompt typed by hand, an agent on a GitHub Actions runner and a cloud session. One composition, with its order fixed, is what keeps the protocols from being dropped on one path and kept on another.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends. Started from the dashboard by the user, or by the daemon.
[2] the built-in system prompt: the standing instructions every agent starts with (`prompts/system_prompt.md`); `SYSTEM.md` is the project's own instructions added on top.
[3] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch.
[4] launcher: the Start form on a project's own page.
[5] gate: a question with options at which an agent stops and waits for an answer: it emits the question in its turn's final message, the dashboard shows it as a card, and the answer re-prompts the agent. When nobody can answer, the recommended option is taken.
[6] view: a markdown document an agent pushes to the dashboard's right rail while it works.
[7] ready for merge: the signal an agent emits when it believes its work is complete: it flips the agent's badge from building to ready and authorizes the handoff.
[8] vanilla: an agent started without the built-in system prompt but with the signal protocols kept.
[9] transparent: an agent started with nothing of The Framework's — the raw coding agent.
[10] coding agent: the CLI doing the actual work: Claude Code or Codex.
[11] the `agent-data` branch: the branch of a project's repository used as a file store for everything agents share: tickets, the agent queue, the runs, routine locks.
[12] the agent queue: `TODO_AGENTS.md` on the `agent-data` branch: every task agents will work next, in priority sections, worked top-down.
[13] cloud session: a Claude Code cloud session on claude.ai, the far end of a `web` agent.
[14] session name: the name an agent gives its own work (`[a-z0-9-]+`); its branch is renamed to `agent-<session name>` and the dashboard labels the agent by it.
[15] turn: one prompt sent to the driver; the coding agent's own loop runs to completion and answers with a final message.
[16] turn signals: what The Framework reads off a turn's final message: the ready-for-merge signal, the pull request title and body, markdown views, reported errors, and the gate it stops at.
[17] hands-off: said of an agent whose work leaves this machine, so its first prompt is the whole agent: an agent whose location is `web`.
[18] the bridge: the daemon's bridge endpoints plus the Chrome extension: carries the question a cloud session is parked on into the dashboard, and types the pick back into the session.

## Business logic — TL;DR

- **The user prompt slot** - the built-in prompt is split at its `# User prompt` heading before anything is rendered; the user's prompt fills the slot and can never move the split.
- **The in-context line** - one `Context:` line names the directories the user picked, then the knowledge documents every agent keeps in context.
- **The built-in prompt and the fallbacks for an agent elsewhere** - the built-in prompt, followed, for an agent outside a checkout The Framework created, by the sections that have it branch, and read and write the tickets and the queue, with git itself.
- **The project's own instructions** - `SYSTEM.md` is appended after the built-in prompt; a blank one is ignored.
- **Vanilla** - drops everything The Framework authored from the prompt block and keeps the user's directories and `SYSTEM.md`.
- **The protocols, in a fixed order** - the browser section when the agent has a browser, the await protocol, the hands-off section for a hands-off agent, and the signal protocol last, always; nothing is ever appended after it.
- **Transparent** - the channel is empty, whatever the other options say.

## Business logic

### The user prompt slot

#### Context

**Problem**: the built-in prompt ends with a `# User prompt` heading under which the user's own text belongs, and a user prompt may itself contain that heading.

#### Business logic

The built-in system prompt [2] is a template in two halves: everything above its `# User prompt` heading is the system half, and everything below it is the user slot, whose only placeholder is the user's prompt. The template is split at the heading before rendering, so a user prompt that contains `# User prompt` cannot move the boundary. Each half is rendered against the user's prompt and trimmed: the system half goes into the channel, and the user half is what the caller sends as the agent's [1] first prompt. A placeholder that cannot be evaluated, or that evaluates to nothing, fails the render rather than degrading the prompt silently (the rule lives in `prompt-template.ts`).

### The in-context line

#### Context

**User story**: an agent [1] can reach every registered project, so the user narrows its focus by picking directories; and every agent starts knowing where the project keeps what it has learned about itself.

#### Business logic

The prompt block opens with one `Context:` line whenever there is anything to put on it. It names the directories the user picked, trimmed, blanks dropped, comma-separated. Unless the agent [1] is vanilla [8], the line continues with one bullet per document the agent keeps in context, each a path from the project root with what it is for, in this order: `knowledge-base/DECISIONS.md` (decisions taken, and why), `GOAL.md` (the goal of the project), `BUSINESS_LOGIC.md` (codebase business logic), `knowledge-base/FACTS.md` (non-obvious facts), `knowledge-base/INSIGHTS.md` (insights), `knowledge-base/MARKET_RESEARCH.md` (the market the project competes in), `knowledge-base/**.md` (more knowledge files), `tickets/**.md` (things to potentially work on, on the `agent-data` branch [11], read and changed with the `tickets` skill), and `TODO_AGENTS.md` (the agent queue [12], on the `agent-data` branch, read and changed with the `queue` skill). None of them points into `node_modules`. Three of them, the decisions, the facts and the insights, are the business knowledge an agent also folds what it learned back into at merge; the others are pointers it only reads. With no directories picked and the agent vanilla, there is no line at all.

### The built-in prompt and the fallbacks for an agent elsewhere

#### Context

**Business logic story**: an agent [1] in a checkout [3] The Framework created finds the `branches`, `tickets`, `queue` and `logs` skills linked into the checkout, their commands on its PATH. An agent anywhere else, a terminal run in the user's own checkout, a GitHub Actions runner or a cloud session [13], has neither.

#### Business logic

After the context line comes the rendered system half of the built-in system prompt [2]; its text is `prompts/system_prompt.md`. For an agent [1] in a checkout [3] The Framework created, nothing else rides here: the built-in prompt sends it to the `branches` skill to name its session name [14], and to the `tickets` and `queue` skills for the roadmap. For any other agent two sections follow the prompt: "Branch management" (`prompts/branch_yourself.md`), which has the agent create and commit to `agent-<session name>` with git itself, then "Tickets and the agent queue, without the commands" (`prompts/tickets_yourself.md`), which has it read and write the `agent-data` branch [11] with git, followed by the `tickets`, `queue` and `logs` skills' own instructions in that order, each with its catalog front matter dropped. That bridge is temporary, until the skills are committed into the repository.

### The project's own instructions

#### Context

**User story**: a repository keeps its own standing instructions for agents [1] in `SYSTEM.md` at its root.

#### Business logic

The content of `SYSTEM.md` (read by `system-prompt-file.ts`), trimmed, is appended after the built-in system prompt [2] and its fallback sections; a blank or whitespace-only text is ignored. The two are additive: a project can keep the built-in prompt and add its own, drop the built-in one and keep only its own (vanilla [8]), or have neither, in which case the prompt block is empty.

### Vanilla

#### Context

**Problem**: the extra turn [15] an agent [1] gets after ready for merge [7] must not name a session of its own or create a branch, and a user who switches the built-in prompt off expects nothing of The Framework's prompting to remain.

#### Business logic

Vanilla [8] drops everything The Framework authored from the prompt block: the built-in system prompt [2], the knowledge documents on the context line, and the "Branch management" and tickets sections. One switch drives all of them, so they cannot fall out of step. The user's picked directories and `SYSTEM.md` survive, and so do the protocols.

### The protocols, in a fixed order

#### Context

**Business logic story**: the protocols are the emit contract, how the agent [1] signals a gate [5], a view [6], an error, ready for merge [7] and the pull request it wants, not prompt content. An agent needs them even with the built-in prompt off, or its turn signals [16] would never be read.

#### Business logic

The channel is exactly this, in this order: the prompt block when it is not empty; the browser section when the agent [1] has a real browser attached, so it reaches for the browser tools instead of a plain fetch; the await protocol; the hands-off section when the agent is hands-off [17], which tells a cloud session [13] to land its work in commits and a pull request since nothing on this machine follows it, while its gates [5] work like any other agent's, answered through the bridge [18] or on claude.ai; and the signal protocol, always last. Nothing is ever appended after the signal protocol. The browser and hands-off sections describe what this agent can do, so they survive vanilla [8] like the protocols do. Their texts are `prompts/protocols/browser.md`, `await.md`, `hands_off.md` and `signal.md`; what each pins is described with `turn-gate.ts`.

### Transparent

#### Context

**User story**: the user wants an agent [1] identical to running the coding agent's [10] own command by hand.

#### Business logic

A transparent [9] agent receives an empty system channel: no context line, no built-in system prompt [2], no `SYSTEM.md`, no browser or hands-off section, no protocols. It overrides every other option.
