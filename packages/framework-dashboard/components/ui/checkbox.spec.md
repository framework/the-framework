shadcn-style `Checkbox` on Base UI's Checkbox primitive, replacing the bare `<input type="checkbox">` panels used to hand-roll.

## Decisions

- Base UI, not Radix — matching the Tooltip and DropdownMenu already in this directory.
- Replaces native checkboxes because browser-drawn ones ignored the theme tokens, skipped the app-wide focus ring, and drew a light box on the dark canvas.
- `disabled` is widened to `boolean | undefined`: under `exactOptionalPropertyTypes` the primitive's `disabled?: boolean` rejects `undefined`, and callers naturally pass `boolean | undefined` expressions — normalising here (default `false`) beats `!!` at every call site.

## Facts

- Checked/disabled styling keys off Base UI's `data-[checked]` / `data-[disabled]` attributes; the indicator is a lucide `Check`.
