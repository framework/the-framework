Agent persistence: an agent's history is its append-only event log, and everything shown about it is folded from that log.

## User Stories

- The user scrolls a project's history and sees every finished agent — their own and their teammates' — each shown once.
- The user reopens a finished agent and it picks up its own log again, so the continuation stays one history row, not two.
- The user never finds a crashed agent still shown as running, or still asking its last question.
- The user sees facts that land after an agent ended — the pull request opened for its work, the branch a cloud session landed on — appear on its archived row.

## Flows

- Each event is appended to the log and folded into a small snapshot, so a list read costs one file instead of a replay. A restarted dashboard rehydrates by replaying the log itself.
- Only orchestration events are stored; the agent's own transcript belongs to the agent.
- On close, a finished agent's log and snapshot are copied into the archive the dashboard's history lists: the per-user directory on the data branch (`tf-data`), or the untracked in-repo one when the agent has no worktree of its own.
- The history the user scrolls reads every user's archive plus the untracked one, shows an agent once when it appears in both, and prefers an agent's live copy to its archived one.
- A reader outside the agent's process always sees a whole snapshot — the new one or the whole previous one: it is renamed into place, never written over. One that arrives unreadable is read again before it is called corrupt.
- A dead agent never stays running in a listing: once its process is provably gone, the missing ending is written on its behalf — into the log as well as the snapshot. An owner that cannot be probed is left alone until boot.
- A fact discovered once the agent's process is gone — the pull request opened for its work, the branch a cloud session's work landed on — is patched onto the archived snapshot, so the agent's row shows it.
- Ids are timestamps made path-safe, so id order is time order and the history sorts newest-first by id alone.

## Rationales

- Archives live on the data branch, so a project's history is a team record that never touches the code history.
- A live agent must never blink out of a listing, because readers act on that absence: it is why a torn snapshot is re-read, and why the write is a rename rather than a truncate.
- The ending is written into the log too, or the agent's last question renders as answerable forever.
- An owner on another machine, or one with no record of its process, is cleaned up only at boot: a routine read must not kill an agent another machine is still driving.
- Everything here is known by one name: when a file or directory here is renamed, no fallback to the previous name is added, so state left under it reads as absent.
- A late fact is written onto the record itself because every surface already reads the record, so none has to know whether a fact arrived live or after the end.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
