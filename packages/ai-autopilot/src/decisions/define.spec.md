Validation + text utilities for decisions: `defineDecision` turns a `DecisionSpec` into a frozen `Decision`, plus the `slugify`/`tokenize` helpers the ledger's matching relies on.

## TLDR

- `defineDecision`: requires non-blank `title` and `rationale`; defaults `status` to `'rejected'` (the common case), `tags` to `[]`, `id` to `slugify(title)`; throws `DecisionError` on a bad spec (fail fast at record time).
- `slugify`: lowercase kebab-case, capped at 60 chars; an explicit `id`/`supersededBy` is slugified too.
- `tokenize`: lowercased word tokens, deduped, dropping tokens < 3 chars and a fixed `STOP_WORDS` set (the/a/use/via/…) — the lexical basis of `DecisionLedger.consult`.

## Facts

- Blank optional fields (`date`, `supersededBy`) are omitted entirely, not set to `undefined`, to stay clean under `exactOptionalPropertyTypes`.
- Tags are trimmed, lowercased, and deduped; a title that slugs to nothing (e.g. `'!!!'`) without an explicit id throws.
