Topics: enhancement, orchestration, agent-runner
Issue: [#1902](https://github.com/framework/the-framework/issues/1902)

# Orchestration: a main agent runs subagents

## TLDR

The person talks to a main agent on a strong model and gets a plan of tiny tasks, each with a level (simple or hard). Once the person approves the plan, the main agent starts subagents, each a real run with its own chat, log and branch: cheap models do the simple tasks, powerful models the hard ones. The whole plan ends as one pull request. The sidebar shows the subagents under their main agent, like a tree, and the main agent's chat shows live lines about its running subagents.

## Why it matters

Today one agent on one model does a whole piece of work. Splitting it into small tasks lets cheap models do the simple ones, several run at once, and a strong model keep the overview, while the coding agent stays a black box: the helpers are ordinary runs (#1681 asked how that could work).

## The goal

1. The person talks to a main agent, a normal run on a strong model. They get a plan of small tasks. Each task says what to change, how to check it, whether it is simple or hard, and which tasks must finish first. The plan is saved as a file.
2. The person approves the plan before any subagent starts.
3. The main agent starts the subagents, up to the limit in Settings. Each subagent is a real run with its own chat, log and branch.
4. Settings says which model "simple" means, which model "hard" means, and which model checks. Until the person changes it, all three are their default model. The agent never picks a model on its own: it only says how hard a task is.
5. A blocked subagent asks the main agent. The main agent answers, or passes the question to the person.
6. A checker reviews each finished task and gives a verdict: pass, changes needed, or fail.
7. A failed task is retried once, one level up. If it fails again, the main agent stops that task and tells the person.
8. Only the main agent writes to the final branch. Subagents never do, so two of them cannot collide.

No spending limit for now. The names are "main agent" and "subagent".

## How it works underneath

The main agent never sits and waits. It starts its subagents and ends its turn. When a subagent ends, a message reaches the main agent the same way a person's message does, and the main agent continues. Nothing blocks, and all state stays in files: the rule the runner already follows.

Most of the parts exist today:

- `agent-runner run --detach` starts a run with a chosen coding agent and model, and answers its id at once.
- `agent-runner run --detach --resume <id> <text>` continues an ended run with a message.
- A run that asked a question ends `waiting`, with its checkout kept.
- `--then` runs a fresh agent on a finished run's branch. The checker has that shape.
- `branches create --base` makes a checkout that starts from a chosen branch.

## Steps, one pull request each

1. **A run knows its parent and where it starts.** A run can be started with a parent and a starting branch. Both are in its record. When it ends, its parent gets one line: which subagent, how it ended, its summary.
2. **The skill and its command.** An agent can start a subagent, list its subagents, read a subagent's result, and stop one. This is the first experiment: one main agent, one subagent, the result read back.
3. **The plan and the landing.** The main agent writes the plan file and asks for approval, through the question skill. It lands each finished subagent's branch into its own branch. It opens the one pull request at the end.
4. **The dashboard.** Subagents appear folded under their main agent in the sidebar, and as live lines in the main agent's chat. Both are drawn from the parent in each subagent's record.
5. **Settings.** The models for simple, hard and checker, and how many subagents run at once (4 to start with).
6. **Subagent questions.** A blocked subagent's question goes to the main agent, which answers it or passes it on.
7. **Check and retry.** A checker run on the subagent's branch gives the verdict. A failed task is retried once, one level up.

After step 3 the whole loop works end to end on the default model. Steps 4 to 7 each add one thing.

## Choices made while planning

- A subagent starts from the main agent's branch, which holds everything landed so far. Every other agent keeps starting from `main` (#1900).
- The plan file sits beside the main agent's run record, not in the tickets list: tiny tasks would flood the tickets.
- Subagents never open a pull request. Only the main agent does.
- Stopping the main agent stops its subagents.
- A subagent cannot start its own subagents in this version.
- A task that failed twice does not stop the tasks that do not depend on it.
- The main agent's top bar shows the cost of the whole plan: itself plus all its subagents.

## Related

- #1901 (choose where an agent starts). Step 1 builds its inner part: a run that starts from a chosen branch, with the branch in its record. The picker in the launcher stays in #1901.
- #1681 (modularity).
- Cheap models are a later step. DeepSeek documents a mode that Claude Code can run on (`ANTHROPIC_BASE_URL=https://api.deepseek.com/anthropic`). It is not tested here yet.
- Prior art: Orca's orchestration (https://www.onorca.dev/docs/cli/orchestration) has the same parts: tasks, workers started per task, an inbox, a done report. It tells its coordinator to pass a model only when the user named one.

## Open questions

- **The names.** Claude Code already calls its own hidden helpers "subagents". The subagents here are different: each one is a real run with its own chat, log and branch. Is the same word fine, or does it need its own name?
- **A new recorded decision.** The runner's `DECISIONS.md` says only a person or the scheduler starts an agent. An agent that starts an agent needs its own bullet there before step 1.
