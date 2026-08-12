Translates an agent's stream into the Vercel AI SDK's wire format so chat UIs already built on that protocol can consume our agents unchanged.

## TLDR

- Each chunk kind maps to its protocol line: text deltas, tool-call starts and argument fragments, complete calls, results, and finish frames.
- Argument fragments that arrive without a call id are routed to the right call by position, falling back to the most recently started call — the same routing the agent loop uses.
- Chunk kinds the protocol has no part for (tool progress, pauses, handoffs) are dropped; the package's own streaming protocol carries those when a UI needs them.
- A helper wraps the stream in a ready-to-return web response with the protocol's headers.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
