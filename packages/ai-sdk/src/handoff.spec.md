`handoff()` factory — a control-transfer tool the parent agent's model calls to pivot the conversation to another agent class.

## TLDR

- Returns a `HandoffTool`: plain object tagged `HANDOFF_MARKER` (`Symbol.for('rudderjs.ai.handoff')` for cross-bundle/realm detection), carrying `__handoffSpec` (`AgentClass`, name, description, inputSchema) and deliberately NO `execute` — the loop short-circuits, synthesizes a tool result, and pivots to a new `AgentClass` instance.
- Defaults: name `handoffTo${AgentClass.name}`; description `"Hand off the conversation to X."` with optional `when` trigger phrase appended (`for <when>.`) unless a full `description` overrides; input schema `z.object({ message: z.string() })` — the transition prompt that becomes the child's first user message.
- Custom input schemas are allowed, but the loop reads `args.message` as the transition prompt; schemas without a `message` string yield an empty transition message (carried history still reaches the child).
- `isHandoffTool` structural typeguard.

## Decisions

- Handoff ≠ `Agent.asTool`: asTool is call-and-return (parent resumes with the child's text as a tool result); handoffs never return — the child owns the rest of the conversation.
