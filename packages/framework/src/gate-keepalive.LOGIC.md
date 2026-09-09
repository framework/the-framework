Keeps an agent's [1] process alive while the agent is parked on a gate [2], or on any other wait between turns [3] such as the next message of live chat [4], and lets the process exit the moment nothing is parked. The first pending wait starts one idle timer that holds the Node event loop open, overlapping waits share that timer, and the last wait to settle, whether answered or failed, stops it.

## Context

**Problem**: an agent the daemon spawns has nothing else holding its process open between turns: it runs detached with its terminal closed and no server of its own, the coding agent [5] is a child that is reaped after every turn, and the tail on the control file [6] is deliberately not allowed to keep a finished agent alive. Without this, a process waiting for a pick [7] would exit silently mid-wait: no ending recorded, nothing in its error output, and picks appended to the control file that nothing reads. Waiting for the answer is the agent's whole work at that moment, so holding the process open is right exactly then and nowhere else.

## Glossary

[1] agent: The unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends. Started from the dashboard by the user, or by the daemon.
[2] gate: A question with options at which an agent stops and waits for an answer: it emits the question in its turn's final message, the dashboard shows it as a card, and the answer re-prompts the agent. When nobody can answer, the recommended option is taken.
[3] turn: One prompt sent to the driver; the coding agent's own loop runs to completion and answers with a final message.
[4] live chat: The user's own messages to a running agent, each continuing the same driver session. One of them is a message.
[5] coding agent: The CLI doing the actual work: Claude Code or Codex.
[6] control file: `.the-framework/control.jsonl`: the file the daemon appends steering to (stops, picks, chat messages) and the agent's process tails.
[7] pick: The answer to a gate: the option or options chosen, by the user or automatically.

## Business logic — TL;DR

- **One hold per parked wait** - a wait passed through the keepalive holds the process open until the wait settles, and its result or its failure is returned unchanged.
- **One timer shared by all holds** - the first pending hold starts the timer, further holds share it, and the last one to settle stops it, so the process can exit as soon as nothing is parked; a later hold starts a fresh timer.
- **The timer is one Node counts** - the idle timer is a real interval Node treats as work in progress; its period is far beyond any agent's life, so the wakeups cost nothing.
