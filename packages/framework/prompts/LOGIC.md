Every prompt The Framework sends an agent [1], authored as markdown and nowhere else: the built-in system prompt [2], the two sections that replace the skills [4] for an agent outside a checkout [3] The Framework created, the follow-up an agent gets after signaling ready for merge [5], the queue-only rule the triages end with, the four protocols under `protocols/` that pin the syntax of everything an agent signals, and the fifteen presets under `presets/`. The generator described in `scripts/gen-prompts.LOGIC.md` compiles this directory into the module the code imports, so changing what agents are told is a markdown edit reviewed as a markdown diff, and the dashboard can show the user the exact prompt before an agent starts. `README.md` documents the directory for humans and carries no business logic.

## Context

**User story**: before starting an agent, the user sees in the launcher the full prompt the agent will receive; while it runs, the cards, the right-rail documents, the ready badge and the pull request all come from what these prompts taught the agent to emit; and a change to any of it lands as a readable markdown diff in a pull request.

**Business logic story**: the composition rule in `src/system-prompt.ts` assembles the files of this directory into one system channel in one fixed order, described below; the rule in `src/prompt-template.ts` renders their `${{ ... }}` fragments; the rule in `src/turn-gate.ts` reads the signals off each turn's [7] final message; the table in `src/preset-catalog.ts` says which button or routine each preset backs.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent under The Framework's control, in its own checkout, on its own branch, streaming events, handed off when it ends.
[2] the built-in system prompt: the standing instructions every agent starts with (`prompts/system_prompt.md`); `SYSTEM.md` is the project's own instructions added on top.
[3] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch.
[4] skill: one of the four capabilities an agent is taught (`branches`, `tickets`, `queue`, `logs`), each a package with the instructions the agent reads (its `SKILL.md`, linked into the checkout where the coding agent's harness looks for skills), a command on the agent's PATH, and an API the product calls.
[5] ready for merge: the signal an agent emits when it believes its work is complete: it flips the agent's badge from building to ready and authorizes the handoff.
[6] vanilla: an agent started without the built-in system prompt but with the signal protocols kept. transparent: an agent started with nothing of The Framework's, the raw coding agent.
[7] turn: one prompt sent to the driver; the coding agent's own loop runs to completion and answers with a final message.
[8] gate: a question with options at which an agent stops and waits for an answer: it emits the question in its turn's final message, the dashboard shows it as a card, and the answer re-prompts the agent.
[9] hands-off: said of an agent whose work leaves this machine, so its first prompt is the whole agent: an agent whose location is `web`.
[10] session name: the name an agent gives its own work (`[a-z0-9-]+`); its branch is renamed to `agent-<session name>` and the dashboard labels the agent by it.
[11] the agent queue: `TODO_AGENTS.md` on the `agent-data` branch: every task agents will work next, in priority sections, worked top-down.

## Business logic — TL;DR

- **The built-in system prompt** (`system_prompt.md`) - analyze the prompt and stop at a gate [8] when it is ambiguous or large, name the work and branch before the first change, weigh alternatives at a gate before every change, and signal ready for merge [5] only when nothing is left; its last section is where the user's prompt is rendered.
- **Branching without the skill** (`branch_yourself.md`) - an agent outside a checkout [3] The Framework created creates `agent-<session name>` with git itself and commits as it goes.
- **Tickets and the queue without the commands** (`tickets_yourself.md`) - the same agent reads and writes the `agent-data` branch with git, exactly as the `tickets` and `queue` commands would, and claims a ticket with a lock file it never overwrites.
- **The protocols** (`protocols/`) - the syntax for a gate, a browser handover, a right-rail document, the ready signal, the pull request and an error, plus the two sections an agent gets only with a browser or only when hands-off [9]; see `protocols/LOGIC.md`.
- **The follow-up after ready for merge** (`on_before_mergeable_prompt.md`) - a vanilla [6] follow-up agent queues a maintainability pass and a security audit of the finished agent's changes when warranted, and folds what that agent learned into `knowledge-base/`.
- **The presets** (`presets/`) - the fifteen canned prompts behind the launcher's buttons and the daemon's routines; see `presets/LOGIC.md`.
- **Triage queues only** (`triage_scope.md`) - the rule ending both triage presets: the agent changes nothing but the agent queue [11], implements no ticket and opens no pull request.

## Business logic

### One system channel, in one order

#### Context

**Problem**: an agent's whole system channel has to be composed in exactly one place, in one order, so the dashboard can show the complete prompt before the agent starts and so the signal protocol, which every gate and every handoff depends on, is never accidentally dropped or buried.

#### Business logic

The rule in `src/system-prompt.ts` assembles the files of this directory as follows, and a build agent's system channel is exactly this:

1. A context list: the directories the user picked as in-context, if any, then the project's context documents with a one-line gloss each: `knowledge-base/DECISIONS.md`, `GOAL.md`, `BUSINESS_LOGIC.md`, `knowledge-base/FACTS.md`, `knowledge-base/INSIGHTS.md`, `knowledge-base/MARKET_RESEARCH.md`, any other `knowledge-base/**.md`, the tickets under `tickets/**.md` and the agent queue [11] `TODO_AGENTS.md`, the last two on the `agent-data` branch and to be read and changed through the `tickets` and `queue` skills [4].
2. The built-in system prompt [2], its half above the `# User prompt` heading.
3. Only for an agent outside a checkout [3] The Framework created, such as a terminal run in the user's checkout, a GitHub Actions runner or a cloud session: `branch_yourself.md`, then `tickets_yourself.md` followed by the `tickets`, `queue` and `logs` skills' own texts. An agent in its own checkout has the skills linked into it and gets nothing here.
4. The project's own `SYSTEM.md`, when it has one.
5. `protocols/browser.md`, only when the agent has a browser attached.
6. `protocols/await.md`.
7. `protocols/hands_off.md`, only for a hands-off [9] agent.
8. `protocols/signal.md`, always last.

The half of the built-in system prompt below the `# User prompt` heading, holding the user's own text, is the turn's [7] prompt, not part of the system channel.

A vanilla [6] agent drops steps 1 to 3, the context documents, the built-in prompt and the fallbacks, and keeps the user's directories, `SYSTEM.md`, and the protocols: it can still drive the dashboard's gates and the handoff. A transparent agent gets an empty system channel: there is no behavior of The Framework's left to signal to. The Framework itself never adds anything else.

### Templates

#### Context

**Problem**: a prompt that quietly rendered with a hole where a fragment failed would reach the agent [1] without anyone noticing; and the fragments are evaluated as code, so rendering text from an untrusted source would be executing it.

#### Business logic

The prompt files are templates: a `${{ ... }}` fragment is an expression evaluated at render time against a context the prompt reads as `tf`, and everything outside fragments passes through byte for byte (the rule in `src/prompt-template.ts`). What the fragments read: the user's prompt (`tf.prompt`, in the built-in system prompt), the launching or finished agent's session name [10] (`tf.session_name`, in the follow-up and in a preset's default target), a preset's one parameter (`tf.params.what`), and the paths of the presets written to the project (`tf.presets.<stem>.filePath`, resolving to `.the-framework/presets/<stem>.md`). A fragment that fails to evaluate, or evaluates to nothing, is an error that stops the render rather than a degraded prompt. A fragment cannot contain two closing braces side by side, which is why the follow-up prompt and the "Maintenance" preset spell their nested values out flat. Only these trusted templates are ever rendered; a user's or a repository's text never is.
