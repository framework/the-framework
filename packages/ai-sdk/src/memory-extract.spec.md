`withMemoryExtract(spec, opts)` — post-run middleware that has a small model distill the latest `[user, assistant]` turn into durable user facts and writes the survivors to the registered `UserMemory` (#A4 Phase 3).

## TLDR

- Runs in `onFinish` (success only — failed runs never pollute memory); builds an ad-hoc `agent({ instructions, model: spec.extractWith })` with an `Output.object` JSON-schema prompt, parses `{facts: [{fact, score, tags?}]}`.
- Drops facts below `threshold` (default 0.7), unions `spec.tags` into model tags, writes via `mem.remember(spec.user, ...)`, then fires `onExtracted(written)`.
- Every failure (network, JSON parse, zod, `remember()` throw) goes through `opts.onError` and is otherwise swallowed — the parent prompt never breaks because of memory work.
- `extractLatestTurn` walks backwards for the last text-bearing assistant message (skipping tool-call steps), then the nearest prior user message; returns `null` on pause/handoff/no-text runs, which skips extraction.

## Problems

- Memory poisoning: auto-extraction lets a malicious user plant adversarial "facts". The score threshold is the v1 defense; `onExtracted` is the audit hook; a content-filter middleware is noted as follow-up.

## Facts

- Requires both `spec.extract === 'auto'` and `spec.extractWith` (a `provider/model` string) — otherwise the hook is a no-op.
- `lookup` defaults to `resolveUserMemory` (the `setUserMemory` registry); tests inject fakes via `opts.lookup`.
- Host-level rule: auto-installed extracts skip continuation calls (`options.messages` set); manually installed ones always run — the skip lives in `Agent`, not here.
