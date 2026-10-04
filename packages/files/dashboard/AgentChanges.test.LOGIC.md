What the tests cover, for the count of files a working agent [1] has changed, rendered alone with the module's reads stubbed:

- **The count** - the agent's changed files are read once from its own checkout by the agent's id; the count reads "2 files" with "+13" (two files, 13 added, 1 removed) and no file is named.
- **Nothing changed** - an agent that changed nothing shows no count.
- **An agent that stops** - keeps the count it ended with and reads nothing more.
- **Another agent** - when the page shows another agent, the first agent's count is not shown as its count.
- **An agent never seen working** - reads nothing and shows nothing, since its checkout may be gone.
- **A failed read** - shows nothing instead of throwing.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch, started through the project's start hook and shown in the dashboard from the files its tool keeps.
