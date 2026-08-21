The Overview's AI Queue card: every project's open entries in its queue file (`TODO_AGENTS.md`) — the work the framework picks up on its own — shown in full, each readable and startable.

## Flows

- An entry's title opens what it names: a queued ticket opens its own ticket page in-app, an external link opens in a new tab, and a plain-text entry is not clickable at all.
- The play button starts one unattended agent on that entry alone — the same work the framework's periodic queue drain would get to, now on the user's click — then jumps to the agent it started.
- The agent is prompted with the raw queue line rather than the pretty title, so it can find exactly that entry and check it off.
- A refused start stays put and shows the reason; the queue is never collapsed behind a "+N more".

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
