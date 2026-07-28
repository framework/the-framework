Leaf helpers shared by the agent loop and approval-resume: generator detection, uniform execute iteration, arg validation, model-output stringification, and approval evaluation.

## TLDR

- `isAsyncGenerator`: structural check (`next`/`return`/`Symbol.asyncIterator`) — executors may be wrapped, not literal `async function*`.
- `executeMaybeStreaming(tool, args, ctx)`: async generator normalizing value/promise/async-generator executes — yields are preliminary tool-update payloads, the return value is the final result; streaming callers emit yields live, non-streaming callers drain them.
- `validateToolArgs`: `inputSchema.safeParse`; success returns the PARSED value (zod defaults/transforms/coercions applied, so execute gets the canonical shape); failure returns a structured `InvalidToolArgumentsError` (`error:'invalid_arguments'`, per-issue `path`/`message`) meant to be fed back to the model.
- `applyToModelOutput(tool, result, onError?)`: honors `tool.toModelOutput`; a throwing transform MUST NOT crash the loop (R6) — error routed through `onError` middleware, falls back to `defaultStringify` (string pass-through, else `JSON.stringify`).
- `evaluateApproval(tool, tc, options)`: resolves `needsApproval` (boolean or possibly-async predicate over args) → `'allow'` when not required or id in `approvedToolCallIds`; `'rejected'` when in `rejectedToolCallIds` (checked before approved); else `'pending'`.
