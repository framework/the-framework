# Bug analysis: packages/framework/dashboard/components/AgentErrorCount.tsx

## Business logic (high-level)

A pure, stateless projection: fold `error` events via `agentErrors` (src/agent-view.ts — a simple
filter/map that always returns an array), show nothing for zero, otherwise a shrink-proof
count + optional latest headline, with every headline in the tooltip. Checked against
`AgentErrorCount.SPEC.md`:

- "Nothing when none" — `errors.length === 0 → null`. ✓
- "A count, not the errors" — only headlines are surfaced; `detail` stays in the log. ✓
- "Latest headline inline where the row has room" — `headline` prop gates it; `latest` is
  `errors[errors.length - 1]`, non-null-asserted only after the length check, so safe. ✓
- "Never truncated" — `shrink-0` on the container and icon; the inline headline alone carries
  `min-w-0 truncate`, so the count keeps full width while the headline clips. ✓
- Tooltip lists *every* headline joined by newlines under `whitespace-pre-line`. ✓

Scope note: the fold runs over the whole `events` prop, not `currentAgentEvents` — so a resumed
agent's count includes the earlier leg's errors. That matches the SPEC ("how many errors an
agent reported" — the agent, not the leg) and the callers pass the agent's own feed/archive, so
cross-agent contamination cannot occur through this component (the segment-slicing problem lives
with the channel owner, not here).

Edge cases: empty `events` → null; an error event with an empty-string headline renders "· " —
producers always set a headline (typed as required `headline: string`), so not reachable;
duplicate headlines join fine. No state, no listeners, no keys. Rerenders recompute the fold —
cheap linear scan.

## Functions (low-level)

- **`AgentErrorCount({ events, headline })` (L10)** — described above. Inputs: the agent's event
  feed and the room flag. Output: null or the alert span wrapped in a Tooltip. The
  `TooltipTrigger render={...}` pattern matches the ui/tooltip primitive used across the
  codebase. `role="alert"` on a statically rendered span is an a11y nicety more than a live
  region (the count updates in place while the agent streams, so it does announce on change).
  Verdict: correct.

## Bugs found

None found.
