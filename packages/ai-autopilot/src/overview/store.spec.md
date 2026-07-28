Persistence for the overview: `loadOverview`/`saveOverview` over an injected `OverviewFs`, the `OVERVIEW_FILE` constant (`CODE-OVERVIEW.md`), and the `nodeOverviewFs()` host-filesystem adapter.

## TLDR

- `loadOverview(fs, path?)` — `undefined` when the file does not exist (the expected first-run state, distinguishing "never generated" from "empty"), else `parseOverview(read)`.
- `saveOverview(fs, overview, path?)` — writes `serializeOverview(overview)`.
- `nodeOverviewFs()` — read/write/exists via `node:fs/promises`; `exists` is a `stat().isFile()` with errors mapped to `false`.

## Decisions

- `node:fs/promises` is imported dynamically inside the adapter so the overview core keeps no hard `node:fs` dependency — the map and its markdown work in any runtime (e.g. a WebContainer session); only this adapter touches disk.
