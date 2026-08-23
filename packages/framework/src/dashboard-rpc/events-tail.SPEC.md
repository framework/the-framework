Follows an agent's event log — everything already recorded, then every line appended after — and keeps following it when the log moves, so a live feed never goes silent because the agent's worktree was retired.

## Business logic — TL;DR

- **Replay, then follow** - a subscriber first receives everything the event log already holds, and from then on each new event as it is appended; a line that is not a complete, well-formed event is skipped rather than breaking the feed.
- **The end of the replay is announced once** - the subscriber is told when the history is fully delivered, and never told again, so a reconnecting dashboard can hold the replay back and swap its feed in one go instead of blanking while history re-streams.
- **The log is followed across its moves** - when the followed file disappears after having existed, its new home is looked up and followed from where the reading left off, with nothing replayed twice.

## Business logic

### Replay, then follow

#### User story

The user opens an agent's feed in the dashboard, part-way through its work, and sees everything that has happened so far followed by everything that happens next.

#### Business logic

The event log is read from the beginning and every event handed to the subscriber, and only then does the following of new appends begin — so no newly appended event can be delivered ahead of the history. Appends are noticed as the file system reports them, with a once-a-second re-read as a backstop for the notifications that never arrive. Malformed lines are skipped. A subscriber can stop at any time, which removes both the watch and the backstop.

### The end of the replay is announced once

#### User story

A dashboard tab that lost its connection reconnects and re-subscribes. The user must not watch the whole history scroll past again, nor see the feed go blank while it does.

#### Business logic

Exactly one announcement marks the point where the replay of the existing log has been fully delivered. It fires before any newly appended event, it fires even when the first read failed — a subscriber waiting on it forever would freeze its feed — and it fires for an agent whose log cannot be located at all. A relocation of the log is not a new replay, so the announcement never fires a second time.

### The log is followed across its moves

#### User story

An agent finishes while the user is watching it. Its event log is copied into its archive and its worktree is removed; later the same agent may be continued in a fresh checkout. The feed must show the agent's final events and keep working throughout.

#### Business logic

A followed log that disappears *after* having existed is treated as a move, not an ending: the log's current home is looked up again — the archive once the worktree is gone — and followed from there. Because the moved copy is identical, reading resumes where it left off and nothing already delivered is repeated. A log that has never existed yet means an agent that is still starting up, so nothing is relocated and the current location keeps being polled. When the lookup answers with the same location, or with none, the current location is kept.

#### Rationale

A feed pinned to one fixed path could miss an agent's last events entirely: the moment the worktree was retired, the poll found no file and had nothing left to read, so the feed never learned that the agent had ended.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
