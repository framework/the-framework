The live chat channel: the user's own messages into a running agent, delivered in the order they were sent and answered inside the agent's existing driver session so the conversation keeps its full context.

## User story

While an agent works, the user wants to say something to it — a correction, an extra requirement, a follow-up task — without starting a new agent and without losing everything the agent already knows.

## Business logic — TL;DR

- **The user speaks to the agent unprompted** - live chat is the reverse of a gate: a gate is the agent asking the user, live chat is the user addressing the agent, and every message continues the same driver session.
- **Messages are delivered in order, never dropped** - a message sent while the agent is between turns is handed over immediately; a message sent while nothing is listening waits until the agent asks for the next one.
- **A settled agent ends rather than idling** - once the work settles the agent takes any message that has already arrived, but an empty chat ends the agent instead of holding it open; a later message reopens the same conversation.
- **Stopping always ends the wait cleanly** - closing the chat, or stopping the agent, wakes anything waiting for a message so the agent finishes rather than hanging, and no message that arrives afterwards starts a new turn.
- **Only agents someone can talk to get a chat** - an agent with no live surface delivering messages has no chat at all, and simply ends when it stops asking questions.

## Business logic

### The user speaks to the agent unprompted

#### User story

See `## User story`.

#### Business logic

Each chat message is sent into the agent's existing driver session rather than starting a fresh one, so the agent answers with everything it has already learned in the task still in context.

### Messages are delivered in order, never dropped

#### User story

The user sends two messages in quick succession while the agent is mid-turn, and expects the agent to see both, in the order they were typed.

#### Business logic

A message that arrives while the agent is already waiting for one is handed straight to it. A message that arrives while the agent is busy is held until the agent next asks. Messages are handed over in the order they were sent, and waiting agents are served in the order they started waiting.

### A settled agent ends rather than idling

#### User story

A user asks the daemon to run a task, walks away, and comes back hours later to add a follow-up. Nothing should have been sitting idle in between, and the follow-up should still land in the same conversation.

#### Business logic

Once its work settles, an agent started by the daemon asks only whether a message has already arrived — it never waits. A message that is already queued is worked as the next turn; an empty chat ends the agent. A later message reopens the same conversation by resuming the agent's session, the way Claude Code on the web does.

An agent that has its own terminal dashboard instead stays open and waits for the next message, because that surface has no daemon to resume the conversation through.

### Stopping always ends the wait cleanly

#### User story

The user presses Stop, or the agent hits its budget cap, while the agent is waiting for the next chat message.

#### Business logic

When the agent is stopped, or the chat is closed because the agent is over, anything waiting for a message is woken with "no message" so the agent finishes cleanly instead of hanging forever. After the chat is closed, further messages are ignored and no already-queued message can start another turn.

### Only agents someone can talk to get a chat

#### User story

An agent running with no live surface — nobody watching, nothing able to deliver a message — should behave exactly as it did before live chat existed.

#### Business logic

A live chat exists only for an agent whose messages can actually be delivered, which means a live dashboard or the daemon writing to the agent's control channel. An agent without one has no chat, and its loop ends when the agent stops asking questions.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
