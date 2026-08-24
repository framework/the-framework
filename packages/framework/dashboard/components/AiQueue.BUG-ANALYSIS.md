# Bug analysis: packages/framework/dashboard/components/AiQueue.tsx

## Business logic (high-level)

The Overview's AI Queue card. Checked clause-by-clause against `AiQueue.SPEC.md`:

- **Whole plan, never truncated** — every `!done` item of every `open > 0` project rendered;
  no cap anywhere; projects with nothing open filtered out (`withOpen`); loading vs "Nothing
  queued." distinguished. ✓
- **Read vs start are different acts** — `queueEntryLabel` splits ticket links (in-app button →
  `onOpenTicket(projectId, file)`), external URLs (`<a target=_blank rel=noreferrer>`), plain
  text; raw line as `title` hover on all three. Play button starts; project name is a plain
  header span with no handler. ✓
- **Single start = drain semantics** — `workOnEntryPrompt(entry)` quotes the *raw* line
  (check-off + link fidelity), kind `prompt`, options = `agentOptionsFromPreferences(prefs)` +
  `unattended: true`. ✓
- **Follow the started agent** — `onAgentStarted(projectId, prompt, result.agentId)` only on
  success; id may be undefined → shell's adopt fallback. Failure: no navigation, error under
  the list (`role="alert"` from `useStartAgent`'s error). ✓
- **Fan-out** — per-project count (default 3, floored at 1, no max; empty input treated as
  mid-edit), label sized to `min(count, open)` with singular form at 1; sequential starts, top
  of queue, each pinned to its own raw entry; `if (!result) break` ends the batch at the first
  refusal; no navigation; `fanningOut` keeps `inFlight` true across the gap *between* two
  starts (the guard `busy` alone would drop — the stated reason for the separate flag, and
  test-pinned). ✓

Concurrency/latching: `inFlight = busy || fanningOut !== null` disables every start button
(single and fan-out) during any start ✓; the clicked row's spinner is keyed by
`projectId\nentry` content, not index, so a polled list shifting under the click keeps the
spinner on the right row ✓ (the SPEC calls this out explicitly). Double-click reentry is
guarded both by the disabled buttons and the `if (inFlight) return` in both handlers.
`useStartAgent.start` never rejects (errors are folded into state), so `starting`/`fanningOut`
cannot be left stuck by a throw.

Controlled count input nuance: `onChange` ignores `''` (mid-edit) and non-finite input; since
no state changes, React does not rewrite the DOM value, so the box can sit empty while typing
and snaps back on the next state-driven render — matching the comment's intent. Rounds
fractional input. Correct.

Small notes (not bugs): list rows keyed by index — safe because rows are fully re-rendered
from props and the busy latch is content-keyed; two projects' entries with identical text are
disambiguated by the projectId in the latch key; `error` is shared with the fan-out path so a
mid-batch refusal reports identically to a single start's — exactly what the SPEC asks.

## Functions (low-level)

- **`workOnEntryPrompt(entry)` (L35)** — exported so tests pin the exact wording; embeds the
  raw line after a blank line. Correct.
- **`fanOutLabel(count)` (L47)** — singular at 1, plural otherwise; callers pass the capped
  count. Correct.
- **`AiQueue(props)` (L53)** — state: `starting` (content key), `fanningOut` (project id),
  `fanOutCounts` (per-project). All transitions analyzed above. Correct.
- **`agentEntry(projectId, entry)` (L84)** — guard, latch, start, unlatch, navigate-on-success.
  Correct.
- **`fanOutProject(project)` (L100)** — open entries sliced *before* the latch is set (the list
  cannot shift mid-batch under this closure — it works off the snapshot, which is the right
  semantics for "the top entries as of the click"). Sequential `await` in a `for..of`; break on
  refusal; unlatch after. Correct.
- **Render (L122-272)** — three-state body; per-project header with count pill, count input,
  fan-out button; rows as analyzed. Tooltips wrap the interactive pieces without nesting
  buttons in buttons. Correct.

## Bugs found

None found.
