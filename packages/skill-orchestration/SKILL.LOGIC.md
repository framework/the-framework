The instructions an agent reads before splitting its task across subagents [2]: what a subagent is, how to reach the `orchestration` command, its four command lines, what to do before and after starting one, and what the message it gets when one ends is. Tracked in a project where the coding agent's harness looks for skills, it is what turns the command into a skill [3]. Its description tells the agent to use it to split its task across other agents and go on when they end.

## Context

**User story**: an agent whose task has parts that can be worked alone starts a subagent per part and ends its reply; each time one ends it is continued with a message saying which, how, and what it answered, takes the work with `git merge`, and goes on.

**Business logic story**: everything the skill says the command does is enforced by `src/cli.ts` and `src/subagents.ts`; the message a main agent [1] gets when a subagent ends is written and delivered by the runner (`agent-runner`'s `parent.ts`), which the skill does not name.

**Problem**: an agent that was never told what that message is takes it for a person's message about a run it did not start; an agent that waits for its subagents inside its turn spends the turn on nothing, since the message only reaches it once its turn ends.

## Glossary

[1] main agent: the agent reading the skill: the run whose agent calls the command.
[2] subagent: another coding agent the main agent starts on one part of its task: a run of its own, in its own checkout, on its own branch started from the main agent's.
[3] skill: a capability an agent is taught, as a package with the instructions the agent reads (its `SKILL.md`) and a command on the agent's PATH.

## Business logic — TL;DR

- **How to reach it** - run as `npx orchestration` from the repository's dependency `@gemstack/skill-orchestration`, installing with the lockfile's package manager when `node_modules` is missing.
- **The commands** - `start "<task>" [--model <id>] [--driver <claude-code|codex>]` answers the subagent's id at once, without waiting; `list` is the agent's subagents, newest first, as one JSON array; `read <id>` is one subagent's `status` and, once it ended, its `branch` and `result`, its last reply; `stop <id>` stops one that is running; a refusal exits 1 with a line on stderr saying why, and the skill explains no refusal beyond that: each line says what to do.
- **Before starting** - commit first: the subagent's branch starts from the agent's last commit, and `start` answers `uncommitted: true` otherwise; the task is one quoted argument, written for a reader who knows nothing of the conversation: what to change, where, how to check it; the command itself tells the subagent to commit to its branch, open no pull request and ask nobody; `--driver` or `--model` is passed only when the agent's task names one.
- **After starting** - the agent ends its reply and does not wait, sleep or poll `list`; each time a subagent ends it gets a message from the program that ran it, not from the person, beginning `The run <id>, started for this run, ended <status>`, the status `done`, `failed`, `stopped` or `waiting`, the last meaning it stopped on a question nobody can answer, to be treated as failed; the message gives the subagent's last reply and, when one is left, the branch its work is on; it then takes the work with `git merge <branch>`, starts another subagent, or ends its reply again while others run.
