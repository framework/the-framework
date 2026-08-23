Following an append-only journal as it is written — the one mechanism behind both directions of the file seam between an agent and the daemon: the daemon reading an agent's event log, and an agent reading its control channel.

## Business logic — TL;DR

- **Only what is new is delivered** - each read picks up exactly what was appended since the last one, so a follower never re-delivers what it already saw.
- **A half-written entry waits** - an entry whose end has not been written yet is held back until it is complete, and an entry that turns out to be unreadable is passed over rather than stopping the tail. The journal never rewrites history, so a bad entry can only be a torn write.
- **A restarted journal is re-read from the top** - when a fresh agent truncates the log in place, the follower notices and starts over, whether the file shrank or was rewritten to the same length.
- **A journal that moved keeps its place** - when an agent's `events.jsonl` is copied verbatim into its archive at teardown, and restored again when the agent is continued, the follower resumes exactly where it was: it delivers the entries the move would otherwise have swallowed, and replays nothing it already delivered.
- **Following is immediate but never depends on being told** - a file-change notification drives the tail for latency, and a periodic re-read backs it up because such notifications are unreliable across platforms; the periodic re-read alone is a complete tail. Reads never overlap, and following stops for good when it is stopped.

## Business logic

### Following can neither kill the process nor keep it alive

#### User story

An agent parked on the user must stay alive; an agent that has finished must exit. Neither may hinge on the plumbing that reads its files, and a read that fails must never take the process down with it.

#### Business logic

A failed read is survivable and is simply retried on the next round; a file-change notification channel that breaks is dropped and the periodic re-read carries the tail alone. Following can also be told not to hold the process open at all — which covers both the periodic timer and the change notifications, since either one on its own is enough to keep a process running.

#### Rationale

Steering an agent must never keep a finished agent alive, which is why the control channel's tail is the half that does not hold the process. Holding only the timer open was a half-measure: an agent whose configuration check failed before anything owned its file watcher would return from the command line and then sit there forever, recorded as still running. And because nobody waits on a read's result, a read that fails on a network mount or on a log grown impossibly large would otherwise take the whole process down; the failure is swallowed rather than reported, since a persistent fault would otherwise print on every single round.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
