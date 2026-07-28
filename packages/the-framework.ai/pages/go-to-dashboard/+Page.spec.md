`/go-to-dashboard` page: explains that the dashboard runs 100% locally (opened from the terminal) and gives run / install / one-time-run commands as click-to-copy chips.

## TLDR

- Three `Step` sections: Run (`the-framework`), Install (global install per package manager), One-time run (`npx`/`dlx`/`bunx` variants).
- `Cmd` — click-to-copy command chip (the hero install-chip recipe): `body` renders the command, `resolve()` returns what a click copies; side tooltip flips to "copied!".
- `PmCmd`/`PmTabs`/`PmSnippet` — pre-render all four PM command variants shown/hidden via `html[data-pm]` CSS; tabs call `pickPm()` so the choice is shared globally (and with the hero).
- Reuses `TopNav`, `Footer`, `useCopy`, and the `PMS`/`currentPm`/`pickPm` machinery from `../index/`; copy resolves the currently visible variant via `currentPm()`.
