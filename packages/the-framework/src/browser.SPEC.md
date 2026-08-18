The agent launches its own browser with a shared remote-control port, so the agent's browser tools and a human's preview can watch the very same page — a second viewer cannot attach to a browser that launched privately.

## TLDR

- Finds the machine's Chrome (explicit override first, then the well-known locations, then the PATH); none found means the agent's browser tools fall back to launching their own — a missing browser costs the preview, never the tools.
- Headless, on a throwaway profile: an agent never inherits or dirties the user's real browser session.
- The port opens a beat after the browser starts, so the agent waits for it to answer before handing the address on; a browser that dies or never listens is cleaned up rather than left as a dead address.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
