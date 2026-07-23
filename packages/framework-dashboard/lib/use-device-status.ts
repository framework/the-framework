import { useMemo } from 'react'
import type { ConnectionProfile } from './profiles.js'
import { usePolled } from './use-async.js'
import { checkDevices } from '../server/devices.telefunc.js'

// The saved devices' online/offline status (#1072). The daemon holds no device token (they are a
// per-browser secret, #1052), so the browser hands it each device's {id, url, token} and the daemon
// does the cookie'd ping; this polls that on a short interval. Display-only, so nothing binds a
// control to the poll value: the status dots just read the map.

/** A saved device's reachability, or absent while the first check is still out (reads as "unknown"). */
export type DeviceStatus = 'online' | 'offline'

/** How often to re-check the saved devices. Cheap: one 3s-capped ping each, no agent involved. */
const POLL_MS = 10_000

/**
 * Poll each saved device's reachability and return an id -> status map. An id missing from the map
 * means the first check has not come back yet (draw it neutral, not offline). Prerender has no
 * daemon, so it starts empty and fills on the client.
 */
export function useDeviceStatus(profiles: ConnectionProfile[]): Record<string, DeviceStatus> {
  const targets = profiles.filter(p => p.token).map(p => ({ id: p.id, url: p.url, token: p.token }))
  // Re-poll only when the device set itself changes, not on every render (targets is a fresh array).
  const key = targets.map(t => t.id).join('|')
  const load = useMemo(
    () => (targets.length ? () => checkDevices(targets) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key],
  )
  const reachable = usePolled<Record<string, boolean>>(load, {}, POLL_MS, [key]).value
  return useMemo(() => {
    const out: Record<string, DeviceStatus> = {}
    for (const [id, ok] of Object.entries(reachable)) out[id] = ok ? 'online' : 'offline'
    return out
  }, [reachable])
}
