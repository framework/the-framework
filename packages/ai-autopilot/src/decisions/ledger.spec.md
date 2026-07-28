`DecisionLedger` — the in-memory store of decisions with the two operations the memory moat needs: `record` (append a choice/rejected idea) and `consult` (find prior decisions a new idea resembles, so the agent does not re-pitch a rejected one).

## TLDR

- Insertion-ordered `Map` by id; `record(spec)` validates via `defineDecision` and returns the frozen `Decision`; `reject`/`accept` are status shorthands.
- Queries: `get(id)`, `all()`, `rejected()` (the do-not-re-propose set), `size`.
- `consult(idea, { threshold?, status?, limit? })` → `DecisionMatch[]` sorted by score desc; `wasRejected(idea)` is the fast re-pitch check (`consult` with `status: 'rejected'`, `limit: 1`).
- Markdown binding: `toMarkdown()` / static `fromMarkdown()` delegate to `markdown.ts` — the ledger is the canonical form, `DECISIONS.md` the human-editable one.

## Decisions

- Matching is lexical and deterministic (token overlap over title + tags), not semantic — cheap enough to run before every proposal and good enough to catch a re-pitch; a semantic upgrade can sit behind the same `consult` contract later.
- Re-recording an existing id replaces in place, keeping the original slot (e.g. an idea first rejected, later accepted) so ledger order stays stable.

## Facts

- Score = shared tokens / `min(ideaTokens, decisionTokens)` — dividing by the *smaller* set lets a short idea still match a longer decision; default threshold 0.5.
- Decision tokens are `tokenize(title)` ∪ raw `tags`; an empty/stop-word-only idea returns no matches.
