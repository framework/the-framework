# Bug analysis: packages/framework/dashboard/components/ProjectDocs.tsx

## Business logic (high-level)

The "Docs" section on the project home (#1455 item 2): polls the workspace's PLAN/TODO docs and
renders them via the shared `DocsPanel`. SPEC invariants and how the code meets them:

- **Earned by content**: `if (!loaded || docs.length === 0) return null` — no section for a
  project without docs, and none while the first read is still out (no flicker). `usePolled`'s
  `loaded` only becomes true on the first *successful* read and resets on a `projectId` change, so
  switching projects also hides the section until the new project's docs arrive — a daemon hiccup
  (rejected read) keeps `loaded` false and the section hidden rather than flashing an empty box.
- **Kept current**: `usePolled(…, 4000, [projectId])` re-reads every 4s; interval is cleared on
  unmount and on project switch (effect cleanup), so no poll leak and no stale-project write
  (the `token.live` guard in `useAsyncValue` drops late resolutions).
- **Bounded height**: the wrapper `max-h-[28rem] … overflow-hidden` plus DocsPanel's internal
  `ScrollArea min-h-0 flex-auto` makes a long doc scroll inside the section. The wrapper is a
  flex column so DocsPanel's `flex-auto` body gets the constrained height.

`EMPTY_DOCS` module constant: the poll's `initial` — but note `useAsyncValue` captures `initial`
in a ref on first render anyway, so even an inline `[]` would not churn; the constant is harmless
belt-and-braces (its own comment says why it exists).

Passing `loaded` (always true) into `DocsPanel` is sound: this component never renders the panel
before `loaded`, so DocsPanel's own "Loading…" branch is intentionally unreachable here — the
section-level hide replaces it.

## Functions (low-level)

### `ProjectDocs({ projectId })`

Inputs: a valid project id. Reads `onDocs(projectId)` on a 4s poll keyed on `[projectId]` — the
load closure closes over exactly its deps, per `usePolled`'s contract. Renders `null` until loaded
and non-empty; otherwise a labelled `<section aria-label="Docs">` with an `<h2>` heading (what the
test queries as `role: heading`) and the bounded DocsPanel.

Edge cases:

- Docs disappearing between polls (agent deletes PLAN.md): next tick returns `[]`, `docs.length
  === 0` → section unmounts. Correct per "earned by content".
- Docs list shrinking while DocsPanel has a higher `active` index: DocsPanel clamps
  (`Math.min(active, docs.length - 1)`), so no crash — handled downstream.
- Rapid project switches: each dep change retires the in-flight read via the token; no stale
  docs from the previous project can land.
- Rejected polls: value and hidden/shown state stay as-is; recovery on the next tick. Matches the
  hook's documented behavior.

Verdict: correct.

### `EMPTY_DOCS`

Stable `[]` initial. Correct (and redundant only in the harmless direction).

## Bugs found

None found.
