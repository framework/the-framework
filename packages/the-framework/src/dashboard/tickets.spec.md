Reads the `tickets/` backlog for the dashboard (#697): ticket list rows, one ticket's full detail, ticket presence, and the last-import stamp.

## TLDR

- `readTickets(cwd)`: every non-sibling `.md` in `tickets/` as a `WorkspaceTicket` — title (`# ` heading, else the filename made readable), summary (the `## TLDR` line, else first prose line), preamble keys (`status:`/`priority:`/`topics:`/`GitHub:` above the title), date, `spiked`/`planned` (a sibling `.spike.md`/`.plan.md` with real content — a `PENDING:<agent>` placeholder reads as `locked` instead, #1327), and `effort` — newest first; `[]` when the dir is missing (the state the view offers to import into).
- `readTicket(cwd, file)`: one ticket with full markdown for its own page (#1144); null on non-bare filenames (no path segments — cannot address another directory), siblings, or missing files.
- `hasTickets` (#958): a bare `readdir` presence check, because the Onboarding checklist asks yes/no for every project on each poll — parsing every ticket to answer would be paid over and over.
- `readTicketsMeta` (#1208): the `tickets/meta.json` `lastImportedAt` stamp written by the importing agent; every failure (missing, unreadable, not JSON, unparseable date) reads as `{}`.

## Decisions

- Deliberately tolerant parsing: existing tickets predate the format (GitHub imports — heading, prose, trailing `Source:` line), so anything missing falls back rather than dropping the ticket.
- `status` defaults to `open`: a ticket written before the field existed (or with a malformed value) is still open work, not silently dropped from the default view (#1144/#1230).
- Date (#1144/#1265): the `<DATE>_<SLUG>.md` filename's date (midnight UTC) when present — the one true "when", since mtime moves on every mere edit (the GitHub update reconciling a ticket, #1208) — else mtime for tickets predating the format; a failed stat sorts last (epoch), never throws.
- A `.spike.md`/`.plan.md` is written *about* a ticket, never a row of its own: it marks its ticket instead.
- A `PENDING:` sibling is a concurrent spike agent's claim, not a document (#1327): it must not render the ticket as spiked/planned, and it contributes no effort. A real spike beside a placeholder plan is `spiked` and `locked` at once.
- `effort` is scanned from prose lines (`…effort…: value`, e.g. "Human intervention effort: low") in the `.spike.md` first, else `.plan.md` — the spike format is where the estimate is asked for, so it wins.
- Only the head of a ticket is parsed for the list (4KB): tickets can be long and nothing below the head is shown.
- The meta stamp is validated as a parseable date, not merely non-empty: it renders as a date, and an unparseable one would show "Invalid Date" in the one place claiming to be factual.

## Facts

- `topics: [dx, ui]` brackets are cosmetic — stripped, not required. `GitHub:` is a bare markdown link split into label (verbatim, e.g. `#42`) and URL.
- The bare filename is a ticket's identity (`WorkspaceTicket.file`), the key overview.ts joins runs/queue entries on.
