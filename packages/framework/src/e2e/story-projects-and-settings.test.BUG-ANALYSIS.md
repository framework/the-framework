# Bug analysis: packages/framework/src/e2e/story-projects-and-settings.test.ts

## Business logic (high-level)

Four whole-product stories driven through the same dashboard RPCs the browser calls, against real
git repos and real spawned agent processes with the fake driver in the agent seat. Each test stands
up its own `makeWorld()` and closes it in a `finally`, so a failed assertion still tears the world
down — important, because a leaked world leaves detached children running.

What each story pins, checked against `story-projects-and-settings.test.SPEC.md`:

1. **Adding a project (L15-48).** Install left its marker (`.the-framework/.gitignore` — the
   activation marker, so `stat` succeeding *is* the activation assertion); the sidebar lists the
   repo at its path as activated; the header's three reads answer (branch `main`, empty docs rail,
   empty agent history); re-adding is `{ok: true, alreadyActivated: true}` and does not duplicate
   the row; a bogus path is refused with `ok: false` rather than throwing. Every lookup filters by
   `project.id` rather than asserting on list length, so leftover registrations from an earlier test
   in the same process (they share one `XDG_CONFIG_HOME`) cannot make this flaky — the one place
   that does count (L40) counts *matches for this id*, which is the right way to express "not
   listed twice".
2. **Unknown projects (L50-62).** Reads for an unregistered id come back empty/`null` instead of
   throwing, and `sendStart` on one is refused. Note it registers a real project first, so the
   emptiness is genuinely about the unknown id and not about an empty registry.
3. **Settings reaching agents (L64-104).** The load-bearing story: preferences patched through the
   dashboard are readable back, and — the part that matters — a *continuation* fired the instant the
   first leg flips `done` carries the project's resolved model into the spawned child's spec even
   though the resume request itself only sends the follow-up text. The spec is read out of the
   harness's argv recording, which is the only observable channel because the spawn is detached. It
   also pins that a continuation reopens the same agent row rather than creating a second one, and
   (implicitly, by asserting `resumed.ok`) that a Start inside teardown's window waits the busy
   agent out instead of being refused (#1529).
4. **Quota + auto-PM panel (L106-140).** `unavailable` is surfaced explicitly rather than as an
   empty bar; a reading's windows and `readAt` pass through unchanged; auto-PM reports nothing
   before its first sweep and the report afterwards; the sweep button reaches the daemon's loop with
   the routine it named and hands back the recorded outcomes.

**Do the tests verify what they claim?** Stories 1-3 exercise real production code end to end.
Story 4 is thinner by construction: the harness replaces the daemon's quota poller and auto-PM loop
with mutable stubs, so what is verified is the RPC plumbing — that `onQuota` / `onAutoPm` /
`sendAutoPmSweep` forward the daemon's values unchanged and pass the sweep's `only` argument
through. That is a real (if narrow) contract, and the SPEC's wording for those bullets ("reach the
panel unchanged", "reaches the daemon's Auto PM loop with the routine it named") matches what is
actually checked; the *timing* semantics ("silent until its first sweep") belong to the stubbed
loop and are not proven here. Worth knowing when reading a green run, but not a defect in the test.

**Synchronization.** The only weak point is L89-90: after firing the resume, `waitAgent(…, 'done')`
and `waitRetired` can both be satisfied by the *first* leg's terminal state, since the row is still
`done` in the instant before the continuation flips it back to `running`. Nothing breaks, because
the assertion that follows waits on the second spawn appearing in the argv recording (L91-94),
which is the real barrier; the two earlier waits are just not doing the work their placement
suggests. Not filed: no assertion can pass wrongly because of it.

## Functions (low-level)

- **`test('add a project…')`** — five distinct claims, each with its own assertion; the `stat` at
  L23 throws (failing the test) if install did not write the marker, which is the intended
  assertion-by-side-effect. Verdict: correct.
- **`test('unknown projects degrade quietly…')`** — three assertions, all falsifiable (an
  implementation that threw on an unknown id would reject the awaited call). Verdict: correct.
- **`test('settings written in the dashboard reach the next resumed run…')`** — the `waitFor`
  around `spawnedSpecs()` is what makes the spec assertions race-free; `spawns[1]` is unambiguous
  because exactly two Starts happen. The failure messages passed to `assert.equal` name what broke,
  which matters for a 30 s-timeout suite. Verdict: correct.
- **`test('the usage panel reads the daemon quota source…')`** — the `as never` cast at L116 lets
  the story build a partial window without the full type; it is a fixture shortcut, not a
  correctness issue, since nothing here asserts on the window's shape. `assert.deepEqual(
  world.autoPm.sweeps, [{only: 'drain'}])` is the assertion that actually proves the button reached
  the loop with its argument. Verdict: correct.

## Bugs found

None found.
