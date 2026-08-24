# Bug analysis: packages/framework/dashboard/components/DriverModelMenu.test.tsx

## Business logic (high-level)

Pins the #658/#1143 contracts with a two-driver fixture (Claude with icon, Codex without):

1. trigger shows current logo + model label, tooltip spells the driver out;
2. picking a model in another driver's submenu reports both (`('codex', 'gpt-5-codex')`);
3. a driver's submenu lists only its own models;
4. no pinned model → no model named on the trigger, tooltip says "the CLI's own default";
5. a model belonging to the other driver is not claimed;
6. the trigger has a full accessible name even when its visible content is only a logo+chevron.

These are exactly the behaviors the component's comments/SPEC call out, including both #1143
regressions (first-model fallback, unnamed trigger). Each is falsifiable — e.g. restoring the
`?? models[0]` fallback fails tests 4 and 5; dropping `aria-label` fails test 6.

Harness: real dropdown-menu primitives in jsdom (open via click; submenu via clicking the sub
trigger — works with the ui wrapper's click-to-open behavior); `hoverTooltip` helper awaited for
tooltip content; `afterEach(cleanup)`; fresh `onChange` per render.

Note: test 3 renders with `model: ''` specifically so 'Opus' appears only inside the submenu —
a careful disambiguation rather than a `within()` scope; works because the trigger then names no
model. Gap (not a bug): `busy` disabling is untested; unknown-driver fallback to `drivers[0]`
untested.

## Functions (low-level)

- `renderMenu(over)`: default claude/opus, override-able. Correct.
- Tests 1–6 as enumerated above: all queries role- or text-scoped tightly enough to be
  unambiguous in the rendered tree; async only where tooltips are involved. Correct.

## Bugs found

None found.
