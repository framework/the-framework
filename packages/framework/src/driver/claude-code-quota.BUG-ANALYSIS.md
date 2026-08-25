# Bug analysis: packages/framework/src/driver/claude-code-quota.ts

## Business logic (high-level)

Reads the account's subscription quota by running `claude -p /usage --output-format json` and parsing the prose readout inside the JSON envelope. The SPEC's load-bearing rules and their checks:

- **A failed read is never a zero** — `parseQuotaReadout` returns `{available:false}` when no window line parses; the strict `WINDOW_LINE` regex (label, then `% used` immediately after the colon+spaces) was probed against the decoy lines from the real readout (`Top skills: /dataviz 2%…`, `70% of your usage…`, `Sonnet: 3% used in long context`, comma-separated resets) — none match; the three genuine window shapes (with `·`-separated reset, without reset, fractional percent) all match. ✔
- **No-subscription vs unrecognized** — keyed on the shared header tail `to power your Claude Code usage`, present for both "your subscription" and mid-overage "your overages" headers. ✔ (test pins the overage case)
- **The read always ends** — five outcomes: `agent-not-found` (spawn `error`), `fetch-failed` (non-zero exit, or the envelope's `is_error`), `unrecognized` (unparseable stdout — including empty stdout while the CLI replaces itself, #960), `timeout` (timer, deliberately *not* unref'd so the promise is guaranteed to settle), and abort. All settle exactly once (`settled` guard clears timer + abort listener). ✔
- **Abort maps to `timeout`** — the SPEC lists "the user cancelling" among the distinct outcomes, but the reason vocabulary has no `aborted`, so cancel shares `timeout`. Both are transient and an aborting caller discards the result, so this reads as a deliberate collapse; noted, not filed.
- **Never `--bare`** — argv pinned by test. ✔
- **UTF-8 split safety** — stdout collected as Buffers, decoded once (the readout's `·` is multibyte). ✔

Process hygiene is where it diverges from the rest of the driver layer: the child is spawned **without `detached`** and is **never registered** in the child registry; on timeout/abort it gets a single `child.kill('SIGTERM')` with no group kill and no SIGKILL escalation. The driver SPEC's "No stray processes" promises every spawned CLI runs as its own process group, "stopped as a whole tree and reaped even on a hard daemon exit". Consequences here: (a) a `claude` that ignores SIGTERM (hung mid-self-update — the very scenario #960 anticipates) lingers forever; (b) SIGTERM reaches only the top process, orphaning any helpers the CLI spawned; (c) a hard daemon exit does not reap an in-flight read (though a terminal Ctrl-C still kills it via the shared foreground process group — a partial, accidental mitigation). Filed as a bug (minor: the child is short-lived and usually exits on its own).

TDZ note: `settle` references `timer` before its declaration, but every path that can call `settle` (abort listener, timer, stream/child events) fires asynchronously after the synchronous setup block, so `timer` is always initialized first. Safe.

## Functions (low-level)

- **`windowKind(label)`** — anchored case-insensitive matches for `Current session` / `Current week (all models)` / `Current week (…)`, else `unknown`. Order matters (all-models checked before the general week-model pattern) and is right. Verdict: correct.
- **`parseQuotaReadout(text)`** — split lines, trim, regex, strip the `resets ` verb, `Number(percent)` (regex guarantees a valid non-negative decimal; no NaN possible). Windows found → available; none → header check. Empty string → `no-subscription` (correct: no header). Verdict: correct.
- **`readClaudeQuota(opts)`** — pre-aborted → `timeout`; spawn; settle-once machinery as above. `close` with code 0 → parse; non-zero → `fetch-failed` (including `code === null` from our own timeout kill — but `settle` already ran then, so the no-op is fine). `error` → `agent-not-found` (any spawn error, e.g. EACCES, is folded in — acceptable approximation, both mean "the install cannot answer"). Verdict: bug found (process hygiene, above); otherwise correct.
- **`parseQuotaResponse(stdout)`** — JSON.parse catch → `unrecognized`; **guards `typeof !== 'object' || null`** (the guard the stream parsers are missing); `is_error === true` → `fetch-failed`; non-string `result` → `unrecognized`; else parse readout. Verdict: correct.

## Bugs found

1. **L104** (`spawn(opts.bin ?? 'claude', […], { cwd, env })`): the quota child is spawned without `detached: true` and never `registerChild`-ed, and the timeout/abort path (L123/L132) sends a single `SIGTERM` to the top process only — no group kill, no SIGKILL escalation, no reap on hard daemon exit. A hung `claude /usage` (e.g. mid self-update, SIGTERM-ignoring) or its orphaned helper processes survive indefinitely, contradicting the driver SPEC's "No stray processes — each spawned CLI runs as its own process group, stopped as a whole tree and reaped even on a hard daemon exit". Severity: minor (short-lived child, periodic poller means bounded accumulation). Fix sketch: spawn with `detached: true`, `registerChild(pid)`/`unregisterChild` around the lifetime, and use `killTree(pid, 'SIGTERM')` with the same grace-then-SIGKILL pattern `cli-session.ts` uses.
