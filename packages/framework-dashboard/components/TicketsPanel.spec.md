One project's tickets list (#697/#1144): `tickets/*.md` as scannable one-liner rows plus the Import/Update-from-GitHub bar. The row itself is the exported `TicketRow` (title, project in flat mode, topics, claim marker, effort/uncertainty, priority, age, plan column, GitHub link), extracted so the cross-project flat list renders the same row with per-row project context.

## TLDR

- Rows: click opens the detail page via `onOpen(file)` — the file IS the route slug; "Priority: N" is spelled out (a bare number is cryptic, #1265); age with full-datetime tooltip; the summary moved to the detail page; `Effort: N` / `Uncertainty: N` badges carry the plan preamble's numbers.
- The claim marker (#1420/#1144): a `locked` ticket wears a hammer + its holder inline (truncated; a still 1-2s hover is how nobody discovers anything), with a tooltip saying what the icon cannot — the agent is *planning or implementing* the ticket. With `onClaimedClick` it is a button that narrows the page to claimed tickets.
- Click-to-filter (#1144): with `onTopicClick`, topic badges become buttons that add their topic to the page's filter; without handlers both render as plain badges (the panel works on pages with no filter state).
- The metadata cluster is a *sibling* of the row's open button, like the plan cell and GitHub link always were (an interactive control nested in a button is invalid HTML — and the badges are controls now).
- Plan column (#685), a fixed cell past the date, a clipboard pair so both states read as "a plan": `planned` → a `ClipboardList` link in strong `text-info` (blue), `strokeWidth={2.5}` so it reads bolder, that opens the plan view via `onOpenPlan(file)`; not planned → a `ClipboardPlus` button in `text-muted-foreground/50` (light grey) that starts a session with `planPrompt(file)` = `Create tickets/<stem>.plan.md`. Colour and weight, not just the glyph, tell the two near-identical clipboards apart (bold blue = a plan that exists and pops, faint grey = a recessive create action) and let the column be scanned for what's planned. (`info` not `primary` for the blue: the theme defines `--primary` as the same colour as `--success`.) It replaces the old "planned" badge — the badge said the state, the column says it *and* gives the reader somewhere to go with it. `onOpenPlan` is optional; without it the link renders disabled.
- Empty `tickets/` → "Import tickets from GitHub"; filled → "Update from GitHub" bar with the last-import stamp from `onTicketsMeta` (#1208) — "update" would be a strange word for filling a never-filled directory.
- All three session starts go through one `startSession(prompt, failure, options)` → `sendStart(projectId, prompt, 'prompt', options)` then `onRunStarted(prompt, runId)` so the shell jumps to the working session instead of leaving stale rows (#948/#1169). Import/Update pass `{unattended: true}` (#1279 — routine work, ends at settle, armed handoff fires); the plan spike passes `{}` — attended, since a per-ticket plan is a session you land in and steer, reviewed afterwards through the plan link.
- `hiddenByFilter > 0` with zero visible tickets renders "N hidden by the current filters" (plus a Clear button when `onClearFilters` is passed) instead of the import offer — importing would ask for work already done (#1230).
- No `projectId` renders nothing; unloaded shows "Loading…"; the panel never re-sorts — `readTickets` order is the server's job.

## Decisions

- `IMPORT_PROMPT`/`UPDATE_PROMPT` are `presets.importTickets.render()` / `presets.updateTickets.render()`, not inline text: this panel and the onboarding checklist offer the same labels, and they once sent different instructions — "two prompts behind one label is a button whose behaviour depends on where it was pressed" (#697); kept short per #674 (over-specifying a preset earns nothing the context fragment doesn't carry).
- Update is its own preset, not an import flag: import fills an empty directory, update reconciles a full one and must leave existing plans alone (#1208).
- The GitHub link and the plan cell are *siblings* of the row's button (an interactive control nested in a button is invalid HTML, and each goes its own place); a fixed `w-20` spacer stands in when there's no issue so the columns stay aligned, and the plan cell is a fixed `w-10` so it lines up row to row.
- `planPrompt(file)` is exported plain text, not a preset: the button is the only place it is said, so the test asserts the exact ask against it (#1187).
- `NO_META` is a module constant — `useLoaded` treats a fresh `{}` literal as a new value every render.
- `onTicketsMeta` is read here, not passed down: on the cross-project page it's the one extra read a section adds.

## Facts

- Title is the row's one flexible column (truncates/stretches); tags pack right-aligned against snug fixed-width priority (`w-16`) and date (`w-14`) columns rendered even when empty so rows line up.
- Stamp admits "No record of an import yet" for repos imported before the stamp existed, rather than inventing a date.
