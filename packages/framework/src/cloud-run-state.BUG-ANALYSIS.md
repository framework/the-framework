# Bug analysis: packages/framework/src/cloud-run-state.ts

## Business logic (high-level)

The one node-free rule (#1668) that turns a `web`-target agent's stored record into the word its
row shows once the local half is over, so the rail, Overview and browser client cannot disagree.
Cross-checked line by line against `cloud-run-state.SPEC.md`:

- **Only a settled web agent has a cloud state** — L37 requires `target === 'web' &&
  status === 'done'`; a local/actions agent or a web agent still `running`/`stopped`/`failed`
  returns `undefined` (its stored status is the word). Matches the SPEC, including the
  deliberately-undefined `failed + cloudWaiting` combination (pinned by the test).
- **Waiting beats everything** — L38 checks `cloudWaiting` first, so an old parked session and a
  parked session with a PR both read `waiting`. Matches "however old the agent is".
- **Adopted work speaks as a local agent's would** — L39 `mergeOutcome === 'merged'` → `merged`;
  the other `mergeOutcome` values (`auto-armed`, `watched`, `withheld`, `failed` per
  `AgentMeta`) deliberately fall through to the PR check, which is right: none of them mean the
  work landed. L42: any recorded `pr` → `done`; the PR's live state is read where the badge shows,
  by design.
- **Otherwise age decides** — L43–44: `Date.parse(startedAt)`; a finite start within
  `CLOUD_SESSION_WINDOW_MS` (inclusive boundary, pinned by the test) → `in-cloud`, else `done`.
  An unparseable start yields `NaN` → `Number.isFinite` false → `done`, exactly the SPEC's "a
  start time that cannot be read counts as outside the window".
- **Window constant** — 12h, documented as the bridge's own `bridge-sessions` watch window (the
  SPEC's rationale for not using adoption's 48h). Consistency with the bridge constant is a
  cross-module fact I could not falsify from here; a drift would be a doc/semantics skew, not a
  crash.

Edge cases weighed: a `startedAt` in the future (clock skew) gives a negative age → `in-cloud`,
which is the harmless direction and self-corrects; `cloudWaiting` is a daemon-side in-memory
annotation (never stored), so a pure read of the persisted meta simply lacks it and degrades to
the age rule — intended per the SPEC's rationale. No state, no concurrency.

## Functions (low-level)

- **`CLOUD_SESSION_WINDOW_MS`** — `12 * 60 * 60 * 1000` = 43,200,000. Correct arithmetic.
- **`CloudRunFacts`** — `Pick` of the six meta fields the rule reads; all exist on `AgentMeta`
  with the expected types (`startedAt: string` required; `pr`, `mergeOutcome`, `cloudWaiting`
  optional). Correct.
- **`cloudRunState(meta, now)`** — the ordered rule as specified. Inputs: any meta + a millisecond
  clock. Outputs exactly the four words or `undefined`. Order of checks matches the SPEC's "in
  this order". Boundary `<=` includes the window's last millisecond (pinned). Verdict: correct.
- **`cloudRunActive(state)`** — true for `waiting`/`in-cloud`, false for `merged`/`done`/
  `undefined`. Matches "at work means in cloud or waiting". Verdict: correct.

## Bugs found

None found.
