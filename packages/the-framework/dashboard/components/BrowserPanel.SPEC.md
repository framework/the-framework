The live view and remote control of the agent's own browser — in the right rail or inline in the transcript — which is what lets a human get the agent past a login wall.

## TLDR

- The browser streams in as live video, and clicks, scrolls, and typed keys go back to the real page, with clicks rescaled so they land where they look like they land.
- An unreachable stream says so and offers Retry; a failure belongs to that one attempt, so retrying, switching agents, or coming back later always tries fresh instead of replaying it.
- It can hand out a periodic still of the newest frame, so a pane whose agent ends degrades to a snapshot rather than a dead stream — frames live only in this viewer's memory, never in the log or on disk.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
