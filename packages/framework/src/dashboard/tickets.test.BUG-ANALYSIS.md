# Bug analysis: packages/framework/src/dashboard/tickets.test.ts

## Business logic (high-level)

Pins the ticket reader against real temp directories. Coverage matches `tickets.test.SPEC.md` claim for claim:

- **Listing**: empty without `tickets/`; non-md ignored; `meta.json` never a row; plan/lock fold into their ticket and never become rows; a lone plan+lock is no ticket (and `hasTickets` agrees).
- **Describing**: full-format ticket (keys above title, TLDR summary) asserted with `deepEqual` against the complete row — strong, catches accidental extra fields (e.g. would fail if `status` were ever read, which one test asserts explicitly via `!('status' in ticket)`); GitHub link split; absent keys stay absent; pre-format import ticket (title from heading, summary skipping `Source:`); filename fallback titles incl. the stray-`%` case.
- **Dating/ordering**: filename date survives an edit (1.1s sleep beats coarse mtime resolution); mtime fallback parseable; newest-first by mtime where filenames carry no date (deliberately named `a-older`/`b-newer` so a filename sort would fail it).
- **Planned/claimed**: plan marks planned; lock marks locked with holder on list and detail alike; plan+lock coexist; malformed lock still locks without holder; `Effort`/`Uncertainty` read (0 pinned as a value, not missing), absent when unnamed, rejected when out-of-range/fractional/below the heading.
- **Detail**: whole file + same metadata (deepEqual again); null for missing file, sibling, meta.json, and every escape shape (`../`, absolute, subdir).
- **Meta**: happy path plus an eight-way "unusable file" table, each labeled.

Do the tests verify what they claim? Yes. The assertions are on returned values, not on internals; the two timing-dependent tests insert a real >1s gap, which is the documented cure for second-resolution mtimes, so they are not flaky by construction. Every temp dir is created via `mkdtemp`; nothing is cleaned up (test-runner temp dirs, consistent with sibling suites — hygiene nit, not a defect).

One observation: sorting tests that don't care about order `.sort()` before comparing and say why — good discipline that avoids false flakes.

Coverage gaps (not defects): `readTicket` for a file that exists but with a filename date + plan whose preamble is >4KB is unexercised; `topics:` without brackets (the "brackets are cosmetic" claim's other half) is untested — the bracketed form is. Neither hides a plausible regression of consequence.

## Functions (low-level)

- **`repo(files)`** — temp repo with an optional `tickets/` dir; only creates the dir when files are given, which is exactly what the "no tickets directory" tests need. Correct.
- Individual tests — each asserts observable reader output; no unawaited promises (all `await`ed); `assert.deepEqual` used where the whole shape matters, field asserts where one field matters. Correct throughout.

## Bugs found

None found.
