`LoopEngine` — the runtime of "the loop": matches a declared `LoopEvent` against the `Loop` policy and runs the resulting prompt chain, N fresh-context passes per prompt, with optional verdict gating and a decisions ledger exposed to prompts.

## TLDR

- `matches(event)` — pure: prompt ids that would fire for `event.kind`, concatenated in loop order and de-duped across all matching loops.
- `handle(event)` — runs the matched chain sequentially; returns `{ event, matched, outcomes }` (`matched: false` + no work when nothing fires).
- `runPrompt` — executes `prompt.run(ctx)` once per pass (1-based `pass`), building a fresh `LoopContext` each time; a throwing pass becomes `{ ok: false, error }` instead of aborting.
- `watch(events)` — consumes an (a)sync iterable of events, calling `handle` on each sequentially so the surface sees an ordered narrative.
- Progress is emitted through `makeEmitter` (`util/emitter.ts`) so a throwing `onEvent` observer is logged and swallowed, never aborting a run.

## Decisions

- `continueOnError: true` is the default (fire-and-report: every matched prompt runs even after failures); `false` turns the chain into a blocking gate that stops with a `gate-stop` event at the first non-passing outcome.
- A loop referencing an unknown prompt id does not throw: it emits `unknown-prompt` and records a non-passing outcome — deliberately so a missing prompt gates a blocking chain exactly like a throwing one would (per inline comment).
- `verdict` option defaults to `parseVerdict`; pass `null` to disable verdict parsing entirely (execution-only gate). A verdict is only parsed when the final pass executed (`ok`) — a verdict from a failed pass is meaningless.
- Only the *final* pass determines the outcome: `ok = last pass executed`, `passing = ok && (verdict ? verdict.blockers.length === 0 : true)` — so prompts without a verdict remain backward-compatibly gated on execution alone.
- Fresh context per pass is enforced by constructing a new `ctx` object per invocation and carrying no state between passes; the prompt is expected to re-derive its answer each time.

## Facts

- `LoopProgress` event types emitted: `match`, `no-match`, `unknown-prompt`, `prompt-start`, `pass`, `prompt-done`, `gate-stop`, `done`.
- The ledger (when configured) is spread into each pass's `ctx` as `ctx.ledger`, letting prompts consult prior rejected decisions.
- `createLoopEngine` is a factory mirror of `new LoopEngine(...)`; constructor TypeErrors on missing `loops`/`prompts`.

## Flows

- `handle(event): matches() → [per id] prompts.get(id) → runPrompt (per pass: fresh ctx → prompt.run → emit pass) → parseVerdict(last pass text) → passing? else gate-stop when !continueOnError → emit done → LoopRunResult`
- `watch(stream): for await event → handle(event) → LoopRunResult[]`
