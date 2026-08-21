The contract every wrapped coding agent must fit: start a session in a workspace, prompt it turn by turn, read the code it produced, dispose — the agent itself stays a black box.

## Flows

- The contract is deliberately the code and the outcome, never the agent's tool calls: tools surface only as named actions for the watching human, and control flow never branches on them.
- Each prompt is the fresh-context unit; a persona — a role the agent is asked to play — is framing text carried on the session, not a separate agent.
- A turn reports the tokens it spent, but a price only when the agent priced it — an unknown cost is omitted, never zero, so "free" and "unknown" can't be confused.
- A quota reading is available-with-windows or unavailable-with-a-reason, and the reasons split "this attempt failed" — the dashboard keeps showing the last good reading — from "this setup has no quota", which drops it.
- A driver answers only "which CLI do I spawn". Whether an agent ends at its first prompt is a fact about where that prompt executed, and lives with the location instead.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
