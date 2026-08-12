The contract every execution environment ("runner") fulfills: boot an isolated workspace where autopilot can write files, run commands, keep a dev server going, and get a URL to the running app.

## TLDR

- A booted session offers a private filesystem, one-shot commands, optionally a way to run a long-lived server in the background, and optionally a reachable preview URL.
- Optional abilities are signaled by simply being absent — callers check whether the ability exists rather than consulting flags.
- Every session can be torn down, releasing whatever it held.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
