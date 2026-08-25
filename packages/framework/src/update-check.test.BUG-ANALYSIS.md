# Bug analysis: packages/framework/src/update-check.test.ts

## Business logic (high-level)

Thirteen small tests covering the three pure functions of `update-check.ts` plus `checkForUpdate`'s
seam behaviour. No network, no filesystem, no timers: `fakeFetcher` is a one-line stub, so the
suite is fully deterministic.

What it pins, mapped to the SPEC:

- **"Version comparison without a library"** — equality, the numeric-not-lexicographic case
  (`1.9.0` vs `1.10.0`, which is the bug this function exists to avoid), a major-version bump,
  prerelease *and* build suffix stripping, and the missing-part-reads-as-zero rule in both its
  equal and its unequal form.
- **"Being ahead is being up to date"** — `checkForUpdate('2.0.0', fake('1.9.9'))` asserts
  `up-to-date`, the case the JSDoc calls out (a local build ahead of the registry).
- **"Never in the way"** — a fetcher resolving `undefined` yields `unknown`, and
  `formatUpdateStatus({kind:'unknown'})` yields `undefined` so nothing prints.
- **The registry key** — the spy test asserts both that the default is `PACKAGE_NAME` and that an
  override is forwarded, in one `deepEqual` on the recorded arguments.
- **The two printed lines**, asserted as exact strings (the update line built with the same
  `PACKAGE_NAME` constant, so a rename cannot silently desync the message from the URL).

Every `checkForUpdate` assertion is `await`ed and every async test returns its promise via
`async () => { … }`, so nothing can pass by not running. The status assertions use `deepEqual` on
the whole object, so an extra or missing field fails.

## Functions (low-level)

### `fakeFetcher(latest)` (L12)

Returns a `VersionFetcher` ignoring its argument. Correct for the tests that use it; the one test
that cares about the argument uses its own spy instead.

### L16-37 — `compareVersions` tests

Five tests, nine assertions. The `<`/`>` assertions use `assert.ok(... < 0)` rather than pinning
`-1`/`1` exactly, which is the right coupling (the function's contract is the sign, not the
magnitude). The comparison-symmetry check at L21-22 would catch a one-sided regression. Correct.

### L39-68 — `checkForUpdate` tests

Five tests covering all three result kinds plus both seam paths. L59's spy accumulates the package
names and asserts the full array, which pins the default *and* the override in one place. Correct.

### L70-83 — `formatUpdateStatus` tests

Three exact-string assertions. Building the expected update line from `PACKAGE_NAME` rather than
hard-coding `framework` means the test still passes on a rename while still pinning the sentence
shape — deliberate and right, since the constant is separately anchored to `package.json` by the
module itself. Correct.

## Coverage gaps (not bugs)

- `nodeVersionFetcher` is untested (it is the network seam; testing it would need a fetch stub or a
  live registry). Its error paths are simple enough to read, but nothing pins the 2.5s timeout, the
  non-`ok` branch, or the non-string `dist-tags.latest` branch.
- Nothing pins `checkForUpdate`'s `!latest` guard against an *empty-string* version (as opposed to
  `undefined`), which currently also yields `unknown`.

## Bugs found

None found.
