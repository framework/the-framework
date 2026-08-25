# Bug analysis: packages/framework/src/dashboard-rpc/test-context.ts

## Business logic (high-level)

Test-only wiring for the module-level dashboard context (`context.ts`): one call sets every
`DashboardContext` field (D3: all fields required, a missing one is a wiring bug that throws), with
a `Partial` override for the parts a test cares about. Because the context is process-wide and
sticky (F3), a test need not re-wire immediately before each RPC — the comment documents exactly
that.

Considerations:

- The defaults are honest inert stand-ins: `startAgent`/`addProject` answer `ok:false` (so an RPC
  that unexpectedly starts something fails visibly rather than silently), `eventsSource` answers
  undefined (fall through to disk), `remote` relays nothing (fresh object per call — no shared
  mutable state between tests), `autoPm`/`projectErrors` answer empty.
- Three defaults are *real* stores over the user's actual registry/quota
  (`registryPreferencesStore`, `registryDiscordCredentialsStore`, `defaultQuotaSource`): a test
  that exercises a preference-writing RPC without overriding these would touch the developer's
  real `~/.the-framework.json`. Survey of current callers (`reads.test.ts`,
  `relay-dispatch.test.ts`, and the other dashboard-rpc tests) shows they either only read or
  override the store, so nothing reachable mutates user state today — a latent footgun, not a bug
  (callers provably don't hit it).
- `satisfies DashboardContext` keeps the literal in lockstep with the interface: adding a required
  context field breaks this file at compile time, which is the intended failure mode.
- No teardown/reset exists; contexts intentionally leak forward between tests in one process.
  Tests that depend on an *unwired* context would be order-sensitive, but none do (unwired is
  defined as a bug by `context.ts`).

## Functions (low-level)

- `provideTestContext(over = {})` — spreads defaults then `over` into `setDashboardContext`.
  Override wins per-key (shallow) — a test overriding `remote` replaces the whole object, which is
  the only sane granularity here. Returns void. Verdict: correct.

## Bugs found

None found.
