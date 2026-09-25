The `question` skill: how a coding agent asks the person to decide something before it goes on, as a skill file the agent picks by itself when a choice is not its to make.

## Context

**User story**: a person starts an agent on a task, and the task holds a choice only they can make: which license, which of two designs. The agent stops on the question; the person is told the agent waits, picks an option, and the same agent goes on from where it stopped.

**Business logic story**: a runner starts the coding agent with no terminal, so the agent has no tool for asking and nothing else teaches it how. `SKILL.md` is the only place the agent learns the `await-choices` block: the runner reads the block off the agent's last reply, ends the run waiting, and resumes it with the answer. A person running the agent by hand in a terminal has the coding agent's own asking tool, and the file sends the agent there instead. It names no runner, no dashboard and no other skill.

## Business logic — TL;DR

- **When to ask** - only when the choice is the person's and the work depends on it; everything else the agent decides, and says what it decided.
- **Never ask** - when the task says nobody will answer, as every command skill in this monorepo does: the agent takes the option it would recommend, and says so.
- **Its own tool first** - an agent that has a tool of its own showing the person a question and returning the answer uses it, and the block is not written. An agent with none that a person runs by hand, Codex in a terminal, writes the block in its reply, and the person answers in words: intended, not a gap.
- **The block** - otherwise the very last thing in the reply: a fenced `await-choices` block of JSON, a `title`, two to four `options` each with a `label` and an optional one-line `detail`, the `recommended` label, and `"multi": true` when several may be picked; one question per reply, what the person needs to decide in the lines above it.
- **Every question** - a follow-up question too goes in the block. The person may answer in words instead of an option, so a value the agent needs is offered as its likely options, never as an option that asks for words after it.
- **Stop** - the agent ends its reply on the block, going no further and picking for nobody; the answer comes back to it as a message.
- **What the reader of the block honours** - the last block in the agent's final message that is a question (one JSON object with at least one labelled option; a missing title reads "Which option?"), wherever it stands, even one the agent only quotes; a block that is not is skipped for an earlier one, and with none the run ends as if the agent never asked. The two-to-four options are advice: one or more is a question. The block's other fields (an option ending the session, options checked from the start, a file the question is about) are left out on purpose: they serve other callers, not a question in the middle of a task.
