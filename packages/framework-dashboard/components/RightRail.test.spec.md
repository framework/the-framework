Tests for `RightRail.tsx` — covers the fixed one-width rail (no per-tab expand, #862 dropped), no rail without a project, Browser tab offered locally but never for `target="actions"` (#1053), the loop verdict pinned as a non-tab that survives tab switches, and the content-earned tab rules (#1146): empty reads drop tabs, all-empty drops the rail, live surfaces (views) keep it, pending reads hold tabs to avoid blinking, and a manually-picked tab losing its content falls back to one that still has some.

## Facts

- Telefunc reads (`onDocs`, `onProjectLog`) are stubbed at the module boundary; panels are stand-in mocks — the suite is about tab logic, not panel rendering.
