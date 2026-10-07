import type { Overview } from '../../src/index.js'
import { onOverview } from '../rpc/reads.js'
import { usePolled } from './use-async.js'

// Is an agent working right now (#875)? Cross-project on purpose: the mark answers "is the AI
// working for you", which is not "is it working on the project you happen to have selected" —
// an agent left going in another project still means it is working for you.
//
// `onOverview` is the read that already answers this (#437, `active` = every running agent across
// the registry); it was registered but had no client. The Overview page's own `onDashboard` poll
// is a superset of it, so this adds no read the daemon did not already serve.

/** Stable initial, so the poll does not churn on every render. */
const IDLE: Overview = { active: [], queueOpen: 0, recent: [] }

/** True while any project has a running agent. */
export function useWorking(): boolean {
  const { value } = usePolled<Overview>(onOverview, IDLE, 5000, [])
  return value.active.length > 0
}
