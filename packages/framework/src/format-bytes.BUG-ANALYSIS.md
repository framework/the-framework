# Bug analysis: packages/framework/src/format-bytes.ts

## Business logic (high-level)

Single-purpose display helper for worktree/archive sizes (#798): scale a byte count into `B..TB`, one decimal only for small-magnitude scaled values, en-dash fallback for absent/invalid sizes so a failed `du` never reads as "0 B". Matches `format-bytes.SPEC.md` exactly: readable unit, decimal only where it helps, fallback for absent/negative/non-number.

Edge cases considered: `0` → `0 B` (legitimate, not fallback — correct: zero is an answer, only *unreadable* sizes must dash); `NaN`/`Infinity`/`undefined` → fallback via the combined `typeof`/`isFinite` guard; negatives → fallback per spec; values above TB stay in TB (`5 PB` → `5120 TB`, acceptable label); custom fallback (including `''`) honored because the default only applies when the argument is omitted.

One boundary artifact found (probed with node): a value just under a unit boundary rounds *up to the boundary* after the unit was already chosen, e.g. `1048471` → `1024 KB` (and `1073689000` → `1024 MB`) instead of `1 MB`/`1 GB`. The quantity is truthful and the window is narrow (~0.05% below each boundary), but the output is a label the function's own scaling loop would never otherwise produce. Recorded as a minor, low-confidence deviation from "scales to a readable unit"; arguably an accepted artifact (npm's pretty-bytes shares it).

## Functions (low-level)

- **`UNITS`** — const tuple `B..TB`; loop bound `UNITS.length - 1` prevents index overflow. Correct.
- **`formatBytes(bytes, fallback = '–')`** —
  - Guard: rejects non-number (covers `undefined` without a separate check), non-finite, negative. Correct and matches tests.
  - Scaling loop: divides by 1024 while `>= 1024` and a bigger unit exists; terminates (value shrinks or unit hits cap); `unit` stays in range. Correct.
  - Rounding: one decimal only when `value < 10 && unit > 0` (so `512 B` and `512 MB` stay whole; `1.5 KB` gets its decimal; `Math.round(value*10)/10` gives at most one decimal and drops a trailing `.0` naturally since `1.0` prints as `1`). `9.96 KB` → `10 KB` (fine). Boundary artifact described above (`Math.round` can produce `1024` for a value chosen as `< 1024`). Verdict: correct except the minor boundary-rounding artifact.

## Bugs found

1. `L16`: Rounding can emit the very boundary the unit loop excluded: `formatBytes(1048471)` → `"1024 KB"` (similarly `"1024 MB"`, `"1024 GB"`) because the unit is picked before rounding. Trigger: any size within ~512 bytes×1024^unit of a unit boundary from below. Contradicts the spec's "scales to a readable unit" only cosmetically — the number is truthful. Severity: minor. Fix sketch: after computing `rounded`, if `rounded >= 1024 && unit < UNITS.length - 1` re-divide (`rounded = 1; unit++`), or round before choosing the unit. (Low confidence that this counts as a bug rather than an accepted display artifact.)
