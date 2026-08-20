Keeps an agent's process alive while it is parked waiting for a human's answer, and lets it exit the moment nothing is parked.

## Flows

- Overlapping waits share one hold, and the last to settle releases it.

## Rationales

- A background-started agent has nothing else keeping it running between turns, so without the hold it could silently exit mid-wait — leaving answers that arrive later with nothing to read them.
- Waiting for the answer is the agent's work at that moment, so holding the process open is right exactly then and nowhere else.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
