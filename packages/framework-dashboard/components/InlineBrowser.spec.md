The browser preview inline in the transcript (#1455 item 6b): the body of the latest `browser` row.

## TLDR

- A fixed 16:10 box (`aspect-[16/10] max-h-96`), full column width, the screencast letterboxed inside — the same proxied stream the rail's Browser tab shows (`BrowserPanel inline`), so the two surfaces can never disagree.
- The degrade ladder (#1359 — never a dead control): `live` → the interactive pane, which hands back a still of the newest frame every ~2s via `onFrame`; `live` flips false on the mounted component (the run ended under the reader) → the last still with a one-line "preview ended — session finished" overlay, never a dead stream or a spinner; no still captured (reader arrived after the end, or no frame ever painted) → the row is just its `browser · <url>` one-liner.
- The still lives only in this viewer's memory (React state), upholding the frames-never-enter-the-log rule — which also means a reloaded page has no still and shows the one-liner. Accepted for v1.
- The rail's Browser tab stays (v1): this is the in-flow surface, the rail is the bigger one.
