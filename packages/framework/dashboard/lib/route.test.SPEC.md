What the tests cover: reading the dashboard's address and writing it back.

- **Reading** - the root is the Overview; a single segment is a project's launcher; a second is one agent. A trailing slash and extra segments are ignored. Segments are unescaped, and a malformed escape sequence is kept exactly as typed.
- **Reserved words** - `settings` and `tickets` at the top level name their own views, belonging to no project, while any other first segment — including one that merely starts with a reserved word — is a project. Under a project, `tickets` names that project's ticket view while any other second segment is an agent. A third segment names one ticket by its filename, and `plan` as a fourth segment turns on that ticket's plan view; `plan` in the third position is just a ticket name.
- **Writing** - every address is written back: the Overview, a project, an agent, Settings, the cross-project ticket list, a project's tickets, one ticket, and a ticket's plan. Segments are escaped. An agent with no project has no address of its own and falls back to the Overview. Settings outranks a leftover project and agent, a project's ticket view outranks a leftover agent, and a plan with no ticket to hang off is dropped rather than written as a dangling path.
- **Round trip** - every address written is read back as the same thing.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
