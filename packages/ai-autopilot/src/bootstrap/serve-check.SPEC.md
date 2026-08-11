A production-grade check with teeth: rather than only asking a model, it boots the app in its workspace and confirms it actually serves.

## TLDR

- Install and build run first; if they fail there is nothing to serve, and that failure is the blocker.
- It then starts the app's server and fetches a page; a crash on boot, an unreachable server, or an error response each become a concrete blocker for the loop to fix.
- Checklists can be merged into one gate — blockers pooled, passing only when every check is clean — so an app must both read production-grade and actually run.
- A workspace that cannot run background servers skips the check (passing, with a note) rather than blocking forever.

## Rationales

- A server that accepts connections but never answers would stall the loop forever, so the probe is time-bounded and watches for the server dying — a boot crash is reported as a crash, not a vague fetch failure.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
