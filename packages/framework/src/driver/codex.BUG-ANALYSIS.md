# Bug analysis: packages/framework/src/driver/codex.ts

## Business logic (high-level)

The second real `Driver` implementation: wraps the `codex` CLI's non-interactive mode
(`codex exec --json`) so a Codex agent behaves like every other agent in The Framework. Three
responsibilities:

1. **Argv/stdin construction** (`CodexSession.buildArgs` + `prompt`). The prompt goes over stdin
   (no arg-length limit), the framing is prepended to it because Codex has no
   `--append-system-prompt`, the sandbox is always passed explicitly (never the bypass flag), and
   `--skip-git-repo-check` lets a not-yet-a-repo workspace run. All of the *process* handling is
   delegated to `runCliSession`, so process-group kill, SIGTERM/SIGKILL escalation, abort wiring,
   non-zero-exit-fails-the-turn and stderr capture are inherited rather than re-implemented. That
   delegation is the right call and is what keeps this file small.
2. **Output dialect** (`CodexJsonParser`). NDJSON, one event per line: `thread.started` carries the
   thread id, `item.completed`/`agent_message` carries streamed text (last one wins as the turn
   answer), `item.started` on any other item surfaces the tool *kind* only, `turn.completed` carries
   usage. Everything unparseable is noise and dropped.
3. **Usage mapping** (`parseCodexUsage`). Codex's counts are OpenAI-shaped: `input_tokens` is
   inclusive of cache, `reasoning_output_tokens` is a subset of `output_tokens`. The mapping
   subtracts the cache from the input, ignores reasoning, and reports `cacheCreationTokens: 0`. No
   `costUsd` at all, deliberately, so the #322 budget cap (which gates on a price) simply cannot
   fire — matching the SPEC's "never a cost of zero, which would read as free".

**Invariants / lifecycle.** A `CodexSession` is inert: it holds config + `cwd`, and every `prompt`
is a fresh CLI invocation with a *fresh* parser instance (constructed per call at L87), so no state
bleeds between turns. `dispose` is a genuine no-op because nothing durable is held — correct here,
unlike a driver that keeps a long-lived child. Concurrency: two overlapping `prompt` calls on the
same session are independent processes with independent parsers; the only shared mutable state is
the module-level `sessionCounter`, which is single-threaded increment and safe.

**Deliberate omissions, all matching the SPEC.** No `readQuota` (the seam is optional). No
`resumeSessionId` / `opts.resume` support — the type docs call resume best-effort and say a driver
that can't resume "runs fresh", so ignoring both is contract-compliant, not a bug. No `costUsd`.

**Gap worth naming (not filed as a bug).** Unlike `StreamJsonParser`, this parser never emits a
`{type:'session'}` event when `thread.started` arrives; the thread id only escapes via `result()`,
which `runCliSession` only reaches on a clean exit. So a Codex turn that is stopped or dies loses
its thread id. For Claude Code that id is the `--resume` handle and #1322 exists precisely to
rescue it; for Codex nothing resumes, so the lost id costs nothing today. Missing feature, not a
defect.

## Functions (low-level)

- **`CodexDriver.id` / `constructor` / `start`** — `start` allocates a session object and resolves;
  it never touches the filesystem or spawns, so it cannot fail and needs no error path. Note `id`
  is typed `DriverImplId` on the interface and assigned the literal `'codex'` — fine as long as
  `driver-names.ts` lists it (it does; the file compiles). Verdict: correct.

- **`CodexSession` constructor** — `cwd` copied from `startOpts`; `id` is `codex-<n>` from a
  module-global counter. This is *not* the agent's own thread id (the interface says "the agent's
  own session id when it exposes one"), but the thread id is only known after the first turn runs,
  so a synthetic id is the only option at construction time and the real one is carried on
  `DriverTurn.sessionId`. Counter resets to 0 on daemon restart, so ids are unique only within a
  process — nothing persists them. Verdict: correct.

- **`CodexSession.prompt`** — folds session + per-call framing via `combineFraming` (which drops
  empty/undefined parts), prepends it blank-line separated, delegates to `runCliSession`. Edge
  cases: no framing at all → prompt sent verbatim (guarded by the ternary, so no leading blank
  lines); empty `text` with framing → `"framing\n\n"`, harmless. `opts.resume` is silently ignored
  (see above). Aborts, non-zero exits and stderr are `runCliSession`'s business and are handled
  there. Verdict: correct.

- **`CodexSession.readCode`** — `readWorkspaceFile(this.cwd, path)`, i.e. `resolve(cwd, path)`.
  An absolute `path` or one with `..` escapes the workspace; that is `session-support.ts`'s
  behaviour and identical in the Claude Code driver, and callers pass agent-produced relative paths.
  Noted as a shared reliance rather than a bug in this file. Verdict: correct.

- **`CodexSession.dispose`** — no-op, idempotent by construction. Verdict: correct.

- **`CodexSession.buildArgs`** — fixed argv plus optional `-m <model>` and `extraArgs`. `extraArgs`
  is an escape hatch appended verbatim; a user could pass `--dangerously-bypass-approvals-and-sandbox`
  through it, but that is the documented purpose of an escape hatch. `--sandbox` is always emitted
  before `extraArgs`, so a later duplicate would win — again escape-hatch semantics. Verdict: correct.

- **`CodexJsonParser.push`** — the one real defect: `JSON.parse` succeeds for the literal line
  `null`, and the very next statement indexes the result. See Bugs found. Beyond that: untrimmed
  input is fine because `readline` strips the line terminator (including `\r\n`); non-object JSON
  (`123`, `"str"`, `[]`) auto-boxes and yields `undefined` for `obj['type']`, so it falls through to
  the `item` guard and returns `[]`; a `thread.started` with a non-string id is ignored, leaving
  `sessionId` undefined so `result()` omits it (correct — better than a bogus id); a second
  `thread.started` overwrites the id, which is the desired "latest wins". The `item.started`
  branch labels the action with the raw item `type`, so any future item kind (including
  `agent_message`, should the CLI start announcing message starts) surfaces as a pseudo-tool in the
  dashboard — cosmetic and unverifiable against the pinned 0.144.4 dialect, so not filed.
  `turn.failed` is not recognized and produces nothing; the turn is still failed by the CLI's
  non-zero exit in `runCliSession`, so the outcome is right even though the reason is lost.
  Verdict: bug found (null line).

- **`CodexJsonParser.result`** — returns accumulated text plus the optional id/usage, omitting
  absent keys rather than setting them undefined (so `'costUsd' in usage` is false, which the test
  pins). A turn with no `agent_message` yields `text: ''`; `runCliSession` then emits a `result`
  event with empty text, which is honest. Verdict: correct.

- **`parseCodexUsage`** — guards non-object/null input (the guard the parser itself lacks). `num()`
  coerces missing/NaN/Infinity/negative values to 0, so no `NaN` can reach the usage record.
  `Math.min(cached, input)` makes `inputTokens` non-negative even for a nonsense payload where the
  cache figure exceeds the total — pinned by the test at L78. Note the clamp also *raises*
  `cacheReadTokens` accuracy in the opposite direction: for `{input:10, cached:999}` it reports
  `cacheRead: 10`, which is the only self-consistent reading available. Reasoning tokens are
  deliberately never added. Verdict: correct.

## Bugs found

1. **L136** (`const type = obj['type']`, immediately after `JSON.parse`): a stdout line consisting
   of exactly `null` parses successfully (so the `catch` at L133 does not fire) and the property
   access then throws `TypeError: Cannot read properties of null (reading 'type')`. That throw
   happens inside `runCliSession`'s `readline` `'line'` handler (`cli-session.ts` L139-141), which is
   outside any promise chain, so it is an uncaught exception in the daemon rather than a failed
   turn; the codebase installs no `uncaughtException` handler, so the process dies and the exit hook
   SIGKILLs every live agent. Contradicts the parser's own contract ("Banners and other noise: not
   every line is an event", L134) and the SPEC's "Output that is not one of the CLI's structured
   events — banners and other noise — is ignored rather than shown"; `parseCodexUsage` (L201) guards
   this exact `typeof x === 'object' && x !== null` case, showing the intended discipline. Severity:
   major (blast radius is the whole daemon), likelihood low (needs the CLI to print a bare `null`).
   Fix sketch: after the parse, `if (typeof obj !== 'object' || obj === null) return []`.
