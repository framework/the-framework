The steering channel from the dashboard to a live run — the reverse of the event stream: the daemon appends an instruction to a file in the workspace and the run tails it, with no direct connection between the two.

## TLDR

- The instructions: stop the run, answer a parked gate, send a live chat message, move the end-of-session handoff, bind a project-less run to a project, and a human's Merge — a pre-commitment that outranks the agent's own ready signal.
- The file is emptied when a run starts, so a previous run's answers can never fire into this one — gate names repeat across runs.
- The handoff instruction is one rung of the publish ladder, not a set of stage flags: a surface offering the stages as separate boxes resolves them on its own side, so an impossible combination can never arrive here for the receiving end to repair upward.
- Every line is shape-checked and a bad one is skipped: an entry naming no rung must not silently stop a session publishing its work.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
