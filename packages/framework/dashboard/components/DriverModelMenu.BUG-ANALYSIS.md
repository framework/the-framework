# Bug analysis: packages/framework/dashboard/components/DriverModelMenu.tsx

## Business logic (high-level)

The driver+model tree (#650/#656/#658/#1143): top level lists drivers, each submenu only that
driver's models; picking a model calls `onChange(driver, model)` — both set together so an
incompatible pair cannot exist. The trigger shows the current driver's logo and the pinned
model's label; with no model pinned it deliberately names NO model (no first-model fallback), and
the accessible name / tooltip spell out `Driver: X · Model: Y-or-"the CLI's own default"`
(`NO_MODEL_PINNED`) because a logo+chevron trigger says nothing to a screen reader.

Invariants checked:

- `driverOf` falls back to `drivers[0]` for an unknown stored driver (Composer documents this as
  "unknown stored value falls back to Claude Code"). With an empty `drivers` array it returns
  undefined and the trigger renders label-less but does not crash — not producible (DRIVERS is a
  non-empty compile-time list).
- `modelLabel` searches only the current driver's list — a model stored for the *other* driver
  (or never set) yields undefined → trigger shows no model and the said-label says unpinned.
  Exactly the #1143 contract; the comment explains why a fallback would be worse.
- Check marks: driver row checked by `a.value === driver`; model row checked only when *both*
  match (`a.value === driver && m.value === model`) — so a model id that collides across drivers
  (none do today) would still check correctly. Correct.
- `busy` disables the trigger (menu unreachable). Correct.
- Keys: drivers by value, models by value — unique per list. Correct.

## Functions (low-level)

### `driverOf(drivers, value)` (L36–38)

Find-or-first. Correct (see fallback note above).

### `modelLabel(driver, model)` (L49–51)

Undefined for unpinned/foreign model; `model === ''` finds nothing (no empty-valued entries by
the DriverOption contract "every entry is a real model id"). Correct.

### `DriverModelMenu(props)` (L53–122)

`said` built once and used for both `aria-label` and tooltip — cannot drift apart. Trigger body:
icon (or label when no icon) + model label + chevron. Submenus render per driver with `onChange`
binding the pair. Verdict: correct.

## Bugs found

None found.
