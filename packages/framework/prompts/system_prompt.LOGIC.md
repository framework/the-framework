The built-in system prompt [2]: the standing instructions every agent [1] starts with, unless the user started it vanilla [12] or transparent. It teaches the agent five macros, then walks it through one fixed order of work: analyze the user's prompt and stop at a gate [4] when it is ambiguous or large, name the work and move onto its own branch before the first change, rate how uncertain each problem is and stop at a gate over the alternatives before changing anything, and end by signaling ready for merge [7] only when nothing is left to do. Its last section is the slot where the user's own prompt is rendered.

## Context

**User story**: the user types a prompt in the launcher and starts an agent [1]. When the prompt can be read several ways, or the work is large, the user is shown a card in the dashboard with ranked interpretations or a plan to approve, and the agent waits for the pick [5]. Before the agent changes code it shows, per problem, the alternatives it weighed and lets the user choose. The agent's branch is named after the work, and when the agent is done the dashboard's badge flips to ready and the work is handed off; an agent that stops short says what is left instead.

**Business logic story**: the text is a template. `${{tf.prompt}}` is the one fragment it reads, rendered by the rule in `src/prompt-template.ts`. The rule in `src/system-prompt.ts` splits the template at its `# User prompt` heading: everything above goes into the agent's system channel, preceded by a list of the project's context documents and followed by the branch fallback (`branch_yourself.md`), the tickets fallback (`tickets_yourself.md`) when the agent runs outside a checkout [10] The Framework created, the project's own `SYSTEM.md`, and the protocols under `protocols/`; everything below the heading is the turn's prompt. The macros this prompt teaches are only vocabulary: the syntax the agent must emit for a gate [4], a view [6] and the ready signal is pinned by `protocols/await.md` and `protocols/signal.md`, and what The Framework reads off each turn's final message is the rule in `src/turn-gate.ts`.

**Problem**: the coding agent [3] runs each turn to completion as a black box, so The Framework learns that the agent stopped to ask, rather than decided on its own, only from a signal in the turn's final message. Every point where this prompt says "await" is such a stop, and every point where it says "show" is a document the dashboard can render.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent under The Framework's control, in its own checkout, on its own branch, streaming events, handed off when it ends.
[2] the built-in system prompt: the standing instructions every agent starts with (`prompts/system_prompt.md`); `SYSTEM.md` is the project's own instructions added on top.
[3] coding agent: the CLI doing the actual work: Claude Code or Codex.
[4] gate: a question with options at which an agent stops and waits for an answer: it emits the question in its turn's final message, the dashboard shows it as a card, and the answer re-prompts the agent. When nobody can answer, the recommended option is taken.
[5] pick: the answer to a gate: the option or options chosen, by the user or automatically.
[6] view: a markdown document an agent pushes to the dashboard's right rail while it works.
[7] ready for merge: the signal an agent emits when it believes its work is complete: it flips the agent's badge from building to ready and authorizes the handoff.
[8] session name: the name an agent gives its own work (`[a-z0-9-]+`); its branch is renamed to `agent-<session name>` and the dashboard labels the agent by it.
[9] the agent queue: `TODO_AGENTS.md` on the `agent-data` branch: every task agents will work next, in priority sections, worked top-down. An item on it is a queue entry.
[10] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch.
[11] skill: one of the four capabilities an agent is taught (`branches`, `tickets`, `queue`, `logs`), each a package with the instructions the agent reads, a command on the agent's PATH, and an API the product calls.
[12] vanilla: an agent started without the built-in system prompt but with the signal protocols kept; transparent: an agent started with nothing of The Framework's, the raw coding agent.
[13] handoff: what happens to an agent's work when the agent ends, as one ladder of four levels: `local`, `push`, `pr` (the default), `merge`.
[14] build agent / prompt agent: the two kinds of agent: a build works the agent queue after its opening exchange; a prompt agent runs one prompt and stops there.

## Business logic — TL;DR

- **The macros** - five names the rest of the prompt is written in: show a markdown document, show a list of options, stop and wait for the answer, the session name, and the agent queue with the command that adds to it.
- **Analyze the user prompt first** - an ambiguous prompt becomes a gate over interpretations ranked by plausibility; a large scope becomes a plan file shown and gated; a very large scope also becomes queue entries, shown as a view.
- **Name the work before the first change** - the agent invents a session name for the prompt's intent and names its branch after it through the `branches` skill or the branch fallback; the name the branch ends up with is the session name from then on.
- **Weigh alternatives before every change** - the agent lists the problems it is about to solve, rates each from 0 to 10 for how obvious the best solution is, explores alternatives for the low scores, and stops at a gate per problem that has alternatives; again whenever it makes new changes.
- **Decide whether the work is finished** - finished with nothing left means signaling ready for merge, without which the work is never merged; anything left means no signal and a statement of what remains.
- **The user prompt slot** - the user's prompt is rendered verbatim under the final heading, and the split between system channel and turn prompt happens on the template so the user's text can never move it.

## Business logic

### The macros

#### Context

See `## Context`.

#### Business logic

The prompt opens by defining five placeholders it then uses throughout:

- "SHOW_MD": show a document via `showMarkdown()`. What The Framework does with it: the document becomes a view [6] in the dashboard's right rail, through the block syntax in `protocols/await.md`; the agent [1] does not stop.
- "SHOW_CHOICES": show a list of options via `showChoices()`.
- "AWAIT": stop, and wait for the user's answer before resuming. A `showChoices()` followed by an await is a gate [4]: the dashboard shows the options as a card, the pick [5] re-prompts the agent, and an unattended agent gets the recommended option, all per `protocols/await.md`.
- "SESSION_NAME": the session name [8].
- "TODO_FILE": the agent queue [9], `TODO_AGENTS.md`; an entry is added with `queue add "<entry>" --priority <N>` from the `queue` skill [11], never by editing the file.

### Analyze the user prompt first

#### Context

**Problem**: an agent [1] that guesses at an unclear prompt, or dives into work spanning days, spends the user's quota on the wrong thing; the cheapest moment to ask is before anything is done.

#### Business logic

The agent [1] analyzes the user's prompt before doing anything else, and:

- When it is not clear what to do, for instance the scope or the prompt itself is unclear, the agent lists its interpretations sorted by plausibility, shows them as options and stops at a gate [4] for the user's pick [5].
- When the scope is large, the agent writes a plan file named `PLAN_<session name>.agent.md`, shows it and stops at a gate: the plan is the document the card is about, and the user approves it or declines it.
- When the scope is potentially very large, spanning many hours or days of work, the agent also considers adding follow-up tasks to the agent queue [9] and shows the new entries as a view [6]. Those entries are worked later: by the same agent's own loop over the queue when it is a build agent [14], or by the daemon's Auto PM.

### Name the work before the first change

#### Context

**User story**: the dashboard labels the agent [1] by its session name [8] and the pull request comes from the branch `agent-<session name>`, so the user recognizes the work at a glance.

**Problem**: the session name is never a signal in the final message: it is read off the branch, so the branch has to be named before the first change lands anywhere.

#### Business logic

Before applying its first change, the agent [1]:

1. Invents a session name [8]: a string of lowercase letters, digits and dashes that succinctly represents the intention of the user's prompt.
2. Names its branch after it through the `branches` skill [11], which says how. Where that skill is not available, because the agent runs outside a checkout [10] The Framework created, the "Branch management" section that follows the prompt (`branch_yourself.md`) says how instead.
3. Takes whatever name the branch ended up with as its session name from then on, when it differs from the one it invented, for instance because the name was already taken.

### Weigh alternatives before every change

#### Context

**User story**: before the agent [1] commits to a design, the user sees, per problem, which alternatives it considered and chooses between them, instead of discovering the choice in a finished pull request.

#### Business logic

Before applying changes, and again every time it makes new changes, the agent [1] measures what the prompt calls "variability":

1. It lists every high-level problem it is about to solve.
2. It rates each problem from 0 to 10: 10 when there is an obviously optimal way to solve it, 0 when it is highly unclear whether the problem can be solved in a better way.
3. It explores and suggests alternatives for the problems with a low rating.
4. For each problem that has alternatives, it lists all of them sorted in a sensible order, shows them as options and stops at a gate [4] for the user's pick [5].

### Decide whether the work is finished

#### Context

**User story**: the agent's badge in the dashboard flips from building to ready only when the agent [1] itself says its work is complete, and only then is the work handed off; an agent that stops short leaves the user a statement of what remains rather than a half-done pull request presented as done.

#### Business logic

After applying its changes, the agent [1] decides whether the work named by its session name [8] is finished with no work left to do:

- Yes: it calls `setReadyForMerge()`, which is required: the work is never merged without it. The call is emitted as the block pinned by `protocols/signal.md`; The Framework then marks the agent ready for merge [7] and lets the handoff [13] proceed.
- No: it does not call it, and says what is left instead.

### The user prompt slot

#### Context

**Problem**: the user's prompt could itself contain the `# User prompt` heading; if the split were made after rendering, such a prompt could move text of its own into the system channel.

#### Business logic

The prompt ends with a `# User prompt` heading followed by the one template fragment `${{tf.prompt}}`, where the user's own text is rendered verbatim, for a build agent [14] and a prompt agent alike. The split into the two halves is made on the template before rendering: everything above the heading is the system half, everything below it is the user half, and both are rendered and trimmed separately. A template without the heading would send the whole text as the system half and the user's prompt alone as the user half.
