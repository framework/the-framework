Keeps a run's process alive while it is parked waiting for a human's answer, and lets it exit the moment nothing is parked.

## TLDR

- A background-started run has nothing else keeping it running between turns, so without this it could silently exit mid-wait — leaving answers that arrive later with nothing to read them.
- Waiting for the answer is the run's work at that moment, so holding the process open is right exactly then and nowhere else: overlapping waits share one hold, and the last to settle releases it.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
