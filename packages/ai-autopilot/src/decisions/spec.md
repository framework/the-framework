The decisions ledger — durable project memory of accepted choices and rejected ideas, so an autopilot run stops re-pitching what was already turned down ("declare intent once, respect it").

## TLDR

- `types.ts` — `Decision`/`DecisionSpec`/`DecisionStatus`/`DecisionMatch`.
- `define.ts` — `defineDecision` validation/freezing + `slugify`/`tokenize` text utilities.
- `ledger.ts` — `DecisionLedger`: `record`/`reject`/`accept`, and `consult`/`wasRejected` (lexical token-overlap matching).
- `markdown.ts` — the human-editable `DECISIONS.md` format: serialize + forgiving parse, round-tripping.
- `store.ts` — `loadLedger`/`saveLedger` over the tiny `LedgerFs` seam (RunnerFs-compatible) + `nodeLedgerFs` host adapter.
- `tools.ts` — agent surface: `consult_decisions`/`record_decision` ai-sdk tools + `decisionBriefing` prompt fragment.
- `index.ts` — barrel; `*.test.ts` mirror each module.

## Decisions

- The in-memory ledger is the canonical form; `DECISIONS.md` is the interchange the user can read and hand-edit — parsing is deliberately forgiving so hand edits never sink the file.
- Matching is lexical and deterministic (cheap enough to run before every proposal); a semantic matcher can later replace it behind the unchanged `consult` contract.
- The policy loop is: consult before proposing → a rejected match means do not re-pitch → record on accept/reject (persisted via the `onRecord` hook) → optionally brief the rejected set into the system prompt at session start.

## Facts

- Default ledger file: `DECISIONS.md` at the project/workspace root; default status is `rejected` (the primary use case); ids are ≤60-char kebab slugs of the title.
