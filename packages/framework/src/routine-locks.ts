import { hostname } from 'node:os'
import { join } from 'node:path'
import { nodeBranchFileFs, withFileBranch, type BranchFileFs, type CommitMessage, type FileBranchWrite } from '@gemstack/agent-data'
import { LOGS_BRANCH } from './framework-dir.js'

// The "one triage at a time" guard (#1659): a `routines/<name>.lock.md` on the logs branch.
//
// The pinned branch (#1293) was this guard before, and stopped being one: since #1644 a triage
// commits nothing on its branch, so the branch never reaches origin and guards nothing across
// machines, and locally it was a name the *agent* checked from its prompt — every false abort
// spent a started agent. The lock is the ticket claim (#1420) applied to a routine: minted by the
// sweep through the logs branch's write funnel before the run starts, so the daemon decides and no
// agent is started to find out, and read by every machine that shares `agents-logs`.
//
// Release is the daemon's, not a PR's: a triage never opens one. The daemon that minted a lock
// drops it when the run ends, whatever the ending, and on boot for any it holds whose run is
// gone — so a crash on this machine frees the routine at once. A lock another machine left
// behind counts as dead after {@link ROUTINE_LOCK_TTL_MS}, fixed: a triage over hundreds of
// tickets can take hours, and a heartbeat would cost code and `agents-logs` churn.

/** Where routine state lives on the logs branch; only the lock files, for now (#1660). */
const ROUTINES_DIR = 'routines'

/** How long a lock stands before whoever finds it may take it over: four hours, no heartbeat. */
export const ROUTINE_LOCK_TTL_MS = 4 * 60 * 60 * 1000

/** The lock file for a routine, relative to the logs branch root: `routines/triage-quick.lock.md`. */
export function routineLockPath(name: string): string {
  return `${ROUTINES_DIR}/${name}.lock.md`
}

/** Who holds a lock: the machine that minted it, and when. */
export interface RoutineLockHolder {
  host: string
  /** ISO timestamp. */
  since: string
}

/** What a lock file holds: the claiming machine and the mint time, one line each. */
export function routineLockContent(holder: RoutineLockHolder): string {
  return `CLAIMED: ${holder.host}\nSINCE: ${holder.since}\n`
}

/** The holder a lock file names, or undefined for content that is not a lock. */
export function routineLockHolder(md: string): RoutineLockHolder | undefined {
  const host = /^CLAIMED:[ \t]*(.+)$/m.exec(md)?.[1]?.trim()
  const since = /^SINCE:[ \t]*(.+)$/m.exec(md)?.[1]?.trim()
  return host && since ? { host, since } : undefined
}

/** Injectable seams so every operation is unit-testable off disk and git. */
export interface RoutineLockDeps extends Partial<BranchFileFs> {
  /** The logs branch's write funnel (default the persistent checkout's cycle); a test's fake stands in. */
  funnel?: (root: string, message: CommitMessage, op: (dir: string) => Promise<void>) => Promise<FileBranchWrite>
  log?: (message: string) => void
  /** The machine claiming the lock (default this host's name). */
  host?: string
  now?: () => number
}

function resolve(deps: RoutineLockDeps) {
  const fs = nodeBranchFileFs()
  return {
    read: deps.read ?? fs.read,
    write: deps.write ?? fs.write,
    remove: deps.remove ?? fs.remove,
    list: deps.list ?? fs.list,
    funnel: deps.funnel ?? ((root: string, message: CommitMessage, op: (dir: string) => Promise<void>) => withFileBranch(root, LOGS_BRANCH, message, op)),
    log: deps.log ?? (() => {}),
    host: deps.host ?? hostname(),
    now: deps.now ?? (() => Date.now()),
  }
}

/** Whether a lock is past its fixed expiry, as of `now`. An unparseable mint time counts as expired. */
function routineLockExpired(holder: RoutineLockHolder, now: number): boolean {
  const since = Date.parse(holder.since)
  return !Number.isFinite(since) || now - since >= ROUTINE_LOCK_TTL_MS
}

/** What acquiring did: ours now, or standing down with the holder named, or the write failed. */
export type AcquireRoutineLockResult =
  | { ok: true }
  | { ok: false; reason: string }

/**
 * Take the lock for `name` on the logs branch, in one funneled cycle. An alive lock stands the
 * caller down naming its holder; an expired one is taken over in the same commit. The funnel
 * re-runs the op when a push loses a race, so a lock another machine minted meanwhile is found,
 * not overwritten — and this machine's own lock seen again on the re-run is still ours.
 *
 * Never throws: this runs on a background tick with nothing to catch it.
 */
export async function acquireRoutineLock(cwd: string, name: string, deps: RoutineLockDeps = {}): Promise<AcquireRoutineLockResult> {
  const r = resolve(deps)
  const mine: RoutineLockHolder = { host: r.host, since: new Date(r.now()).toISOString() }
  let held: RoutineLockHolder | undefined
  const result = await r.funnel(
    cwd,
    `[The Framework] lock the ${name} routine`,
    async dataDir => {
      held = undefined
      const path = join(dataDir, routineLockPath(name))
      const holder = routineLockHolder(await r.read(path).catch(() => ''))
      // This call's own claim, seen again when the funnel re-runs the op: still ours. Any other
      // alive lock — another machine's, or this machine's from a run still going — stands us down.
      if (holder?.host === mine.host && holder.since === mine.since) return
      if (holder && !routineLockExpired(holder, r.now())) {
        held = holder
        return
      }
      await r.write(path, routineLockContent(mine))
    },
  )
  if (held) return { ok: false, reason: `${name} is already running on ${held.host} (since ${held.since})` }
  if (!result.ok && !result.committed) return { ok: false, reason: `the ${name} lock could not be committed (${result.error})` }
  if (!result.ok) r.log(`[framework] routine locks: the ${name} lock could not be pushed, so other machines cannot see it`)
  return { ok: true }
}

/**
 * Drop this machine's lock on `name`; a lock naming another machine is left alone. `true` when
 * the lock is dealt with (freed, absent, or someone else's), `false` when the release could not
 * commit, so the caller can retry.
 */
export async function releaseRoutineLock(cwd: string, name: string, deps: RoutineLockDeps = {}): Promise<boolean> {
  const r = resolve(deps)
  const result = await r.funnel(
    cwd,
    `[The Framework] release the ${name} routine`,
    async dataDir => {
      const path = join(dataDir, routineLockPath(name))
      if (routineLockHolder(await r.read(path).catch(() => ''))?.host === r.host) await r.remove(path)
    },
  )
  return result.ok || result.committed
}

/**
 * On boot (#1659): drop every lock this machine holds whose run is gone. The daemon that minted
 * them is not the one booting, so nothing in memory will release them; `stillRunning` says
 * whether a run of this machine's started since the lock was minted is still going.
 */
export async function releaseDeadRoutineLocks(
  cwd: string,
  stillRunning: (since: string) => boolean,
  deps: RoutineLockDeps = {},
): Promise<string[]> {
  const r = resolve(deps)
  let released: string[] = []
  const result = await r.funnel(
    cwd,
    () => `[The Framework] release ${released.length} routine lock${released.length === 1 ? '' : 's'} left by a previous daemon`,
    async dataDir => {
      released = []
      for (const file of await r.list(join(dataDir, ROUTINES_DIR))) {
        const name = /^(.+)\.lock\.md$/.exec(file)?.[1]
        if (!name) continue
        const holder = routineLockHolder(await r.read(join(dataDir, ROUTINES_DIR, file)).catch(() => ''))
        if (holder?.host !== r.host || stillRunning(holder.since)) continue
        await r.remove(join(dataDir, ROUTINES_DIR, file))
        released.push(name)
      }
    },
  )
  return result.ok || result.committed ? released : []
}
