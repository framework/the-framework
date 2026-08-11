Runs a single prompt through the coding agent as its own session — no build scaffolding, no review loop — pausing whenever the agent stops to ask and continuing from the user's answer.

## TLDR

- The path behind prompt-shaped presets (research, review, and the like): the prompt works on existing code, and honoring its question gates is the whole point.
- Emits the same event stream a build run does, so the dashboard, storage, and run controls work unchanged.
- The same spending guards as a build run: a budget cap or the account's quota boundary stops the run cleanly between turns.
- Can resume a finished run's conversation (the message is sent as a plain continuation, since the old transcript already carries the framing) and can take live chat messages once the prompt settles.
- A headless run resolves each question to its default and carries on — the prompt's later steps must run either way.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
