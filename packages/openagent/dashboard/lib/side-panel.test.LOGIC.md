Tests of `side-panel.ts`.

- **Names** - an agent's page is named by its project and agent; the "New agent" page has the same name for every project.
- **At most 200** - after 201 panels are opened, 200 are remembered and the first one opened is forgotten.
- **Something unreadable** - with something else kept under the key, opening a panel leaves that one page remembered open.
