Session persistence: a session's history is its append-only event log, and everything shown about it is folded from that log.

## TLDR

- Each event is appended and folded into a small snapshot for cheap list reads; a restarted dashboard rehydrates by replaying the log — no second source of truth to drift. Only orchestration events are stored; the agent's own transcript belongs to the agent.
- Finished sessions are archived into the repo under per-user directories and committed, so a project's history survives a `git clean`; every user's archive is listed (the history is a team record), duplicates show once, and a session's live copy beats its archived one — a continued session is both at once.
- The snapshot is rewritten by the session's own process while everyone else polls it from outside, so it is renamed into place rather than written over: a reader sees a whole snapshot or the whole previous one, never a truncated one. A live session must never blink out of a listing — readers act on that absence — so a snapshot that still will not parse, written by an older build, is re-read before it is called corrupt.
- A session that crashed without saying goodbye is healed wherever it is found: once its process is provably dead, the missing ending is written on its behalf — into the log too, so its last question stops rendering as answerable forever. An owner that cannot be probed (no record, another machine) is cleaned up only at boot, never by a routine read.
- Ids are timestamps made path-safe, so id order is time order.
- An archived snapshot can be patched afterwards for a fact discovered once the session's process is gone — the pull request opened for its work. A record is the right home for it either way, and a surface should not have to know which path produced it.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
