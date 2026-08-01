The workspace's PLAN/TODO docs on the launcher (#1455 item 2): moved out of the right rail into the main column, in the same `DocsPanel` presentation.

## TLDR

- Polls `onDocs(projectId)` (4s, the rail's own cadence) and renders `DocsPanel` — the rail's panel reused verbatim, so the two surfaces cannot drift; while this section shows, the rail withholds its Docs tab (`docsInMain`).
- A project with no docs gets no section — the rail's earned-by-content rule (#1146) carried over.
- The section caps its height (`max-h-[28rem]`) so a long PLAN scrolls inside it rather than taking the launcher column; `DocsPanel`'s own ScrollArea does the scrolling.
