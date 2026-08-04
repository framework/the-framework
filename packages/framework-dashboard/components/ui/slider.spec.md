A two-thumb range slider on Base UI (`Slider.Root/Control/Track/Indicator/Thumb`), matching the Checkbox/Tooltip primitives already here — no Radix pulled in.

## TLDR

- `RangeSlider({ value, onValueChange, min=0, max=10 })`: one value shape only — an inclusive `[min, max]` pair, two thumbs, step 1. Built for the tickets filter's fine-grained 0-10 ranges (#1144).
- Themed with the CSS-var tokens (`--color-muted` track, `primary` indicator/thumb border) and carries the app's focus ring.
- `aria-label` prefixes the two thumbs' labels ("… minimum"/"… maximum").
