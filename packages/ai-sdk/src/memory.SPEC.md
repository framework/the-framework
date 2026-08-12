The built-in in-process user memory (for tests and dev) plus the rule deciding whether memory applies to a given call.

## TLDR

- Facts are stored per user with optional tags and confidence scores; recall matches the query to facts by shared words, so a natural-language question pulls facts mentioning any of its meaningful words.
- Owners only: a user can only forget their own facts, and wiping one user leaves everyone else's memory intact.
- Whether a call uses memory follows a precedence: the per-call choice beats the agent's own declaration, and either can opt out entirely.

## Rationales

- Word-overlap recall is a deliberate "smarter than substring" baseline, not a search engine — production apps plug in their own database- or embedding-backed store.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
