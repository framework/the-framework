Topics: [enhancement]
GitHub: [#1295](https://github.com/gemstack-land/the-framework/issues/1295)

# Feature inventory: every feature's name, how it works, how to test it

## TLDR

Agreed on Discord (2026-07-27): TF's status feels messy ("using TF feels like using a random generator") and fixing it needs someone who understands the whole business logic. The inventory is that understanding in writable, checkable form: one entry per feature, in the order a user meets them, each answering (1) name and what it's for, (2) how it actually works today with file anchors, (3) how to test it deterministically — fake agents first, so flows are checkable in seconds without Claude usage.

## Why it matters

Serves the number-one goal (dogfooding: TF works on quick-wins with zero human intervention). The inventory doubles as the source of truth the fake-agent e2e suite grows against: every "how to test it" line is a test to write, and a feature whose entry cannot be written simply is a feature to simplify.

## Order of work

The commit/push/PR/branch seam goes first: it's where most current bugs live and where the flow is least explainable. The #1277 audit already maps that seam end to end (every producer and consumer of a branch name, with file:line), so the first chapter can be lifted from it rather than re-derived.

## Source

Imported from GitHub issue [gemstack-land/the-framework#1295](https://github.com/gemstack-land/the-framework/issues/1295), created 2026-07-27, labels: `enhancement`, 0 comments.
