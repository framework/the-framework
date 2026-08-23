Makes sure that stopping a coding-agent CLI stops everything it started, and that no agent process outlives the daemon.

## Business logic — TL;DR

- **Stopping an agent stops its whole tree** - the wrapped CLI spawns a deep subtree of its own (workers, searches, shell tool calls, MCP servers); signalling only the CLI itself would leave that subtree reparented and still burning CPU, so the entire group is signalled at once. A tree that has already exited is not an error.
- **A hard daemon exit still reaps the agents** - every live CLI the daemon spawned is tracked, and any exit path that does not go through the normal shutdown — a crash, an unhandled error, an immediate exit — force-kills the tracked trees on the way out. This is the last-resort net; Ctrl-C is handled earlier by aborting each agent first.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
