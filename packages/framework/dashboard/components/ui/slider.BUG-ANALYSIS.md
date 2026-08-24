# Bug analysis: packages/framework/dashboard/components/ui/slider.tsx

## Business logic (high-level)

The two-thumb range slider (slider.SPEC.md) on Base UI's Slider, for the tickets filter's 0–10
whole-step ranges (#1144). SPEC promises vs code:

- Two handles, whole steps: two `Thumb`s, `step={1}`, default `min=0 max=10`, controlled
  `value: [number, number]`. Matches.
- Track between the handles highlighted: `Indicator` with `bg-primary` (Base UI positions it
  between thumb values in range mode). Matches.
- Each handle labelled for screen readers: `aria-label` "<label> minimum/maximum" with plain
  "Minimum"/"Maximum" fallback. Matches.

Value-shape audit: `onValueChange` receives Base UI's `number | number[]`; the guard
`Array.isArray(next) && next.length === 2` forwards only pairs, using non-null assertions after
the length check (safe). With two thumbs Base UI always emits a pair, so the guard never drops a
real change; it exists to satisfy the wider primitive type. Base UI also keeps the pair ordered
(thumbs cannot cross), so the `[min, max]` contract holds without extra sorting here — callers
would see ordered pairs even mid-drag.

Note: thumbs are rendered inside `Track` rather than as `Control` children — Base UI supports
this composition (thumb positioning is context-based); purely structural.

## Functions (low-level)

- `RangeSlider({...})` — controlled-only surface (no defaultValue path — the filter owns state);
  no `disabled` passthrough (unused by the one caller); className lands on Root (`w-full`).
  Edge cases: `value` outside [min,max] is clamped by the primitive; equal min/max pair renders
  both thumbs stacked (pickable by keyboard) — acceptable. Verdict: correct.

## Bugs found

None found.
