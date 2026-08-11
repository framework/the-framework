The app's left sidebar, present on every route: the brand, the global navigation (New, Overview, Tickets, Projects) and the recent-sessions rail, with the utility controls in the footer.

## TLDR

- "New" adapts to what exists: with no project it prompts to add one, with one it starts there, with several it opens a picker; inside a project it starts another session there.
- The rail lists a selected project's own sessions — or, on the Overview, every project's pooled newest-first, each row naming its project and jumping into it.
- Each row says what its session is really doing: a pulsing dot while the agent works, a still "waiting" when it is parked on you, "publishing…" while an ended run is still pushing or opening its PR, and "in cloud" for a web run whose real work continues elsewhere — plus glyphs for device-relayed and cloud runs, and the agent's logo.
- Clicking Start seeds an optimistic "starting…" row that retires the moment the real run lands (whatever state it lands in), with a deadline so a start that produced nothing does not pretend forever.
- The Overview item carries the Human Queue count — the one cross-project signal that stays visible.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
