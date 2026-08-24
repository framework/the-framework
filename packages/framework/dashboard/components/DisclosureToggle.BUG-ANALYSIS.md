# Bug analysis: packages/framework/dashboard/components/DisclosureToggle.tsx

## Business logic (high-level)

The one shared collapsible-section toggle (#659): a controlled button (open state owned by the
caller) with a chevron rotating 90° when open, muted-until-hover label, and `aria-expanded`
mirroring `open`. Exists to keep every disclosure's look from drifting. No state, no effects.

Edge cases: none of consequence — `children` may be any node; `className` merges; `type="button"`
prevents accidental form submits (it sits inside the launcher's `<form>`). The controlled design
means a caller that forgets to flip `open` gets a non-rotating chevron — a caller bug by contract.

## Functions (low-level)

### `DisclosureToggle({ open, onToggle, children, className })`

Pure render; `aria-expanded={open}` (boolean → "true"/"false" attribute), chevron `rotate-90`
class keyed on open, click → `onToggle`. Verdict: correct.

## Bugs found

None found.
