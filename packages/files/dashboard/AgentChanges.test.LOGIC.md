What the tests cover, for the count and the list of files a working agent [1] has changed, both rendered on one fake agent page with the module's reads stubbed:

- **The count** - the agent's changed files are read from its own checkout by the agent's id; with the action bar closed the count reads "2 files" with "+13" (two files, 13 added, 1 removed) and no file is listed.
- **The list** - with the action bar open, the files are listed by name with their state ("modified" for a changed file, "new" for an untracked one), and the count and the list share one read.
- **Nothing changed** - an agent that changed nothing shows no count, no list and no "Changed files" section.
- **Diffs on demand** - no file's diff is read until its row is expanded; expanding a row reads that file's diff for the agent and shows it.
- **An agent that stops** - keeps the count it ended with, reads nothing more, and drops its list.
- **An agent never seen working** - reads nothing and shows nothing, since its checkout may be gone.
- **A failed read** - leaves both silent instead of throwing.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch, started through the project's start hook and shown in the dashboard from the files its tool keeps.
