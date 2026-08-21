The live-chat channel into a running agent: the user's own messages, spoken unprompted, each continuing the same agent conversation with its full context.

## User Stories

- The user chats with a running agent; each message continues the same conversation with its full context.
- The user comes back to a daemon-managed agent that already ended, sends another message, and the same conversation reopens.

## Flows

- The reverse of the agent asking the user: here the user speaks first, and the agent drains the queued messages once its current work settles.
- A daemon-managed agent ends itself when no more messages wait — a later message reopens the conversation — while an agent whose own terminal is the only surface stays parked for the next message, since it has no daemon to resume through.
- A stop or a close wakes every parked wait empty so the agent ends cleanly, and a message already queued never starts a turn on an aborted agent.
- A headless agent gets no channel at all and ends when it stops asking.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
