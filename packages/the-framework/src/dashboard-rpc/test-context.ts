import { provideTelefuncContext } from 'telefunc'
import { registryPreferencesStore } from '../registry.js'
import { registryDiscordCredentialsStore } from '../discord-credentials-store.js'
import { defaultQuotaSource } from '../dashboard/quota.js'
import type { DashboardContext } from '../dashboard/telefunc-serve.js'

/**
 * Provide the Telefunc request context a telefunction runs inside, for a test that calls one
 * directly.
 *
 * There is one dashboard host and it wires every capability (D3), so a telefunction reads its
 * context as simply there — a missing field is a wiring bug, and it throws. That makes this the
 * one place a test says what the host would have wired, with only the parts it cares about
 * overridden. It used to be unnecessary: the accessors probed for optional capabilities, so a
 * call outside a request read as "a host that does not offer this", and a test asserting real
 * behaviour was indistinguishable from one asserting a degraded host.
 *
 * Telefunc drops a provided context at the next macrotask, so call it immediately before the
 * telefunction under test, not once per file.
 */
export function provideTestContext(over: Partial<DashboardContext> = {}): void {
  provideTelefuncContext({
    startRun: () => ({ ok: false, error: 'not wired in this test' }),
    addProject: () => ({ ok: false, error: 'not wired in this test' }),
    eventsSource: () => undefined,
    remote: { target: () => undefined, list: () => [] },
    preferences: registryPreferencesStore(),
    discord: registryDiscordCredentialsStore(),
    quota: defaultQuotaSource(),
    autoPm: () => undefined,
    autoPmSweep: () => {},
    ...over,
  } satisfies DashboardContext as never)
}
