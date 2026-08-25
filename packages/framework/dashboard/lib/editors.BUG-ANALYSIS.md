# Bug analysis: packages/framework/dashboard/lib/editors.ts

## Business logic (high-level)

Feeds the "Preferred editor" picker (#727, editors.SPEC.md): the daemon's detected editors, read
once over RPC, `[]` until the read resolves and `[]` from a public host — in both cases the
picker shows only its "Default" escape hatch, exactly the SPEC's wording. The heavy lifting
(loading, error swallowing to the fallback, single-fire) lives in `useLoaded` (use-async.ts,
outside this batch — signature `(load, initial, deps)`); this module composes it correctly:
`useLoaded(() => onEditors(), [], [])` — fetcher, `[]` initial value, empty deps (read once per
mount).

Failure mode: an RPC error resolves to the fallback `[]` via useLoaded's contract, which the SPEC
treats the same as "none detected" — the picker stays usable. Detection being a cheap PATH lookup
justifies no refresh/poll; a newly installed editor shows after a dashboard reload, which the
SPEC's "asked for once when the dashboard needs them" accepts.

## Functions (low-level)

- `useDetectedEditors()` — one-liner over useLoaded; returns `EditorInfo[]` (never undefined, so
  callers can map unconditionally). Verdict: correct.

## Bugs found

None found.
