The `DECISIONS.md` format: human-first, git-friendly serialization (`serializeDecisions`) and forgiving parsing (`parseDecisions`) that round-trip the ledger.

## TLDR

- Format: `# Decisions` header + intro prose, then one `## [status] Title` section per decision; an optional metadata bullet list (`- id:`, `- tags:`, `- date:`, `- superseded-by:`) directly under the heading; the prose beneath is the rationale.
- `parseDecisions` walks lines, flushing a section at each `##` heading; each flushed section goes through `defineDecision` (so parsed decisions get the same validation/defaults as recorded ones).

## Decisions

- Parsing is forgiving so a hand-edited file still loads: a missing `[status]` defaults to `rejected`, unknown metadata keys are ignored, and a section with no rationale or that fails `defineDecision` is skipped rather than throwing — one bad hand-edit does not sink the whole file.

## Facts

- Metadata bullets are only recognized *before* the first body line (`current.body.length === 0`); after prose starts, a `- key: value` line is rationale text.
- The heading regex tolerates a missing status bracket; `# ` (h1) lines never start a section; serializer collapses 3+ newlines to 2.
