Tests for `memory-extract.ts` — covers the `withMemoryExtract` middleware standalone and via the `Agent.remembers()` auto-cascade.

## TLDR

- Persists only facts with `score >= threshold` (default 0.7, custom threshold honored); unions spec tags into every entry; empty fact list writes nothing but still fires `onExtracted([])`.
- Skips silently when `extract !== 'auto'`, `extractWith` missing, or no `UserMemory` registered (no second small-model call).
- Parse/JSON failures route through `onError` and never break the parent prompt.
- Auto-cascade: `remembers()` with `extract:'auto'` + `extractWith` installs the middleware; continuation calls (`options.messages`) skip it; a failed parent run triggers no extract; inject + extract compose in one run.
