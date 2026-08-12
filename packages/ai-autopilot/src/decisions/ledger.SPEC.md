The ledger itself: the ordered record of a project's decisions, which the agent checks before proposing an idea so a rejected one is never pitched twice.

## TLDR

- Recording an idea that already exists replaces the earlier entry (say, first rejected, later accepted) without losing its place in the record.
- Consulting compares the words of a new idea with the words and tags of each recorded decision; enough overlap is a match, closest matches first.
- A match against a rejected decision means "already turned down — do not re-propose".
- The whole ledger converts to and from the human-readable DECISIONS.md.

## Rationales

- Matching is plain word overlap — deterministic and cheap enough to run before every single proposal; a smarter semantic matcher could replace it later without changing how the ledger is used.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
