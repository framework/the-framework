import { readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { nodeGitRunner, type GitRunner } from './project.js'
import { cachedOpenPrFilePatches } from './dashboard/gh.js'
import { TICKETS_DIR } from './tickets.js'
import type { SpikeAssignment } from './auto-pm.js'

// The PENDING lock for concurrent spike agents (#1327).
//
// A batch of Spike & plan agents must not double-work a ticket, and the guard cannot be the
// daemon's memory: a hands-off web run's local process ends at the hand-off (#1253), another
// machine's daemon never shared this one's memory at all, and the #1313 PR-diff claims only start
// once a PR exists. So the claim is made where every agent already looks — the ticket's own
// sibling files. Before an agent starts, its `.spike.md` and `.plan.md` are created as
// placeholders reading `PENDING:<AGENT_ID>`, committed in one batch and pushed to the default
// branch. A file that exists is a spike the stock prompt skips, so the lock needs no cooperation
// from anyone who has not heard of it.
//
// The daemon writes and pushes the locks, never the agent (#1320): a cloud session has no push
// access, and a lock that only existed inside the run it protects would protect nothing.

/** The first line of a placeholder sibling: the claim, naming the agent that holds it. */
export const SPIKE_LOCK_PREFIX = 'PENDING:'

/**
 * How old a PENDING lock must be before it is presumed dead and released. Generous against the
 * slowest live path — a cloud spike that queues before it runs — because a lock released under a
 * live agent re-opens the double-work window the lock exists to close, while a dead agent's
 * ticket only waits one interval longer.
 */
export const SPIKE_LOCK_STALE_MS = 60 * 60 * 1000

/** Whether a sibling's content is a PENDING placeholder rather than a real spike or plan. */
export function isSpikeLock(md: string): boolean {
  return md.trimStart().startsWith(SPIKE_LOCK_PREFIX)
}

/** What a lock file holds: the claim line and nothing else, so the check above stays trivial. */
export function spikeLockContent(agentId: string): string {
  return `${SPIKE_LOCK_PREFIX}${agentId}\n`
}

/** The commit a batch of locks lands as. Names the count so the history reads as what happened. */
export function lockMessage(count: number): string {
  return `[The Framework] lock ${count} ticket${count === 1 ? '' : 's'} for concurrent spike agents`
}

/** The commit a release lands as. */
export function releaseMessage(count: number): string {
  return `[The Framework] release ${count} stale spike lock${count === 1 ? '' : 's'}`
}

/** Injectable seams so both operations are unit-testable off disk, git, and GitHub. */
export interface SpikeLockDeps {
  git?: GitRunner
  /** Write one lock file (default `fs.writeFile`). */
  write?: (path: string, content: string) => Promise<void>
  /** Read one sibling (default `fs.readFile`); a rejection reads as "not a lock". */
  read?: (path: string) => Promise<string>
  /** Delete one lock file (default `fs.rm`). */
  remove?: (path: string) => Promise<void>
  /** List `tickets/` (default `fs.readdir`); a rejection reads as an empty directory. */
  list?: (dir: string) => Promise<string[]>
  /**
   * Whether any open PR touches `file` (#1313's read, reused): a finished agent's PR carries the
   * real sibling, so an open one keeps the lock however old it is. `undefined` means the answer
   * could not be read, which also keeps the lock — releasing on a `gh` hiccup would re-open the
   * double-work window over a network blip.
   */
  prTouches?: (cwd: string, file: string) => Promise<boolean | undefined>
  /** Clock, injectable for tests. */
  now?: () => number
  /** Override {@link SPIKE_LOCK_STALE_MS}. */
  staleMs?: number
  /** Progress line. */
  log?: (message: string) => void
}

const defaultPrTouches = async (cwd: string, file: string): Promise<boolean | undefined> => {
  const { value } = await cachedOpenPrFilePatches(cwd, file)
  return value === undefined ? undefined : value.length > 0
}

/** A ticket filename's lock paths, relative to the repo root. */
function lockPaths(ticket: string): { spike: string; plan: string } {
  const stem = ticket.replace(/\.md$/, '')
  return {
    spike: `${TICKETS_DIR}/${stem}.spike.md`,
    plan: `${TICKETS_DIR}/${stem}.plan.md`,
  }
}

/**
 * Claim `assignments`' tickets for their agents: write both placeholder siblings per ticket,
 * commit the whole batch in one pathspec-scoped commit, and push it to the branch the checkout is
 * on. Resolves the subset actually locked — a ticket whose sibling appeared since the candidates
 * were enumerated is skipped, not overwritten: an existing file is someone's claim or someone's
 * work, and either outranks this batch.
 *
 * A batch whose commit failed is rolled back (the written files removed) and resolves `[]`:
 * uncommitted placeholders in the user's checkout would be noise git blames on nobody. A batch
 * whose *push* failed is kept and resolved as locked — the commit still guards every run forked
 * from this checkout, which is the common case, and the sweep should not stand a healthy local
 * fan-out down over a network blip. The push is what closes the cross-machine window (#1320), so
 * its failure is logged rather than swallowed.
 *
 * Never throws: this runs on a background tick with nothing to catch it.
 */
export async function acquireSpikeLocks(
  cwd: string,
  assignments: readonly SpikeAssignment[],
  deps: SpikeLockDeps = {},
): Promise<SpikeAssignment[]> {
  const git = deps.git ?? nodeGitRunner()
  const write = deps.write ?? ((path, content) => writeFile(path, content, 'utf8'))
  const read = deps.read ?? (path => readFile(path, 'utf8'))
  const remove = deps.remove ?? (path => rm(path))
  const log = deps.log ?? (() => {})

  const locked: SpikeAssignment[] = []
  const files: string[] = []
  try {
    for (const assignment of assignments) {
      const { spike, plan } = lockPaths(assignment.ticket)
      // Existence via a read, so one seam serves both operations. Either sibling present — real
      // or placeholder — means the ticket is not this batch's to claim.
      const taken = await Promise.all([read(join(cwd, spike)).then(() => true, () => false), read(join(cwd, plan)).then(() => true, () => false)])
      if (taken.some(Boolean)) continue
      await write(join(cwd, spike), spikeLockContent(assignment.agentId))
      await write(join(cwd, plan), spikeLockContent(assignment.agentId))
      locked.push(assignment)
      files.push(spike, plan)
    }
    if (!locked.length) return []
    await git(['add', '--', ...files], cwd)
    await git(['commit', '-m', lockMessage(locked.length), '--', ...files], cwd)
  } catch {
    // The claim is the *commit*: files that never reached one claim nothing, so they are removed
    // rather than left as uncommitted noise, and the sweep falls back to a single unpinned agent.
    await Promise.all(files.map(file => remove(join(cwd, file)).catch(() => undefined)))
    return []
  }
  try {
    const branch = (await git(['rev-parse', '--abbrev-ref', 'HEAD'], cwd)).trim()
    await git(['push', 'origin', `HEAD:${branch}`], cwd)
  } catch {
    log(`[framework] spike locks: the lock commit could not be pushed, so agents on other machines cannot see these ${locked.length} claim(s)`)
  }
  return locked
}

/**
 * Release the PENDING locks whose agents are presumed dead, so a crashed spike does not brick its
 * ticket forever. A lock is stale exactly when all three hold (#1327's rule): its content is still
 * the placeholder, no open PR touches it (a finished agent's PR carries the real sibling — the
 * #1313 claim takes over from here), and its last commit is older than {@link SPIKE_LOCK_STALE_MS}.
 * An *uncommitted* placeholder is left alone: it is a batch being acquired right now, or a commit
 * failure {@link acquireSpikeLocks} already rolled back.
 *
 * Deletions land as one pathspec-scoped commit, pushed best-effort like the acquisition.
 * Resolves the released tickets' filenames. Never throws.
 */
export async function releaseStaleSpikeLocks(cwd: string, deps: SpikeLockDeps = {}): Promise<string[]> {
  const git = deps.git ?? nodeGitRunner()
  const read = deps.read ?? (path => readFile(path, 'utf8'))
  const remove = deps.remove ?? (path => rm(path))
  const list = deps.list ?? (dir => readdir(dir))
  const prTouches = deps.prTouches ?? defaultPrTouches
  const now = deps.now ?? (() => Date.now())
  const staleMs = deps.staleMs ?? SPIKE_LOCK_STALE_MS
  const log = deps.log ?? (() => {})

  try {
    const names = await list(join(cwd, TICKETS_DIR)).catch(() => [] as string[])
    const released: string[] = []
    const files: string[] = []
    for (const name of names) {
      if (!/\.spike\.md$/.test(name)) continue
      const ticket = `${name.replace(/\.spike\.md$/, '')}.md`
      const { spike, plan } = lockPaths(ticket)
      const [spikeMd, planMd] = await Promise.all([
        read(join(cwd, spike)).catch(() => undefined),
        read(join(cwd, plan)).catch(() => undefined),
      ])
      const pending = [
        ...(spikeMd !== undefined && isSpikeLock(spikeMd) ? [spike] : []),
        ...(planMd !== undefined && isSpikeLock(planMd) ? [plan] : []),
      ]
      if (!pending.length) continue
      // The newest lock commit is the claim's age. An empty answer is an uncommitted placeholder:
      // a batch mid-acquisition, which is the opposite of stale.
      const stamps = await Promise.all(
        pending.map(file => git(['log', '-1', '--format=%ct', '--', file], cwd).then(out => out.trim(), () => '')),
      )
      if (stamps.some(stamp => !stamp)) continue
      const newest = Math.max(...stamps.map(stamp => Number(stamp) * 1000))
      if (!Number.isFinite(newest) || now() - newest < staleMs) continue
      // Asked last because it is the expensive read, and only about the pending files: a stem
      // whose real spike rode in on a PR while the plan stayed PENDING keeps the plan too.
      const touched = await Promise.all(pending.map(file => prTouches(cwd, file)))
      if (touched.some(t => t !== false)) continue
      for (const file of pending) await remove(join(cwd, file))
      files.push(...pending)
      released.push(ticket)
    }
    if (!released.length) return []
    await git(['add', '--', ...files], cwd)
    await git(['commit', '-m', releaseMessage(files.length), '--', ...files], cwd)
    try {
      const branch = (await git(['rev-parse', '--abbrev-ref', 'HEAD'], cwd)).trim()
      await git(['push', 'origin', `HEAD:${branch}`], cwd)
    } catch {
      log(`[framework] spike locks: the release commit could not be pushed`)
    }
    log(`[framework] spike locks: released ${released.length} stale lock(s): ${released.join(', ')}`)
    return released
  } catch {
    return []
  }
}
