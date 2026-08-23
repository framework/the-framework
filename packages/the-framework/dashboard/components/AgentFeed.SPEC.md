One agent's feed: its event log, live while the agent runs and replayed once it has finished, or a placeholder before anything has streamed — "Waiting for the session to start…" for an agent that has yet to say anything, and whatever the caller states instead for a finished agent with nothing to replay.

## Business logic — TL;DR

- **A lost live stream is announced** - while the event stream is down the feed says so and that the agent keeps running, so "the agent went quiet" and "the connection died" are never confused.
- **A live feed follows the output, a finished one does not** - a running agent's feed sticks to the newest events; a finished agent's log is static and opens at whichever end the caller asks for.
- **Gates stay answerable** - the feed always knows which project and agent it belongs to, so an awaited choice in the log is rendered as the panel that answers it and can never degrade into plain text that leaves the agent parked with nothing to answer it.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
