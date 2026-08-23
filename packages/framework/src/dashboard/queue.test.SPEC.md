What the tests cover: checklist entries are extracted from a `TODO*` document with their ticked state, at any indentation and with any list marker, while headings, prose and empty entries are ignored; entries written as ticket links with no checkbox count as open work — the case that once made a triage-written agent queue read as "Nothing queued" while the daemon drained the same file — and the resulting set of open entries matches, item for item, what the daemon's own queue-draining sweep reads; the roll-up counts open and total entries per project, orders projects most-open first, and omits a project that has no `TODO*` document, no parsable entries, or documents that cannot be read; a `TODO*` document is recognised by its file name wherever in the repo it lives.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
