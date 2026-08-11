The browser's call surface into the daemon: every dashboard read and write arrives here, and steering a session means appending a command to that session's own control file — the same append no matter who asked (dashboard click, Discord message, or remote device).

## TLDR

- Reads are thin projections of the daemon's read models; live session events stream over one channel per session, tailing that session's own log.
- Writes are commands: stop, answer a choice, send a message, arm the handoff, push, open PR, merge, start a session, queue a ticket — each becomes an entry in the target session's control file, which the session tails.
- Two routing decisions live here and nowhere else: which checkout a session-scoped call resolves to (the session's worktree vs. the project root), and whether a call is local or belongs to a relayed session on a remote device — in which case it is forwarded.

## Flows

- **A read**: project the daemon's read models to the browser, nothing more.
- **A live session stream**: one channel per session tails that session's log; when the log is archived out from under it at teardown, the stream follows it into the archive and delivers exactly what it had not yet shown — once.
- **A write**: append the command to the target session's control file and let the session pick it up.
- **A relayed call**: recognized as belonging to a remote device's session and forwarded to that device's daemon, against a deliberate allowlist on the device side.

## Rationales

- Commands travel through the control file because there is no direct channel into the running process — a session can be steered identically whether it is local, remote, or watched from Discord.
- The stream following the archived log is what guarantees a watcher never misses a session's ending.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
