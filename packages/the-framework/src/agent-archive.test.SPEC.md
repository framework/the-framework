What the tests cover: an email becomes its own archive directory name, trimmed and lowercased; a hostile identity can never produce a name that starts with a dot or holds a path separator, so `.`, `..` and absolute-looking values all fall back to `anonymous`; a missing, blank or absurdly long identity also falls back to `anonymous` rather than dropping the history; the identity is read from git once per project and reused afterwards; a repo where git reports no identity falls back instead of failing. A final test runs against real git and verifies that in an activated project everything under `.the-framework/` — the agent's live event log, the transient archive, and the agent checkouts — stays untracked, with the `.the-framework/.gitignore` marker itself as the one tracked file, so the framework never dirties the default branch.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
