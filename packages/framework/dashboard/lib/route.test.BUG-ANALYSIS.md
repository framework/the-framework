# Bug analysis: packages/framework/dashboard/lib/route.test.ts

## Business logic (high-level)

Thorough two-way coverage of the route codec: every address in the map is parsed and formatted, the reserved-word rules are tested from both sides (bare word taken; prefixed/suffixed variants left as project or agent ids), tolerance is pinned (trailing slash, stray segments, malformed escape kept literal), encoding is pinned in both directions, format precedence over stale ids is pinned, and a final round-trip loop covers nine representative routes including the encoded-characters case and the ticket/plan family. Every assertion is exact (`toEqual` on the full route object), so field additions or misclassifications fail loudly.

Subtle cases correctly nailed: `/my-repo-a1b2/tickets/plan` reads `plan` as the *slug* (third segment), while `/…/tickets/slug.md/plan` sets the flag; `plan: true` without a slug formats to the bare tickets page rather than a dangling `/plan`; `dir=asc`-style… (n/a — that's ticket-filter); `parseRoute('')` equals the Overview.

Gaps (noted, not bugs): no test for `/settings-a1b2/anything` (second segment after a settings-prefixed project — falls to the agent branch, uninteresting), none for a hand-typed encoded reserved word (`/%74ickets` — decodes to the Tickets view; an equivalence the source accepts), and the round-trip list omits the `plan`-less `/p/tickets/slug` + stray-segment combination already covered directly.

## Functions (low-level)

- `parseRoute` suites — Overview (both `/` and ``), project home, session, trailing-slash/extra-segment tolerance, decode + malformed-escape literalness, settings (bare/trailing/stray + non-collision pair), tickets top-level (same shape), project tickets page (with `ticketSlug: null` pinned), reserved-word non-collision at the second segment, ticket detail (+stray segment), and the plan view (fourth segment vs third-segment slug). All failure-capable. Correct.
- `formatRoute` suites — each route, no-session-without-project, encoding, settings/tickets precedence over stale ids, slug encoding, plan path and the slugless-plan drop. Correct.
- Round-trip loop — `parseRoute(formatRoute(route))` equality across nine routes; relies on `toEqual`'s absent≈undefined semantics for the `ticketSlug`/`view` keys, which is exactly the tolerance the codec's consumers enjoy. Correct.

## Bugs found

None found.
