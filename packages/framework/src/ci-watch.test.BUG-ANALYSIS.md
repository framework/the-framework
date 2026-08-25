# Bug analysis: packages/framework/src/ci-watch.test.ts

## Business logic (high-level)

Tests for the CI watch sweep, matching `ci-watch.test.SPEC.md` bullet for bullet: merge-on-green
for `watched` PRs (with URL in the report), hands-off for `auto-armed`, pending waits, the
no-checks grace (younger → no merge, older → merge, unknowable age → never), non-OPEN PRs and
non-candidate metas ignored, PR-level dedupe (one read, one merge), refused-merge memory plus the
#1484 head-sha re-arm, the fix half (request contents, auto-armed-red still fixes, per-sha dedupe,
in-flight hold, attempts cap with reason, marker prefix-collision safety, stand-down without
sha/branch, declined vs started, no wiring → nothing), the fix prompt's marker/branch/checks/no-new-PR
content, and the `startCiWatch` loop's log-once behavior.

The seam design (`sweepDeps`) makes every assertion behavioral: fixed PR + CI answers, recorded
merges/fixes, injected `now`. Assertions are `deepEqual` on full result shapes, so extra or missing
actions fail — these tests can genuinely fail. All async work is awaited; the shared-`attempted`
set tests re-run the sweep with the same deps object, which is exactly how the daemon holds the set
across ticks.

What the tests pin down accurately vs the source: everything they claim. What they do **not**
cover — the three source bugs found in `ci-watch.ts` live precisely in these gaps:

- `pr` seams always answer `{pending: false}`; no test exercises a **pending** resolution
  (`resolveAgentPr`'s synthetic `state: 'OPEN'`), so the sweep acting on half-answers at daemon
  start is unpinned.
- `ci` seams always answer; no test makes the CI read **throw** (the sweep's `.catch` → `'none'`)
  against an old PR, so "an unreadable status must never merge" is asserted nowhere — and the
  source indeed merges. Note the seams' shape hides this: real `'none'`-from-failure answers carry
  no `headSha`, same as the crafted `{checks: 'none', failed: []}` used in the grace tests, so the
  grace tests would keep passing under the natural fix (require `headSha` for a no-checks merge)
  only if they are updated to include one — a deliberate flag for the fixer.
- The grace tests move `createdAt`, never the head: the push-reopens-the-window hazard (grace
  anchored to PR age) has no test.

## Functions (low-level)

- **`NOW` / `meta()` / `openPr()`**: fixed clock; a done, `watched`, in-window meta; an OPEN PR
  created 90 minutes inside the window. Defaults line up with `watchable` and the grace so each
  test varies exactly one thing. Correct.
- **`sweepDeps(pr, ci, opts)`**: records merge agent-ids and fix requests; merge result defaults
  to `{ok: true, url}` mirroring `mergeAgentPr`. Note `deps.attemptedMerges` is left undefined
  unless a test sets it — matching `sweepProjectCi`'s optional-set handling. Correct.
- **merge-on-green (L59-65)**: merges recorded, result rows with URL, `failed` empty. Correct.
- **auto-armed not merged (L67-72)**: empty merges/merged. Correct.
- **pending (L74-80)**: nothing at all happens — full-result deepEqual. Correct.
- **grace young/old/unknowable (L82-100)**: ±1s around `NO_CHECKS_GRACE_MS`; `createdAt:
  undefined` via cast → `Date.parse('')` NaN → never merge. All assert the source's actual
  branch conditions. Correct.
- **MERGED/CLOSED (L102-109)**: loop over both states; no merges, no fixes. Correct.
- **non-candidates (L111-125)**: running / no outcome / `merged` / stale `updatedAt` — full-result
  deepEqual empty. Correct.
- **dedupe (L127-132)**: two metas, one PR → one merge under the first agent's id. Correct.
- **refusal memory (L134-144)**: failure recorded once, `attempted.size` 1, second sweep silent,
  merges still just one. Correct.
- **head-sha re-arm (L146-159)**: mutates the shared `status` object the `ci` seam closes over —
  intentional and effective; asserts exactly one more attempt after the sha change. Correct.
- **fix start (L161-177)**: the full `CiFixRequest` deepEqual (number/title/url/branch/sha/failed)
  and the result row with the agent id. Correct.
- **auto-armed red fixes (L179-183)**: one fix. Correct.
- **per-sha dedupe / in-flight hold / cap (L185-210)**: prior-attempt metas built from
  `ciFixMarker` — the same function the source scans with, so these pin the marker contract, not a
  copy of it. The cap test's result deepEqual `[{number, reason: 'attempts-exhausted'}]` is the
  "says so once" half's data source (the log dedupe itself is the L249 test's subject — the name's
  "and says so once" is loose here; assertions are right). Correct.
- **prefix collision (L212-218)**: direct `startsWith` refutation plus a behavioral run with PR
  #51 attempts not blocking PR #5. Correct.
- **no sha/branch (L220-225)**, **declined (L227-232)**, **no wiring (L234-239)**: stand-down,
  `declined` reason, empty fixes respectively — all full-shape asserts. Correct.
- **prompt content (L241-247)**: marker prefix, `push origin HEAD:<branch>` regex, check names,
  "Do NOT open a new PR". Correct.
- **`startCiWatch` logging (L249-269)**: a persistently refused merge logs once across two awaited
  ticks; the default `attemptedMerges` seeded by `startCiWatch` suppresses the retry itself. The
  test name's "sweeps immediately" overstates — the test drives `tick()` by hand, and immediacy is
  the daemon clock's start-up turn (verified in `daemon-tick.ts`), not `startCiWatch`'s; the
  assertions themselves are sound. Correct.

## Bugs found

None found in the tests themselves. (The three coverage gaps above — pending PR resolutions,
throwing/`headSha`-less CI reads against old PRs, and push-vs-grace anchoring — are where the
`ci-watch.ts` bugs hide; filed against `packages/framework/src/ci-watch.ts`.)
