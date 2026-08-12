The React hook that lets a component drive a streamed agent run and render it live.

## TLDR

- Exposes the run's status, the growing transcript, and whatever the run is waiting on — browser-tool calls or an approval — plus actions to start, answer, approve, reject, and reset.
- A paused run still counts as running: the UI shows the prompt, and the same logical run continues once the user answers.
- Starting a new run or resetting aborts whatever was in flight.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
