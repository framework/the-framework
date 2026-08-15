The build-run orchestrator: one agent session drives the whole flow — scope and build — then the backlog loop and live chat, with every phase streamed as events.

## TLDR

- Nothing about the project reaches the agent's prompt: the system framing shown on the dashboard is exactly and entirely what the agent runs under.
- Nothing reviews the build: the agent is a black box, and the build turn is the whole run. Scope is a constant and build is one driver turn, so the phases are called directly rather than driven by an engine.
- A build turn that stops to ask becomes a live question, and the answer continues the same session — bounded, so an agent that keeps asking cannot loop forever; a declined plan ends the run cleanly, and the budget and quota stops hold even when nothing runs after the build.
- A hand-off run (the work leaves for a cloud session) ends at the hand-off, because every later phase would misread the hand-off note as the agent's own reply.
- Resuming a stopped run continues the same conversation with the message sent verbatim — the old transcript already carries the framing — while the surrounding flow still runs.

## Flows

- Frame the session → scope → build (pausing on the agent's questions) → backlog loop → live chat → end.
- On any stop or failure: classify why (shared with the direct-prompt path), emit a clean end event, and release the session.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
