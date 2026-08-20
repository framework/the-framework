The steering channel from the dashboard to a live agent — the reverse of the event stream: the daemon appends an instruction to a file in the workspace and the agent tails it, with no direct connection between the two.

## Flows

- The instructions: stop the agent, answer a parked gate, send a live chat message, move the end-of-work handoff, and a human's Merge — a pre-commitment that outranks the agent's own ready signal.
- The file is emptied when an agent starts, so a previous agent's answers can never fire into this one.
- The handoff instruction is one rung of the publish ladder, not a set of stage flags: a surface offering the stages as separate boxes resolves them on its own side.
- Every line is shape-checked and a bad one is skipped.

## Rationales

- The start-of-work reset is needed because gate names repeat across agents — an answer left behind would match a question it was never meant to answer.
- The handoff travels as one rung so an impossible combination of stages can never arrive here for the receiving end to repair upward.
- Bad lines are skipped rather than obeyed: an entry naming no rung must not silently stop an agent publishing its work.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
