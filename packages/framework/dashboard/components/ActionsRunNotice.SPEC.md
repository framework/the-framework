Tells the user, on an agent whose run target is `actions`, that the agent is running on a GitHub Actions runner and — while it is still going — that its events only arrive once the run finishes, and links out to the live Actions run when its URL is known.

## Rationale

A GitHub Actions run replays its whole transcript in one burst at the end, so the agent's live feed sits empty and looks stalled. The notice says the wait is expected. For every other run target it shows nothing.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
