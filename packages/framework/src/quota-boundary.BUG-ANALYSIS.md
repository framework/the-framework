# Bug analysis: packages/framework/src/quota-boundary.ts

## Business logic (high-level)

The quota boundary (#879/#960): the pro-rated share of the account's quota week that may be spent by now, derived entirely from the reset instant the driver reports as prose. Four pieces: `parseResetsAt` (prose → epoch), `boundaryFromResetsAt` (epoch → `{startsAt, resetsAt, day, percent}`), the limit (`boundary + offset`, clamped 0..100), and `quotaBoundaryStatus` (measure the weekly windows against the limit). Checked clause-by-clause against `quota-boundary.SPEC.md`:

- **Continuous percent** — `elapsed/week*100`, elapsed clamped to `[0, week]`; reaches 100 exactly at reset; `day = min(7, floor(elapsed/day)+1)` steps at the week's own day boundary and clamps a stale (already-reset) reading to day 7 rather than day 8. All pinned by tests. Correct.
- **Both weekly windows bind** — the account `week` window(s) always; a `week-model` window only when `windowModel(label)` (the parenthesized name, lowercased) is a substring of the lowercased selected model. `claude-fable-5` matches `(Fable)`; `(Opus)` does not stop Sonnet work; no model → account week only. An unmatchable label fails *open* for that window only — the SPEC explicitly chooses "left out rather than allowed to stop work for a model nobody selected". A multi-word label (`(Fable 5)`) would not match the hyphenated id and the model gate would silently not bind — conservative-open by the same documented rule; real labels are single-word. Noted, not a bug.
- **"We do not know" is its own answer** — no `week` window, no `resetsAtText`, or unparseable text → `undefined`. If the *first* `week` window lacks `resetsAtText` while a second carries it, the whole status is `undefined` (`find` takes the first) — drivers emit one week window; reliance noted.
- **Reset recovered from prose** — regex accepts both phrasings (`at` / comma), optional minutes, optional `(zone)` (probed: `"Jul 25, 7am"`, `"Jul 25 at 7 am (UTC)"`, `"Jul 25 at 7AM"` all match; `"Jul 25 7am"` correctly refused). Hour 1–12 enforced; `12am`→0, `12pm`→12. Missing zone → machine zone. Year recovery: candidates nowYear±1, nearest-to-now wins — for a weekly reset (≤7 days out) exactly one candidate is near, and the new-year straddles are pinned by tests. Feb 29 in a non-leap candidate rolls into March and is rejected by the day-of-month check (`getUTCDate() !== day` after converting back into the zone); same check also rejects nonsense like "Jun 31" in all candidates → `undefined`.

Time-zone machinery:

- `zoneOffsetMs` formats the instant in the zone via `Intl` parts and rebuilds a fake-UTC; `hour % 24` handles runtimes printing midnight as 24. An invalid zone makes the `Intl.DateTimeFormat` constructor throw — caught in `parseResetsAt`'s per-candidate try → `undefined` (test pins `(Not/AZone)`).
- `zonedTimeToEpoch` uses the standard two-pass offset correction; probed a DST spring-forward gap (Berlin 2026-03-29 02:30 → 01:30Z) — the result stays on the printed zone-date, so the `getUTCDate` guard does not spuriously reject DST-adjacent resets, and the both-sides-of-DST tests pass.
- Line 115 calls `zoneOffsetMs` outside the try — safe: reached only after `zonedTimeToEpoch` succeeded for that zone, so the constructor cannot throw there.

Limit and reached:

- `limit.percent = clamp(boundary.percent + offset, 0, 100)`; `offset` defaults to 0. Clamping rationale (never "always stopped"/"never stops") pinned by tests.
- `reached: percentUsed >= limit.percent` — at week start (limit 0) a 0%-used window counts as reached, i.e. unattended work stands down in the first instant. Consistent with "at the start of the week nothing may have been spent"; the `>=` at the 100/100 corner likewise stops work only when the week is fully spent *and* fully elapsed. Deliberate-looking; not a bug.
- Non-weekly windows (`session`, `unknown`) are excluded from the gate — SPEC: only weekly windows bind.

## Functions (low-level)

- **`QUOTA_WEEK_MS` / `ONE_DAY_MS` / `WEEK_DAYS`** — plain constants; DST does not apply (the week is a fixed 7×24h behind the reset instant, which is itself zone-resolved). Correct.
- **`RESETS_AT`** — anchored, case-insensitive; `[^)]+` zone capture; trailing-text refusal makes a reworded readout fail closed to `undefined`. Correct.
- **`zoneOffsetMs(at, zone)`** — `Number(undefined)` → NaN only if a part is missing, which cannot happen for the requested fields on a valid zone. Correct.
- **`zonedTimeToEpoch(...)`** — two-pass correction; for a DST-gap wall time the result is offset by the transition delta (probed: acceptable, still same zone-date). Correct.
- **`parseResetsAt(text, now)`** — see above; returns nearest valid candidate; `best` strict-`<` tie-break keeps the earlier year on an exact tie (unreachable in practice). Correct.
- **`boundaryFromResetsAt(resetsAt, now)`** — clamped elapsed; `day` floor+1 with min 7. Correct.
- **`windowModel(label)`** — first parenthesized group, trimmed, lowercased. Correct for driver labels.
- **`quotaBoundaryStatus(input)`** — as analyzed; returns `windows` in driver order and `reached` = first at/over the limit (`?? null`). Correct.

## Bugs found

None found.
