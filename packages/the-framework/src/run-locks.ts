import { resolve } from 'node:path'

/**
 * Serialize everything that mutates one run's checkout.
 *
 * A run's meta flips to `done` the moment its child writes it — a beat before the daemon's
 * teardown archives the history, commits the bookkeeping to the run branch, and retires the
 * worktree. Every run-addressed action a user can fire off that fresh `done` (Push / Open PR's
 * commit step, Remove/Delete of the checkout, a Resume that reuses it) used to run its own git
 * against the same checkout teardown was committing in: the loser reported "could not commit the
 * work this session left uncommitted", and a teardown that lost kept a worktree it should have
 * removed. Both actors live in the daemon process by design (the dashboard's RPCs are served
 * in-process, and only the daemon writes to the project checkout), so an in-process lock is the
 * whole fix — there is no second process to coordinate with.
 *
 * Keyed by the checkout path, resolved: teardown and the actions all name the same worktree, so
 * they contend on one key; actions against a run whose worktree is already gone key on the
 * project root, where nothing contends. A waiter chains on the predecessor's *settlement* — a
 * failed teardown must not skip the push waiting behind it — and each caller still gets its own
 * outcome (or failure) back untouched.
 */
const chains = new Map<string, Promise<unknown>>()

/** Run `fn` once every earlier holder of `checkout`'s lock has settled. */
export async function withRunLock<T>(checkout: string, fn: () => Promise<T>): Promise<T> {
  const key = resolve(checkout)
  const prev = chains.get(key) ?? Promise.resolve()
  const run = prev.then(fn, fn)
  // What the next waiter chains on: settlement, never rejection — one failed holder must not
  // poison every later acquisition of the same key.
  const settled = run.then(
    () => {},
    () => {},
  )
  chains.set(key, settled)
  try {
    return await run
  } finally {
    if (chains.get(key) === settled) chains.delete(key)
  }
}
