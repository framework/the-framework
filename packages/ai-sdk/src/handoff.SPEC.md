Defines the handoff tool — a tool an agent's model can call to permanently transfer the conversation to another agent.

## TLDR

- Calling a handoff runs no code; it signals the loop to end this agent's run and let the named agent continue the same conversation with its own instructions, tools, and model.
- The model writes a short transition message that becomes the new agent's first user prompt; the tool's description tells the model when this handoff is the right pick.

## Rationales

- A handoff is deliberately different from mounting an agent as a tool: a tool call returns to the parent, a handoff never returns — the new agent owns the rest of the conversation.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
