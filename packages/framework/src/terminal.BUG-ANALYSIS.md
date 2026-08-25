# Bug analysis: packages/framework/src/terminal.ts

## Business logic (high-level)

Pure formatter: one `FrameworkEvent` → one human-readable terminal line. It is the CLI's
counterpart to the dashboard's read-model projections over the same union, deliberately kept out
of `events.ts` so the event contract stays a plain (browser-safe) data module.

Responsibilities and invariants:

- **Total coverage of the union.** Every `FrameworkEvent.kind` gets a wording. The function has no
  `default:` arm and no trailing `return`, so TypeScript's exhaustiveness check is the only thing
  keeping the return type `string`: adding a new event kind without a case here would make the
  function return `undefined` at runtime, but it would fail to typecheck first. That is the
  intended design (compiler-enforced completeness) rather than a hole.
- **Nested exhaustive switches.** `on-before-mergeable` and `handoff` switch on `outcome` inside
  the outer `case`. Both inner switches return on every arm, so no fallthrough into the next outer
  case can happen for well-typed input. For *malformed* input (an event replayed from a journal
  with an outcome string the union does not have) the inner switch falls through: for
  `on-before-mergeable` control lands in `case 'handoff-armed'` and reads `event.pr/.merge/.push`
  (all `undefined`) and returns "when this ends: nothing"; for `handoff` it falls into
  `case 'usage'` and produces `NaN`/`undefined` text. Journals are written by this same process
  and the outcome sets are closed, so this is not reachable in practice — noted as a reliance, not
  a bug.
- **Usage never reads as free** (#540). With no `costUsd`, token counts print with an explicit
  "no price reported" suffix rather than `$0.0000`.
- **Handoff outcomes are always said** (#1216/#1363/#1382). The armed line states consequences up
  front and, for a real handoff, the merge half is appended as its own line on every outcome
  except `failed` (where there is no `merge` field in the union at all).
- **Reasons in the reader's terms.** Skip/withheld codes are mapped to sentences. `mergeWithheldWhy`
  is exported specifically so the CLI's own stdout line shares the wording and the two surfaces
  cannot drift.
- **Quota is quiet on the happy path.** Only `rejected` and `allowed_warning` get a loud marker;
  anything else prints a neutral `·` line.

No lifecycle/state: the module is stateless and side-effect free, so there are no concurrency or
ordering concerns beyond the caller's own event ordering.

## Functions (low-level)

### `formatFrameworkEvent(event): string` (L10)

Big switch over `event.kind`.

- `session` (L13): composes driver/model/workspace/sessionLink. `event.fake` overrides the driver
  name with `fake`. An empty-string `model` or `sessionLink` is falsy and correctly omitted rather
  than printing `()` or a trailing dash. Correct.
- `session-update`, `system-prompt`, `preview`, `browser-stream`, `browser`, `log`, `view`,
  `session-name`, `ready-for-merge`, `open-pr`, `settled`, `ticket`, `branch`, `pull-request`:
  straight interpolation, no edge cases beyond empty strings, which read acceptably. Correct.
- `error` (L29): re-indents multi-line detail by four spaces via `replace(/\n/g, '\n    ')`. Handles
  CRLF poorly (the `\r` stays before the newline) but nothing in this repo emits CRLF details.
  Correct.
- `cloud-anchor` (L45): `sha.slice(0, 7)`. A short/empty sha just prints shorter; no throw. Correct.
- `on-before-mergeable` (L48): inner switch over `queued | incomplete | skipped`. Correct.
- `handoff-armed` (L57): the ordering of the three `if`s encodes the intended precedence —
  merge-armed wins over PR, PR wins over push-only. A `{push:false, pr:true}` combination would
  print "push the branch and open a draft PR" even though push is off, but the arming logic never
  produces PR-without-push (a PR needs a pushed branch). Correct as used.
- `handoff` (L66): `merge` line appended for `done` and `skipped`; `failed` has no `merge` in the
  type so the guard `event.outcome !== 'failed'` is belt-and-braces for the narrowing. For `done`,
  the line is `✓ opened <url>` when a URL exists, else `✓ branch pushed` — and every `done` in
  `dashboard/agent-handoff.ts` sets `pushed: true`, so the fallback wording is never a false claim.
  Note `event.pushed` and `event.number` are never rendered; that is a display choice, not a defect.
  Correct.
- `usage` (L80): pluralizes "turn". Without a price it sums `inputTokens + cacheReadTokens +
  outputTokens` — `cacheCreationTokens` (tracked in `usage.ts` and reported by the claude-code
  driver) is silently excluded from the printed total, so the "tokens" figure under-reports what
  the agent actually consumed. See Bugs found. With a price it prints `$x.xxxx` at four decimals;
  a sub-$0.00005 spend prints `$0.0000`, which is the very reading #540 wanted to avoid, but only
  the no-price case was in scope for that fix.
- `choice` (L90): `mark()` uses `[x]/[ ]` for multi-select (driven by `o.default`) and `●/○` for
  single-select (driven by `event.recommended`). An empty `options` array yields a title line with
  a trailing newline and nothing after it — cosmetic only, and gates always carry options.
- `choice-resolved` (L96): `pickedIds(...).join(', ') || '(none)'` handles empty/blank picks.
- `driver` (L98): delegates.
- `intent` (L100): quotes the truncated text.
- `end` (L102): `ok` → finished, `stopped` → stopped, else `✗ failed:` with `detail ?? 'unknown
  error'`. Correct.

Verdict: correct except the `usage` token total (below).

### `mergeLine(merge)` (L108)

Maps the five `AutoMergeOutcome` shapes to one line each. Exhaustive, returns on every arm.
Correct.

### `mergeWithheldWhy(reason)` (L127) — exported

Two-arm mapping shared with the CLI's stdout path. Correct.

### `skipReason(reason)` (L137)

Five-arm mapping over `OnBeforeMergeableSkip`. Correct.

### `handoffSkipReason(reason)` (L153)

Ten-arm mapping over `AutoHandoffSkip`; matches the union in `events.ts` exactly (`not-armed`,
`branch-gone`, `no-commits`, `commit-failed`, `no-remote`, `already-open`, `already-landed`,
`already-pushed`, `run-stopped`, `fake-run`). Correct.

### `formatDriverEvent(event)` (L178)

Eight-arm mapping over `DriverEvent.type`. `start` truncates the prompt at 140 chars, `text` at the
default 100. The `session` arm is documented as normally consumed by telemetry, rendered anyway so
a stray one does not crash the formatter. Correct.

### `formatRateLimit(limit)` (L202)

`new Date(limit.resetsAt).toISOString()`. `DriverRateLimit.resetsAt` is `number` (epoch ms) and the
claude-code parser rejects non-finite values before constructing the event
(`driver/claude-code.ts` L312), so `toISOString()` cannot throw `RangeError` on a real event.
Correct.

### `truncate(text, max = 100)` (L209)

Collapses all whitespace runs to single spaces, trims, then cuts to `max - 1` plus an ellipsis, so
the output never exceeds `max` characters. `max = 0` would produce `slice(0,-1)` nonsense, but no
caller passes a small max. Correct.

## Bugs found

1. `L85`: the no-price usage line's token total omits `cacheCreationTokens`. `FrameworkEvent`'s
   `usage` payload carries five counters and `usage.ts` accumulates all five, but the printed
   "tokens: N" sums only `inputTokens + cacheReadTokens + outputTokens`. A claude-code run that
   reports no price (the exact case this branch exists for, #540) and writes a large cache — e.g.
   `cacheCreationTokens: 800` as in `fake-script.ts`'s fake usage — prints a total 800 tokens below
   what was actually consumed, which contradicts the intent of "report the tokens the agent *did*
   report". Severity: minor. Fix: include `event.cacheCreationTokens` in the sum.
