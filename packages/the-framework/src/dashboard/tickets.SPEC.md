Reads a project's ticket backlog for the dashboard, so what the agent plans from is visible without opening the repo.

## User Stories

- The user browses a project's ticket backlog on the dashboard, newest first, without opening the repo.
- The user sees, per ticket, whether a plan exists and whether an agent holds a claim on it — and whose claim they would be releasing.
- The user's tickets from before the ticket format still show up; nothing is dropped over a missing heading or key.

## Flows

- A ticket is one file. Its plan and its claim are sibling files folded into it, never rows of their own: "planned" means a plan file exists, "locked" means an agent holds a claim file. An unreadable claim still locks — the file's existence is the claim; the holder's name is only display sugar.
- Deliberately tolerant of tickets predating the format: a missing heading, summary, or key falls back rather than dropping the ticket, and the plan's effort/uncertainty values ride along when named.
- A ticket's date is the one its filename carries, so editing a ticket does not reshuffle the newest-first list; only a ticket predating the dated-filename format falls back to file time and moves when edited.
- A ticket name taken from the browser must be a bare filename, so it can never address another directory. The last GitHub-import stamp reads any malformed state as "not known" rather than failing.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
