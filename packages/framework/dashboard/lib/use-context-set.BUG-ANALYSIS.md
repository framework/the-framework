# Bug analysis: packages/framework/dashboard/lib/use-context-set.ts

## Business logic (high-level)

The agent Context selection (#492/#504): one `Set<string>` of picked paths owned by the shell so the `#`-picker/whole-repo control and the right-rail file tree share a single source of truth; chip deletion removes from the set (#948); `reset()` clears on project switch (the paths belonged to the project just left, per SPEC — the *caller* invokes reset on switch; this hook only provides it).

Correctness properties:

- Every mutation goes through the functional updater form (`setContext(prev => …)`), so rapid successive updates (add+add in one tick, toggle storms from the tree) compose instead of clobbering.
- Immutability: `add`/`remove` return `prev` unchanged when a no-op (React skips the re-render on identity), otherwise a fresh `Set` — so `useMemo`/`memo` consumers see identity change exactly when membership changes. `toggle` always allocates (even for a no-op it can't have — toggle always changes membership), fine.
- `new Set(prev).add(path)` — `Set.prototype.add` returns the set, so the expression is the new set. Correct.
- Duplicate adds, removes of absent paths, and empty-string paths are all handled by Set semantics; path normalisation (e.g. `dir/` vs `dir`) is the caller's concern — both producers use the same tree-supplied path strings, so no mismatch arises.

## Functions (low-level)

- `useContextSet()` — returns `{context, add, remove, toggle, reset}`. The callbacks are re-created per render (not memoised) — consumers use them in event handlers, not dep arrays; acceptable. Verdict: correct.
- `add(path)` — no-op-preserving insert. Correct.
- `remove(path)` — no-op-preserving delete. Correct.
- `toggle(path)` — branch on membership in the *previous* set. Correct.
- `reset()` — fresh empty set. Correct.

## Bugs found

None found.
