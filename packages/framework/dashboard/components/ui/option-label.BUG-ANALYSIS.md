# Bug analysis: packages/framework/dashboard/components/ui/option-label.tsx

## Business logic (high-level)

A menu entry's name with one smaller muted description line beneath (option-label.SPEC.md), shared
by the options/notifications/presets menus so explained choices read identically. Lives in ui/ so
menus can share it without importing each other. The description line is dropped when absent —
`{description && …}` — exactly the SPEC's "dropped when there is none".

Edge: `description=""` is falsy and also drops the line — the right reading of "none".

## Functions (low-level)

- `OptionLabel({ label, description })` — two spans in a flex column; `font-normal` on the
  description so it does not inherit a bold menu-item weight; muted token color. No props spread,
  no state. Verdict: correct.

## Bugs found

None found.
