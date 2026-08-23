An already-answered gate, collapsed to a single line: what was asked and that it was decided stay visible, and expanding shows which options were picked.

## Business logic — TL;DR

- **A decided question stays readable** - an answered gate collapses to one line marked as answered, rather than disappearing once the user picks.
- **Expanding shows the whole decision** - every option that was offered is listed, with the picked ones ticked and the rest greyed; picking nothing reads as "Accepted none".

## Business logic

### A decided question stays readable

#### User story

The user answers a gate and later wants to check what the question was and what they chose.

#### Business logic

An answered gate shows as one line: a tick, the question's title, and a control that reads Expand or Collapse. It costs no more of the page than a row. The same collapsed line is used both by the pooled open questions list — which adds which agent asked and, when expanded, a link into that agent — and by an agent's own event log, where it adds nothing extra.

### Expanding shows the whole decision

#### User story

The user wants to see not only what was chosen but what the alternatives were.

#### Business logic

Expanding lists every option the gate offered. Options that were picked are ticked and shown in full strength; the others are greyed. A multi-select gate can end with nothing picked, which reads as "Accepted none" rather than as an empty list.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
