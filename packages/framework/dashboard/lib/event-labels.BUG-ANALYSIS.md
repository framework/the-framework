# Bug analysis: packages/framework/dashboard/lib/event-labels.ts

## Business logic (high-level)

The plain-language badge for each session-log line (#1035, event-labels.SPEC.md): four jargon
kinds are renamed (driver→agent, settled→waiting, usage→cost, session-update→resume); every other
kind is its own name with hyphens turned to spaces. Values stay lowercase because the badge
uppercases via CSS — a one-directional dependency worth knowing, but the SPEC's examples read
lowercase too.

The override table is `Partial<Record<EventKind, string>>`, so a renamed-away event kind fails
type-checking here only if it lingers in OVERRIDES with a dead key — TypeScript would flag a key
not in the union, keeping the table honest as kinds evolve. The fallback `kind.replace(/-/g,' ')`
is global (multi-hyphen kinds like `ready-for-merge` → "ready for merge" — test-pinned).

## Functions (low-level)

- `eventKindLabel(kind)` — pure lookup-with-fallback. Edge cases: kinds without hyphens pass
  through unchanged; the union type prevents unknown strings at compile time, and at runtime an
  unknown kind would still produce a readable de-hyphenated label rather than throwing.
  Verdict: correct.

## Bugs found

None found.
