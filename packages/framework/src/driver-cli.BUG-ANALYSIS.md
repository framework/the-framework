# Bug analysis: packages/framework/src/driver-cli.ts

## Business logic (high-level)

What The Framework knows about each driver *before* running it, plus the single point where a picked
driver name becomes a live `Driver`. Two responsibilities:

**1. `DRIVER_SPECS` — the per-driver profile.** Label, PATH binary, install hint, and an
`AgentAuthSpec` (the args that make the CLI report its login state, a parser for its answer, and the
one command that fixes being logged out). Consumed by `preflight.ts` (L93-117) and by `cli.ts` for
display copy. The design invariant is stated in the module doc and enforced by the parsers: **the
exit code never decides login state** — `claude auth status` exits 0 whether or not you are logged
in — so each driver reads the answer out of its own CLI's output, and anything unrecognised is
`undefined` ("could not say"), which preflight treats as "do not block". Only an explicit `false`
fails preflight. The asymmetry is deliberate and matches `preflight.ts`'s own comment: a wrong "you
are logged out" blocks a working setup, which is worse than the silent dead agent the check exists to
catch.

Failure modes of that contract, checked against the parsers:

- Claude prints JSON; a version too old to know `auth status` prints usage text → `JSON.parse`
  throws → `undefined` → preflight stays silent. Intended and correct.
- `preflight.ts`'s probe folds stderr into `output` (its own `gh auth status` comment says so), so a
  Claude CLI that prints a deprecation warning on stderr alongside its JSON would fail to parse and
  degrade to "could not say" — the safe direction, and the only direction this design allows.
- Codex answers in prose. `/not logged in/i` is tested before `/logged in/i` because the positive is
  a substring of the negative; getting that order wrong would report a logged-out CLI as logged in.
  The order here is correct. A phrasing the regexes do not match ("You are signed out") reads as
  `undefined` — safe direction again.
- Neither parser looks at `ok`, so the `ok` field of the probe result is unused by both specs today;
  it is part of the seam for a future CLI whose exit code *is* the answer.

**2. `createDriver` — one place a name becomes an implementation.** Claude-only options (permission
mode, the MCP config behind `--browser`) are not passed to Codex, which has its own sandbox flag and
no MCP config; the SPEC says they are dropped here and *reported at the call site*, so a flag that
cannot apply says so rather than looking honoured. This file only performs the drop; the reporting
lives in `cli.ts`, and this file cannot enforce it.

Lifecycle/state: none. `DRIVER_SPECS` is a module-level frozen-by-convention table (not literally
`Object.freeze`d — a caller could mutate it, but none does), and `createDriver` constructs a fresh
driver per call, so two concurrent sessions never share driver state.

## Functions (low-level)

- **Re-exports (L12)** — `DRIVERS`, `isDriverName`, `driverFromImpl`, `DRIVER_LABELS`, `DriverName`
  from `driver-names.js`, so node-side importers get one import while the browser-safe file stays
  the source. No cycle: `driver-names.ts` imports nothing.
- **`AgentAuthSpec` / `DriverSpec` (L23-42)** — `loggedIn` returning `boolean | undefined` is what
  encodes the three-state answer; a `boolean` return type would have collapsed "could not say" into
  "logged out". Correct shape.
- **`DRIVER_SPECS.claude.auth.loggedIn` (L55-63)** — `JSON.parse` in a `try`, then a typed read of
  `.loggedIn` behind optional chaining. Edge cases probed: `'null'` parses to `null` → `?.` yields
  `undefined`; `'false'` / `'123'` / `'"x"'` parse to primitives → property read yields `undefined`
  (no throw, since only `null`/`undefined` throw on member access); `'{"loggedIn":"yes"}'` → not a
  boolean → `undefined`; `''` → parse throws → `undefined`. Whitespace around the JSON is tolerated
  by `JSON.parse`. Every unrecognised shape lands on `undefined`, never on `false`, which is the
  invariant that matters. Correct.
- **`DRIVER_SPECS.codex.auth.loggedIn` (L75)** — negative-then-positive, case-insensitive, substring
  (not anchored), so it reads the answer out of a sentence. A usage dump that happens to contain the
  phrase "not logged in" would be read as a hard `false` and block preflight; Codex's usage text does
  not contain it, and the alternative (anchoring) would make the common case fail to match. Correct.
- **`createDriver(opts)` (L97-103)** — exhaustive `switch` over the two-member union with no
  `default`, so adding a driver is a compile error here (the intended "one place" property).
  `opts.claudeOpts ?? {}` means an omitted options object is a default-configured Claude driver
  rather than a crash. At runtime a value outside the union (a hand-edited registry) would fall
  through and return `undefined`; every caller reaches this through `isDriverName`-sanitized values,
  so the gap is unreachable — recorded as a reliance, not a defect. Correct.

## Bugs found

None found.
