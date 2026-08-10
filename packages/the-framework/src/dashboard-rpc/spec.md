The browser's call surface into the daemon: every dashboard read and write arrives here, and steering a session means appending a command to that session's own control file — the same append no matter who asked (dashboard click, Discord message, or remote device).

## TLDR

- Reads are thin projections of the daemon's read models; live session events stream over one channel per session, tailing that session's own log. A watcher never misses a session's ending: when the log is archived out from under a live stream at teardown, the stream follows it into the archive and delivers exactly what it had not yet shown — once.
- Writes are commands: stop, answer a choice, send a message, arm the handoff, push, open PR, merge, start a session, queue a ticket. Each becomes an entry in the target session's control file, which the session tails — there is no direct channel into the running process.
- Two routing decisions live here and nowhere else: which checkout a session-scoped call resolves to (the session's worktree vs. the project root), and whether a call is local or belongs to a relayed session on a remote device — in which case it is forwarded, against a deliberate allowlist on the device side.

## Before modifying this file

Read this file's format at https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
