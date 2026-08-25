# Bug analysis: packages/framework/src/cli.test.ts

## Business logic (high-level)

The test file for `cli.ts`, matching `cli.test.SPEC.md` section by section: the four-option
command surface and retired flags/verbs; spec round-tripping and re-validation of untrusted
fields; config layering in both directions (on-over-off and off-over-on); the refusals (layout
skew, unreadable spec, empty prompt, resume-on-build); whole offline runs via the fake driver
(build narration, transparent rawness, prompt path); steerability/interactivity predicates plus a
real end-to-end control-channel steering; the journal (branch rename recorded as fact, browser URL
held/re-said); continuations (build re-enters build, prompt stays prompt); the on-before-mergeable
step (single child, vanilla, recursion guard, materialized presets, recorded declines); the
actions-target no-token process test (must exit, exit 2, meta failed, reason names both cures);
driver settings/session link; the startup footer.

The tests genuinely verify what they claim: they read archived event logs and `agent.json` off
disk rather than trusting stdout; the steering test attributes the resolution (`by: 'user'`) and
ends the parked session through the same channel; the actions test drives the real binary because
the defect was "the process never exits", which only a process can demonstrate. Environment
mutation (`FRAMEWORK_FAKE`, `FRAMEWORK_FAKE_AWAIT`, `XDG_CONFIG_HOME`) is save/restored in
`finally` blocks and is safe because `node --test` runs one file's tests serially.

Notable coverage gap (not a test defect): nothing pins the SPEC's "an unattended agent keeps ...
messages still work" claim — which is exactly where `cli.ts` diverges from the SPEC (see
`cli.BUG-ANALYSIS.md` bug 1). A test handing a control `message` to an unattended fake agent
would have caught it.

## Functions (low-level)

- **`capture()`** — collects out/err lines. Correct.
- **`spec(fields)` / `opts(fields)`** — spec factory with placeholder cwd `/work/app` (never
  executed), and its `agentOptions` projection. Correct.
- **`runAgentCli(fields, io, fake)`** — writes a real spec (throwaway mkdtemp cwd when none
  given), toggles `FRAMEWORK_FAKE` around `runCli(['--agent', path])`, restores it in `finally`.
  The throwaway cwd dirs are never removed (temp-dir litter per test run) — hygiene, not a
  correctness bug. Correct.
- **`memFs()`** — in-memory `StoreFs`; `readdir` returns `[]`, `exists`/`append` consistent.
  Sufficient for `materializePresets`. Correct.
- **parseArgs tests (L91, L323)** — pin the surface, missing values, retired flags. Correct.
- **agentOptions tests (L105–L164, L224–L272, L336–L346, L370)** — round-trip, defaults,
  re-validation (bad handoff, bad driver, non-ticket paths incl. traversal), trimming, tri-states.
  Correct.
- **mergeAgentConfig tests (L137–L157, L242–L251, L379–L403)** — default `pr` handoff, nearest
  layer wins both directions, `sources` attribution. Correct.
- **withBrowser test (L166)** — folds MCP servers only when enabled, non-mutating. Correct.
- **promptAgentSpec tests (L175, L184)** — no `onBeforeMergeable` (recursion guard), vanilla flag.
  Correct.
- **runOnBeforeMergeable tests (L190, L209, L215, L557)** — one child run, rendered prompt names
  both presets, best-effort failure reporting, presets materialized into the injected fs, outcome
  values. Correct.
- **frameworkVersion / --version tests (L274, L283)** — compare against the real package.json;
  guard against the `unknown` sentinel. Correct.
- **refusal tests (L291, L298, L310, L405, L412)** — empty prompt exit 2; layout skew exit 1
  (writes a marker whose archive-dir line is rewritten — depends on `layoutMarker()` containing
  `archive-dir: agents`, which it does today); unreadable spec exit 2; resume-on-build exit 2 and
  resume-on-prompt honored. Correct.
- **offline run tests (L465, L476, L316)** — narration markers present/absent per flow. The
  transparent test only asserts negatively (`scope: full`, `production-grade` absent) plus exit 0;
  acceptable since the positive raw-prompt path is pinned elsewhere. Correct.
- **steering e2e (L491)** — spawns a fake build parked on `await-choices`, plays the daemon by
  tailing events.jsonl and appending the pick, then Stops once done; asserts the pick was
  attributed `by: 'user'` and exactly one `choice-resolved`. Bounded loop (10s) with a hard
  `settled` latch; on pathological slowness `await done` would rely on the runner's timeout —
  acceptable. Correct.
- **on-before-mergeable decline tests (L565, L589)** — read the *archived* log (close() copies)
  for the skip event, and assert absence when never asked. Correct.
- **isSteerable / isInteractive tests (L607–L629)** — pin the #905/#714 predicates. Correct.
- **footer tests (L631–L670)** — static-first ordering via a held promise, no stop command, no
  positional build, offline registry costs nothing. Correct.
- **journal rename test (L672)** — real git repo on `tf-agent-r1`; polls up to 2s for the async
  rename's branch event, then asserts HEAD. Handles the fire-and-forget rename properly. Correct.
- **browser URL test (L702)** — held before `session`, emitted after, re-said per later session
  (counts occurrences). Correct.
- **actions no-token process test (L741)** — scrubs GH_TOKEN/GITHUB_TOKEN, prepends a stub `gh`
  that exits 1, runs the real bin with a 30s watchdog, asserts exit 2, meta `failed`, and the end
  detail naming both cures. Thorough; correct.
- **continuation tests (L796, L827)** — build continuation re-enters the build flow (second
  `intent` after the first `end`; meta keeps kind `build` and the original intent); prompt
  continuation shows no `bootstrap`. Correct.

## Bugs found

None found. (The one systemic observation — no test exercises live-chat messages on an unattended
agent, the exact spot where `cli.ts` contradicts `cli.SPEC.md` — is a coverage gap recorded here
and attributed as a source bug in `cli.BUG-ANALYSIS.md`.)
