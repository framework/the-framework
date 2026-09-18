Hands what the user says to an agent [1] — their own words, or their answer to the question [2] the agent stopped on — to that agent, through what the agent's tool reads: the inbox [3] in the agent's checkout while the agent works, the project's resume hook [4] once it has ended. The Framework names no tool in either.

## Context

**User story**: the user types in an agent's composer, or picks an option on its question's card. A working agent takes it as its next turn; an ended agent is continued with it, as the same agent.

**Problem**: the daemon runs no agent, so it cannot speak to one. And an agent can end in the instant a line is on its way to it, which would leave the line in a file nobody reads again.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch. The Framework starts none itself: the tool the project's start hook names runs it, and the dashboard shows it from the files that tool keeps.
[2] question: what an agent's turn ended on, asking the user to choose between options; the agent ends `waiting`, its checkout kept, and the answer resumes it.
[3] inbox: `.the-framework/inbox.jsonl` in an agent's checkout: one JSON line per message or answer, which the agent's session takes when a turn ends.
[4] resume hook: the one shell line under `resume` in a project's `.the-framework/hooks.yml`, which the daemon runs to continue an ended agent, with the agent's id and the user's text or answer; it answers the agent's id as JSON on stdout.

## Business logic — TL;DR

- **Working, or not** - an agent is working when its card says `running`, names this machine, and its process is alive.
- **A working agent gets a line in its inbox** - appended to the inbox in the agent's own checkout; the agent takes it when its turn ends.
- **An ended agent is resumed** - the project's resume hook is run with the text or the answer.
- **An agent that ended meanwhile** - after the write the agent is looked at again; when it is no longer working, everything still in the inbox is taken back and resumes the agent, in order.

## Business logic

### Working, or not

#### Context

See `## Context`.

#### Business logic

An agent [1] counts as working when its record (`store/agent-store.ts`) says `running`, names a process id, names this machine as its host, and that process is alive. Anything else — done, stopped, failed, waiting, unknown, on another machine, or a process that is gone — is not working.

### A working agent gets a line in its inbox

#### Context

See `## Context`. The inbox [3] is `agent-driver`'s: the agent's session takes every waiting line when a turn ends and sends each as the next prompt of the same conversation.

#### Business logic

The line — a message with its text, or an answer with the question's [2] title and the chosen labels — is appended to `inbox.jsonl` under the `.the-framework/` of the checkout the agent id resolves to (`store/agent-checkout.ts`). When the agent is still working after the write, the answer is success and nothing else happens.

### An ended agent is resumed

#### Context

See `## Context`.

#### Business logic

For an agent that is not working, nothing is written to an inbox. The project's resume hook [4] is run (`project-hooks.ts`) with the agent's id and the text of a message, or the labels of an answer. Its refusal, such as "this project has no resume hook", is the answer in words.

### An agent that ended meanwhile

#### Context

**Problem**: between the check and the write the agent's last turn can end; the inbox [3] was already read, and nobody reads it again until the agent is resumed.

#### Business logic

After the write the agent is checked again. When it is no longer working, every line still in the inbox is taken out (leaving it empty), which includes the line just written and any earlier line the agent never took, and the resume hook [4] is run once per line, in order. The first refusal ends it and is the answer. When the agent already took the line before it ended, the inbox is empty and the answer is success.
