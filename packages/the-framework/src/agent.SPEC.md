One agent: frame it, send it one prompt, honor the gates it answers with, work the backlog, and stay open for the user's own messages — every step streamed as events.

## User Stories

- The user watches every step of a live agent as an event stream the dashboard renders as a transcript.
- The user answers the agent's question and the answer continues the same conversation; with nobody at the keyboard, the recommended option is taken instead.
- The user declines the agent's plan and the agent stops cleanly instead of building on it.
- The user chats with a live agent, each message continuing the same conversation.
- The user resumes a stopped agent and it picks up the same conversation.
- The user reads the exact system prompt the agent ran under, with nothing appended to it behind their back.

## Flows

- Frame the agent → opening prompt (pausing on its questions) → scaffold retry, if a build produced nothing → backlog loop → live chat → end.
- A build and a verbatim prompt are one path: an opening prompt honoring gates. The whole difference is two options: which prompt opens the agent, and whether its own backlog is worked afterwards.
- Nothing about the project reaches the agent's prompt: the system framing shown on the dashboard is exactly and entirely what the agent runs under.
- Nothing reviews the work: the agent is a black box, and its turn is the whole of it.
- When a turn stops to ask, the user sees a live question, and the answer continues the same conversation — bounded, so an agent that keeps asking cannot loop forever. With nobody to ask, the recommended option is taken and the agent carries on, which is what an unattended one is for.
- An answer the agent marked as ending it does exactly that, and cleanly: a declined plan reads as a stop rather than a failure, and the agent is never resumed with it. It stops through the same signal a Stop does, so a decline cannot read as a finished agent on one path and a stop on another.
- Once the opening exchange settles, the user's own chat messages each continue the same conversation. An agent whose chat queue goes idle ends itself — unless its own surface is the only one there is, with no dashboard to resume through, in which case it stays parked for the next message.
- A build whose opening turn leaves the workspace empty means the agent stalled, so it is re-prompted once with a hard "create it from scratch" directive.
- An agent whose *location* is a cloud session ends at the hand-off, because every later phase would misread the hand-off note as the agent's own reply. Where an agent runs is its own axis, separate from which coding-agent CLI drives it.
- When the user resumes a stopped agent, the message is sent verbatim into the same conversation — the old transcript already carries the framing — while the surrounding flow still runs.
- On any stop or failure: classify why, emit a clean end event, and release the driver session.

## Rationales

- One path serves a build and a verbatim prompt alike: two orchestrators for the same lifecycle each carry their own copy of the system composition and drift apart.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
