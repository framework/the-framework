# Bug analysis: packages/framework/dashboard/lib/agent-label.ts

## Business logic (high-level)

What a listed agent is called (agent-label.SPEC.md): the first non-empty of typed intent → the
agent's own session name → the branch → the short start date/time. The SPEC's guarantee is that
every row carries an identifying name rather than an empty placeholder.

Fallback-ladder audit:

- `agent.intent?.trim() || agent.sessionName?.trim() || agent.branch?.trim() || formatDateTimeShort(agent.startedAt)`
  — order matches the SPEC exactly. `?.trim()` makes whitespace-only values fall through (and the
  returned label is the trimmed string, so no stray padding). `undefined?.trim()` is `undefined`,
  falsy — falls through. Correct.
- Final rung: `formatDateTimeShort` itself falls back to an em dash for an absent/unparseable
  `startedAt`, so even a fully empty AgentMeta yields "—" rather than empty text — the weakest
  possible name, but never blank; consistent with the SPEC's spirit (startedAt is always present
  in practice).

## Functions (low-level)

- `agentLabel(agent)` — pure; input is a Pick of AgentMeta so callers can pass partial rows.
  Edge cases handled: absent/blank intent (presets, CLI resumes), absent session name (agent
  never named itself), absent branch, unparseable date (delegated). No locale/encoding concerns
  beyond what formatDateTimeShort owns. Verdict: correct.

## Bugs found

None found.
