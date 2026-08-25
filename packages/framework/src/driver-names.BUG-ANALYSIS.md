# Bug analysis: packages/framework/src/driver-names.ts

## Business logic (high-level)

The node-free driver vocabulary (#542): the list of coding-agent CLIs a user can pick, their display
labels, and the mapping from a recorded *implementation* id back to the *driver* that was picked.
Node-free on purpose — the dashboard bundle, the registry's preference sanitizer and the session spec
all import it, and none of them may pull in the driver layer (which spawns processes). That
constraint is upheld: this file has no imports at all.

The one non-trivial invariant is the driver/implementation split. `DriverName` is the user's choice
(`claude`, `codex`); `DriverImplId` is what actually ran (`claude-code`, `claude-web`,
`github-actions`, `codex`, `fake`). One driver has many implementations because Claude runs locally,
in a cloud session and on an Actions runner — where it ran is the run *target*, not the driver
(#1263). `driverFromImpl` collapses that, and deliberately answers `undefined` (rather than guessing)
for an id no driver claims: the `fake` driver's records, and records written by a newer version of
The Framework. Callers therefore have to handle "no driver" for any archived agent, which is the
correct shape for reading a file written by another version.

Ordering matters as data: `DRIVERS` is documented as "the order surfaces list them", so it is the
single source of the picker order rather than each surface sorting for itself.

Type-safety of the tables: `DRIVER_LABELS: Record<DriverName, string>` makes a new driver a compile
error until it is labelled, which is the stated mechanism for "adding a driver is one entry here plus
its implementation". `DriverImplId` is a hand-written union with no corresponding exhaustiveness
check against `DRIVERS`, so an implementation added there without a `driverFromImpl` case silently
maps to `undefined` — the JSDoc says so explicitly ("An implementation whose id differs from its
driver's name needs a case here"), so this is a documented reliance rather than a gap.

## Functions (low-level)

- **`DRIVERS` (L20)** — `as const`, the source of both the union type and the listing order. Correct.
- **`DriverName` (L23)** — derived from `DRIVERS`, so the two cannot drift. Correct.
- **`isDriverName(value)` (L26)** — the `value !== undefined` guard is what makes it usable as a type
  predicate over `string | undefined`; the `as readonly string[]` cast is needed because `includes`
  on a literal tuple rejects arbitrary strings. Edge cases: `''` → false; `'Claude'` → false
  (case-sensitive, matching how the value is persisted); `'claude '` with whitespace → false, so a
  hand-edited registry value with a stray space falls back rather than being silently accepted —
  consistent with the sanitizer's intent. Correct.
- **`DRIVER_LABELS` (L31)** — total over `DriverName` by type. Correct.
- **`DriverImplId` (L40)** — see reliance above. Correct.
- **`driverFromImpl(impl)` (L48)** — three claude-side ids map to `'claude'`, then `isDriverName`
  handles the ids that equal their driver name (`codex`), then `undefined`. Checked: `'fake'` →
  `undefined` (SPEC: an unclaimed implementation has no driver), `undefined` → `undefined`, an
  unknown id from a newer version → `undefined` rather than a guess. The order of the two checks is
  irrelevant since the id sets are disjoint. Correct.

## Bugs found

None found.
