# Bug analysis: packages/framework/src/format-bytes.test.ts

## Business logic (high-level)

Two synchronous tests pinning the two halves of the spec: unit scaling (`512 B`, `1.5 KB`, `5 MB`, `512 MB`, `3 TB` — covering the no-decimal-above-10 rule at `512 MB` and the decimal case at `1.5 KB`) and the fallback contract (`undefined`, `NaN`, `-1` → en dash; custom fallback including the empty string, which pins that the default applies only when the parameter is omitted, not when falsy). Every assertion is an exact `assert.equal` on the returned string — falsifiable, deterministic, locale-independent (no `toLocaleString` involved).

What the tests do not cover (noted, not bugs): `0` (→ `0 B`, the deliberate "zero is an answer" case), `Infinity`, the just-under-a-boundary rounding artifact (`1048471` → `1024 KB`), and >TB values. The tested behaviors are exactly those the spec sentence claims.

## Functions (low-level)

- **scaling test (#798/#752)** — five exact-string cases across four units; includes both rounding branches (decimal for `<10` scaled values, whole otherwise). Correct.
- **fallback test** — three invalid inputs with default fallback plus two custom fallbacks. The `''` case is the sharp one: it would fail if the implementation used `fallback || '–'`. Correct.

## Bugs found

None found.
