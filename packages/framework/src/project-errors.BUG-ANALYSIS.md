# Bug analysis: packages/framework/src/project-errors.ts

## Business logic (high-level)

In-memory per-project error state (#1500): background jobs record a condition only the user can fix (today only `data-sync`), the dashboard renders it, and the job clears it when the condition passes. Per `project-errors.SPEC.md`:

- **One slot per (project, code)** — a `Map<projectPath, Map<code, ProjectError>>`; re-reporting overwrites the message, never accumulates.
- **Age preserved** — `since` is taken from the existing entry when present (`errors.get(code)?.since ?? now().toISOString()`), so a per-minute re-report keeps the original timestamp; only a `clear` resets the clock (the entry is gone, so the next `set` mints a fresh `since`).
- **Daemon-lifetime only** — nothing persisted; a restart re-learns within one emitter tick. Deliberate (SPEC rationale), so "no stale record outlives its condition" holds by construction.

Edge cases and concurrency:

- All operations are synchronous Map mutations — no interleaving hazard within Node's single thread; emitters on timers cannot race mid-operation.
- `clear` of an unknown project/code: guarded (`if (!errors) return`; `Map.delete` on a missing key is a no-op). Empty inner maps are pruned so `byProject` cannot grow unboundedly across many projects with transient errors.
- `list` returns a fresh array of the stored objects sorted by `since` (`localeCompare` on ISO strings — lexicographic order equals chronological order for the fixed-width `toISOString` format, including across year boundaries; millisecond ties keep insertion order since V8's sort is stable). The `ProjectError` objects themselves are shared references, but they are replaced (not mutated) on `set`, so a dashboard snapshot cannot observe a half-updated entry.
- Same-millisecond `set` after `clear`: `since` equals the old value by coincidence — semantically still a "new" problem; harmless.
- `ProjectErrorCode` is a one-member union today; adding a code needs no changes here (the dashboard picks wording by code). Good shape.

## Functions (low-level)

- **`projectErrorStore(now?)`** — factory closing over `byProject`; injectable clock used only when minting a new `since`. Correct.
- **`set(projectPath, code, message)`** — creates the inner map lazily via `(errors = new Map())` assignment-in-expression; keeps `since`. Correct.
- **`clear(projectPath, code)`** — deletes and prunes. Correct.
- **`list(projectPath)`** — spread + sort, `[]` for unknown projects. Correct.
- **`ProjectErrorsReader`** — type alias of `list`; wiring concern only. Correct.

## Bugs found

None found.
