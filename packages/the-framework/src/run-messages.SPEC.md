The live-chat channel into a running session: the user's own messages, spoken unprompted, each continuing the same agent conversation with its full context.

## TLDR

- The reverse of the agent asking the user: here the user speaks first, and the run drains the queue once its current work settles.
- A daemon-managed session ends itself when the queue is idle — a later message reopens the conversation — while a run whose own terminal is the only surface stays parked, since it has no daemon to resume through.
- Stopping or closing wakes every waiter empty so the run ends cleanly, and a stale message never starts a turn on an aborted run.
- A headless run gets no channel at all and ends when the agent stops asking, exactly as before live chat existed.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
