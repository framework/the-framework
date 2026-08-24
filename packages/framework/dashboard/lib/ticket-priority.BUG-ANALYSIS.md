# Bug analysis: packages/framework/dashboard/lib/ticket-priority.ts

## Business logic (high-level)

The single shared reading of a ticket's `Priority:` key (#1144/#1265): parse the 0-10 scale (undefined for absent or non-numeric), and colour it (danger ≥8, warning ≥5, muted below or absent) — shared so the list row, detail page, and sort menu cannot drift. Matches the SPEC sentence for sentence, and the thresholds are the same ones `PRIORITY_BUCKETS` in `ticket-filter.ts` mirrors (critical 8-10, medium 5-7), keeping filter and colour vocabulary aligned.

Edge cases: `parseInt` tolerance means `'7.5'` reads 7 and `'10 (urgent)'` reads 10 — generous toward agent-written frontmatter, consistent with "names something that is not a number counts as having none" only for fully non-numeric strings; out-of-scale values (`'99'`) pass through unclamped and would read as danger and sort highest — the writers are the framework's own prompts which keep to 0-10, accepted reliance. Negative values (`'-3'`) parse to -3 → muted, sorts below 0 — harmless. `Number.isNaN` (not global `isNaN`) avoids coercion surprises.

## Functions (low-level)

- `parsePriority(priority)` — undefined passthrough; `parseInt(x, 10)`; NaN → undefined. Verdict: correct.
- `priorityTone(priority)` — parse then threshold ladder; absent/unparseable → muted. Verdict: correct.

## Bugs found

None found.
