Reads a project's ticket backlog for the dashboard, so what the agent plans from is visible without opening the repo.

## TLDR

- A ticket is one file; its plan and its claim are sibling files folded into it, never rows of their own — "planned" means a plan exists, "locked" means an agent holds a claim (an unreadable claim still locks; the holder's name is only display sugar).
- Deliberately tolerant of tickets predating the format: a missing heading, summary, or key falls back rather than dropping the ticket, and the plan's effort/uncertainty values ride along when named.
- A ticket's date is the one its filename carries, falling back to file time, so mere edits do not reshuffle the newest-first list.
- Ticket names taken from the browser must be bare filenames, so they can never address another directory; the last GitHub-import stamp reads any malformed state as "not known" rather than failing.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
