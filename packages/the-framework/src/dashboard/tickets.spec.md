Reads the `tickets/` backlog for the dashboard (#697): ticket list rows, one ticket's full detail, ticket presence, and the last-import stamp.

## TLDR

- `readTickets(cwd)`: every non-sibling `.md` in `tickets/` as a `WorkspaceTicket` — title (`# ` heading, else the filename made readable), summary (the `## TLDR` line, else first prose line), preamble keys (`priority:`/`topics:`/`GitHub:` above the title), date, `planned` (a sibling `.plan.md` exists), `locked`/`lockedBy` (a sibling `.lock.md` claim, #1420), and the plan preamble's numeric `effort`/`uncertainty` — newest first; `[]` when the dir is missing (the state the view offers to import into).
- `readTicket(cwd, file)`: one ticket with full markdown for its own page (#1144); null on non-bare filenames (no path segments — cannot address another directory), siblings, or missing files.
- `hasTickets` (#958): a bare `readdir` presence check, because the Onboarding checklist asks yes/no for every project on each poll — parsing every ticket to answer would be paid over and over.
- `readTicketsMeta` (#1208): the `tickets/meta.json` `lastImportedAt` stamp written by the importing agent; every failure (missing, unreadable, not JSON, unparseable date) reads as `{}`.

## Decisions

- Deliberately tolerant parsing: existing tickets predate the format (GitHub imports — heading, prose, trailing `Source:` line), so anything missing falls back rather than dropping the ticket.
- There is no `status` field (the #1230 key is retired): the format removes a closed ticket from the repo, so everything in `tickets/` is open work by construction; a leftover `Status:` line is preamble noise, not read.
- Date (#1144/#1265): the `<DATE>_<SLUG>.md` filename's date (midnight UTC) when present — the one true "when", since mtime moves on every mere edit (the GitHub update reconciling a ticket, #1208) — else mtime for tickets predating the format; a failed stat sorts last (epoch), never throws.
- A `.plan.md`/`.lock.md` is written *about* a ticket, never a row of its own: it marks its ticket instead. (`.spike.md` support is fully removed — #1420 folded the spike into the plan, and no spikes exist anymore.)
- A `.lock.md` sibling is an agent's claim, not a document (#1420): it never becomes a ticket row, existence alone means `locked` (a malformed `CLAIMED:` line just drops `lockedBy` — the holder is display sugar for the release button), and the lock covers the ticket's whole life — the agent may be planning the ticket or implementing it directly — so `locked` composes with `planned` rather than excluding it.
- `effort`/`uncertainty` are the plan preamble's own `Effort: 0-10` / `Uncertainty: 0-10` keys (`ticketing_format.md`), read above the `# [Plan]` heading only; values off the 0-10 integer scale are not clamped into something plausible (`planScale`, same stance as `todoPriorityForTicket`).
- Only the head of a ticket is parsed for the list (4KB): tickets can be long and nothing below the head is shown.
- The meta stamp is validated as a parseable date, not merely non-empty: it renders as a date, and an unparseable one would show "Invalid Date" in the one place claiming to be factual.

## Facts

- `topics: [dx, ui]` brackets are cosmetic — stripped, not required. `GitHub:` is a bare markdown link split into label (verbatim, e.g. `#42`) and URL.
- The bare filename is a ticket's identity (`WorkspaceTicket.file`), the key overview.ts joins runs/queue entries on.
