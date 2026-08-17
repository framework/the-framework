One agent: frame it, send it one prompt, honor the gates it answers with, work the backlog, and stay open for the user's own messages — every step streamed as events.

## TLDR

- One path, not two. A build and a verbatim prompt used to be separate orchestrators that each inlined the system composition and drifted apart; once the review loop and the `Bootstrap` spine went, a build *was* one prompt honoring gates. What is left of the difference is two options: which prompt opens the agent, and whether its own backlog is worked afterwards.
- Nothing about the project reaches the agent's prompt: the system framing shown on the dashboard is exactly and entirely what the agent runs under.
- Nothing reviews the work: the agent is a black box, and its turn is the whole of it.
- A turn that stops to ask becomes a live question, and the answer continues the same conversation — bounded, so an agent that keeps asking cannot loop forever. With nobody to ask, the recommended option is taken and the agent carries on, which is what an unattended one is for.
- An answer the agent marked as ending it does exactly that, and cleanly: a declined plan reads as a stop rather than a failure, and the agent is never resumed with it. It stops through the same signal a Stop does, so a decline cannot read as a finished agent on one path and a stop on another.
- The budget and quota stops hold even when nothing runs after the opening turn.
- A build whose opening turn leaves the workspace empty means the agent stalled, so it is re-prompted once with a hard "create it from scratch" directive.
- An agent whose *location* is a cloud session ends at the hand-off, because every later phase would misread the hand-off note as the agent's own reply. Where an agent runs is its own axis, separate from which coding-agent CLI drives it.
- Resuming a stopped agent continues the same conversation with the message sent verbatim — the old transcript already carries the framing — while the surrounding flow still runs.

## Flows

- Frame the agent → opening prompt (pausing on its questions) → scaffold retry, if a build produced nothing → backlog loop → live chat → end.
- On any stop or failure: classify why, emit a clean end event, and release the driver session.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
