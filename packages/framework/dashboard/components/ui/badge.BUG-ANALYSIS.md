# Bug analysis: packages/framework/dashboard/components/ui/badge.tsx

## Business logic (high-level)

The pill label primitive (badge.SPEC.md): a small rounded outlined tag for status/category
markers. Pure presentation — one `span` with base classes plus caller overrides via `cn`, all
other `HTMLAttributes` spread through. No state, no lifecycle, no invariants beyond "caller
classes win last" (which `cn`/tailwind-merge provides, e.g. the status pills override
`border-…`/colors).

## Functions (low-level)

- `Badge({ className, ...props })` — renders the span. Edge cases: no children → empty pill
  (callers always pass text); className undefined → base classes only; event handlers and aria
  props pass through untouched. Verdict: correct.

## Bugs found

None found.
