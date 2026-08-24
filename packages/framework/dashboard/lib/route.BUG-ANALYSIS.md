# Bug analysis: packages/framework/dashboard/lib/route.ts

## Business logic (high-level)

The URL↔selection codec (#784): `/` Overview, `/{projectId}` launcher, `/{projectId}/{agentId}` one agent, `/settings`, `/tickets` (cross-project), `/{projectId}/tickets[/{slug}[/plan]]`. Checked against `route.SPEC.md`:

- **Reserved words cannot collide** — `settings`/`tickets` only match the *bare* word (project ids always carry a `-<hash>` suffix; agent ids derive from start time; a ticket slug is a `.md` filename so never the bare `plan`). `parseRoute` compares after decoding, so `%74ickets` also routes to Tickets — an equivalence, not a collision.
- **Tolerant parsing** — extra segments ignored on every branch (Overview/settings/tickets take only what they need; the agent route ignores the third segment; the ticket route ignores anything past `plan`); malformed percent-escapes kept literal via `decodeSegment`'s try/catch; empty path → Overview. `pathname` without a leading slash splits identically (`filter(Boolean)` drops the empty head either way).
- **`plan` only past a real slug** — the spread `...(third && fourth === PLAN_SEGMENT ? {plan:true} : {})` requires a slug; `/p/tickets/plan` reads `plan` as the slug (pinned by the test), `/p/tickets//plan`'s empty segment is filtered so `plan` becomes the slug too — consistent tolerance.
- **Encoding both ways** — `formatRoute` encodes project/agent/slug segments; `parseRoute` decodes. Round-trip verified by the tests for ids with spaces and slashes. A projectId that *decodes to* the literal word `tickets`/`settings` cannot exist by construction (hash suffix), so the decode-then-compare order is safe.
- **Format precedence** — `view: 'settings'` outranks stale project/agent ids; `view: 'tickets'` without project → `/tickets`; with project it outranks a stale agent id; `plan` dropped without a slug (never a dangling `/plan`). All pinned by tests.

Asymmetry noted (not a bug): `parseRoute` returns `ticketSlug: null` on `/{p}/tickets` but omits the key entirely on non-ticket routes; consumers destructure with defaults and `toEqual` treats absent/undefined alike, so nothing observes the difference.

## Functions (low-level)

- `SETTINGS_SEGMENT` / `TICKETS_SEGMENT` / `PLAN_SEGMENT` — constants with collision-safety rationale. Correct.
- `parseRoute(pathname)` — destructures the first four decoded segments; branch order: settings → tickets(bare) → empty → project+tickets → project[+agent]. `second === TICKETS_SEGMENT` is checked before the agent fallback, so `/{p}/tickets-ab` (not the bare word) correctly reads as an agent. Verdict: correct.
- `formatRoute(route)` — mirror with `encodeURIComponent` per segment; the `agentId: agentId` destructure alias is a cosmetic leftover. Verdict: correct.
- `decodeSegment(segment)` — `decodeURIComponent` with literal fallback ("a hand-typed URL is input"). Verdict: correct.

## Bugs found

None found.
