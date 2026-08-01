The right sidebar (#314 third rail): a tabbed panel column offering Files, Choices, Views, Browser, Docs and Log for the selected project/run, with the loop verdict pinned beneath.

## TLDR

- Tabs: Files (project file tree, #492), Choices (interactive gates, #440), Views (agent-pushed markdown, #441), Browser (preview proxy, #813), Docs (PLAN/TODO), Log (committed project log).
- Choices/views arrive via props from the shell's live event stream; docs/log are polled here via Telefunc (`onDocs` 4s, `onProjectLog` 10s) — read in the rail, not in the panels, because the rail must know emptiness to decide which tabs exist (#1146).
- `docsInMain` (#1455 items 2/3): while the launcher is the main view it renders Docs/History in its own column (`ProjectDocs`/`ProjectHistory`), so the rail withholds both tabs and skips both polls; session views pass nothing and keep the full rail.
- Every tab is earned by content (#1146): an empty panel gets no tab, and a rail with no tabs renders nothing (`null`). Not-yet-loaded counts as "has content" so project switches don't blink the rail.
- Auto-focus rules (#695/U22): only a genuinely fresh choice gate (unseen id) or the *first* view pulls the active tab; after the user picks a tab manually (`touched` ref), no auto-defaulting.
- `LoopStatusCard` is pinned under the panel, not a tab: a standing fact about the run, visible whichever tab is open, with its own scroller capped at 33% height.

## Decisions

- Fixed `w-[27rem]` width for every tab — the per-tab wide mode from #862 was dropped so the rail reads as one stable column.
- Browser tab requires `hasBrowser && target !== 'actions'` (#1053: no browser on a GitHub Actions runner) plus a `runId`; a dead tab "teaches people the preview is broken".
- If the remembered tab loses its content (last doc deleted, gate resolved), fall back to the first tab that still exists rather than render an empty panel.
- Tickets was a rail read (#697) but moved to its own full page (#1144).

## Facts

- Files badge counts only `files ∩ context` — the shared context set also holds whole-repo project paths from the Start form's checkboxes which aren't in `files` (#661).
- Tab strip is `role="tablist"` with `flex-wrap` (up to 7 tabs clipped without it, #948).
- `target` values: `'local' | 'actions' | 'remote' | 'web'` (#1053/#610/#1067).
