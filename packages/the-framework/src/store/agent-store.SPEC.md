Agent persistence: an agent's history is its append-only event log, and everything shown about it is folded from that log.

## TLDR

- The log is the truth; the snapshot beside it is a fold of the log, kept for cheap reads.
- Finished agents are archived into the repo per user, so a project's history is a team record that survives a `git clean`.
- An agent that died without saying goodbye is given its ending, wherever it is found.

## Flows

- Each event is appended to the log and folded into a small snapshot, so a list read costs one file instead of a replay. A restarted dashboard rehydrates by replaying the log itself.
- Only orchestration events are stored; the agent's own transcript belongs to the agent.
- On close, a finished agent's log and snapshot are copied into the archive: the project's committed per-user directory, or the transient one when the agent has no worktree of its own.
- Listing a project's history reads every user's archive and the transient one, shows an agent once when it appears in both, and prefers an agent's live copy to its archived one.
- The snapshot is renamed into place rather than written over, so a reader outside the agent's process sees a whole snapshot or the whole previous one. One that arrives unreadable is read again before it is called corrupt.
- An agent whose process is provably dead has its missing ending written on its behalf — into the log as well as the snapshot. An owner that cannot be probed is left alone until boot.
- An archived snapshot can be patched afterwards with a fact discovered once the agent's process is gone, such as the pull request opened for its work.
- Ids are timestamps made path-safe, so id order is time order.

## Rationales

- A live agent must never blink out of a listing, because readers act on that absence: it is why a torn snapshot is re-read, and why the write is a rename rather than a truncate.
- The ending is written into the log too, or the agent's last question renders as answerable forever.
- An owner on another machine, or one with no record of its process, is cleaned up only at boot: a routine read must not kill an agent another machine is still driving.
- Everything here is known by one name. What the snapshot and the archive directories were called before is not looked for, so state left under the old names reads as absent.
- A record is the right home for a late fact either way, so a surface reading it never has to know which path produced it.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
