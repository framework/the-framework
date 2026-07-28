One project's tickets list (#697/#1144): `tickets/*.md` as scannable one-liner rows (title, topics, spiked/planned/effort, priority, age, GitHub link) plus the Import/Update-from-GitHub bar.

## TLDR

- Rows: click opens the detail page via `onOpen(file)` — the file IS the route slug; only `closed` gets a status badge (open is the default assumption, like spiked/planned only showing when true, #1230); "Priority: N" is spelled out (a bare number is cryptic, #1265); age with full-datetime tooltip; the summary moved to the detail page.
- Empty `tickets/` → "Import tickets from GitHub"; filled → "Update from GitHub" bar with the last-import stamp from `onTicketsMeta` (#1208) — "update" would be a strange word for filling a never-filled directory.
- Both buttons `sendStart(projectId, prompt, 'prompt', {unattended: true})` (#1279 — routine work, ends at settle, armed handoff fires) then `onRunStarted(prompt, runId)` so the shell jumps to the working session instead of leaving stale rows (#948/#1169).
- `hiddenByFilter > 0` with zero visible tickets renders "N hidden by the current filter" instead of the import offer — importing would ask for work already done (#1230).
- No `projectId` renders nothing; unloaded shows "Loading…"; the panel never re-sorts — `readTickets` order is the server's job.

## Decisions

- `IMPORT_PROMPT`/`UPDATE_PROMPT` are `presets.importTickets.render()` / `presets.updateTickets.render()`, not inline text: this panel and the onboarding checklist offer the same labels, and they once sent different instructions — "two prompts behind one label is a button whose behaviour depends on where it was pressed" (#697); kept short per #674 (over-specifying a preset earns nothing the context fragment doesn't carry).
- Update is its own preset, not an import flag: import fills an empty directory, update reconciles a full one and must leave existing spikes/plans alone (#1208).
- The GitHub link is a *sibling* of the row's button (link-in-button is invalid HTML and they go different places); a fixed `w-20` spacer stands in when there's no issue so the priority/date columns stay aligned.
- `NO_META` is a module constant — `useLoaded` treats a fresh `{}` literal as a new value every render.
- `onTicketsMeta` is read here, not passed down: on the cross-project page it's the one extra read a section adds.

## Facts

- Title is the row's one flexible column (truncates/stretches); tags pack right-aligned against snug fixed-width priority (`w-16`) and date (`w-14`) columns rendered even when empty so rows line up.
- Stamp admits "No record of an import yet" for repos imported before the stamp existed, rather than inventing a date.
