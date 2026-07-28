Presentational event log shared by the live stream and past-run replay: framework events as human-readable rows with conversation-style YOU/AGENT messages.

## TLDR

- Most events render via `formatFrameworkEvent` — the same formatter the terminal uses, so a driver turn reads "· Read" / "‹ turn complete" rather than raw JSON.
- Conversation rows: the user's prompt (driver `start`) and the agent's reply (driver `text`) render their raw text as compact Markdown; a long one (>100 chars after whitespace collapse, mirroring terminal.ts's `truncate`) clamps to its first line with a rotating chevron and expands in place (#476/#520) — the same rendered Markdown unclamps, so the opening is never shown twice.
- The system prompt renders as a char-count `<details>` summary with the full text behind a click.
- Kind badge shows once per run of same-group rows (`rowGroup`) — a 200-line driver turn used to be 200 identical badges (#948); a driver `start` breaks out of the AGENT group so the prompt gets its own YOU badge. Badge column is fixed `w-28` so text aligns.
- Arrival times (`receivedAt`) show at group boundaries with the full timestamp on hover; replayed events were never live, so they show none.
- Scrolling rides shadcn's Base UI message-scroller (#712): live follows the edge (`autoScroll`/`stick`) but yields when the reader scrolls up; replay renders static from `openAt` (a replay opens at the outcome, #948, not page one); "Jump to latest" is the scroller's own inert-when-not-scrollable button; driver `start` rows are `scrollAnchor` turn boundaries.
- `tail` (#1265) pins arbitrary content after the last row INSIDE the scroller — a web run's live mirror box must scroll (and stick) with the log rather than float over it.
