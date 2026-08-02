The project's session history on the launcher (#1455 item 3): moved out of the right rail into the main column, in the same `ProjectLogPanel` presentation (the committed `.the-framework/LOGS.md`, newest first).

## TLDR

- Polls `onProjectLog(projectId)` (10s, the rail's own cadence) and renders `ProjectLogPanel` — the rail's panel reused verbatim, so the two surfaces cannot drift; while this section shows, the rail withholds its History tab (`docsInMain`).
- A project with no finished sessions gets no section — the rail's earned-by-content rule (#1146) carried over.
- Height-capped (`max-h-[24rem]`) like the Docs section, so a long history scrolls inside it.
