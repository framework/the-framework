import { setDashboardContext } from './context.js'
import { registryPreferencesStore } from '../registry.js'
import { registryDiscordCredentialsStore } from '../discord-credentials-store.js'
import { defaultQuotaSource } from '../dashboard/quota.js'
import type { DashboardContext } from '../dashboard/rpc-serve.js'

/**
 * Wire the dashboard's capabilities for a test that calls an RPC directly.
 *
 * There is one dashboard host and it wires every capability (D3), so an RPC reads its context as
 * simply there — a missing field is a wiring bug, and it throws. That makes this the one place a
 * test says what the host would have wired, with only the parts it cares about overridden.
 *
 * It sticks until the next call, where Telefunc's request context used to evaporate at the next
 * macrotask (F3) — so a test no longer has to call this immediately before the RPC under test.
 */
export function provideTestContext(over: Partial<DashboardContext> = {}): void {
  setDashboardContext({
    startAgent: () => ({ ok: false, error: 'not wired in this test' }),
    addProject: () => ({ ok: false, error: 'not wired in this test' }),
    eventsSource: () => undefined,
    remote: { target: () => undefined, list: () => [] },
    preferences: registryPreferencesStore(),
    discord: registryDiscordCredentialsStore(),
    quota: defaultQuotaSource(),
    autoPm: () => undefined,
    autoPmSweep: () => {},
    projectErrors: () => [],
    ...over,
  } satisfies DashboardContext)
}
