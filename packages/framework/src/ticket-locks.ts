import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { TICKETS_DIR } from './tickets.js'
import { withDataBranch } from './data-branch.js'
import type { PlanAssignment } from './auto-pm.js'

// The `.lock.md` claim on a ticket (#1420, replacing #1327's PENDING placeholders).
//
// A ticket is assigned to a single agent — for planning today, and in Rom's design for its whole
// life, implementation included — and the guard cannot be the daemon's memory: a hands-off web
// run's local process ends at the hand-off (#1253), another machine's daemon never shared this
// one's memory at all, and the #1313 PR-diff claims only start once a PR exists. So the claim is
// made where every agent already looks — a `tickets/<STEM>.lock.md` sibling holding
// `CLAIMED: <AGENT_ID>`, the file the ticketing format defines (#1420), so the stock prompts skip
// a locked ticket with no cooperation from anyone who has not heard of this module.
//
// Since #1582 the tickets live on the data branch, and a lock is one more data write through the
// same funnel: `withDataBranch` syncs, commits the batch, and pushes the branch itself. That
// retires this module's own commit/push machinery — locks reach every machine the way all data
// does, and the old "the checkout must be on the default branch" dance is gone with the reason
// for it.
//
// There is no timed release (#1420 dropped #1327's 6-hour staleness rule): a coordinator agent
// can legitimately hold a ticket for days, and a lock released under a live agent re-opens the
// exact double-work window it exists to close. The lock lifts when the ticket's work lands and
// the tickets sync retires the files, when a human releases it ({@link releaseTicketLock}), or
// when the daemon frees a claim it minted for an agent that settled with nothing to hand off
// (the `heldBy` release, #1583) — every other dead agent is still the user's to notice, with the
// dashboard button as the tool.

/** The first line of a lock file: the claim, naming the agent that holds it. */
const TICKET_LOCK_PREFIX = 'CLAIMED:'

/** A ticket filename's lock sibling, e.g. `a.md` → `a.lock.md`, without the directory. */
export function ticketLockName(ticket: string): string {
  return `${ticket.replace(/\.md$/, '')}.lock.md`
}

/** What a lock file holds: the claim line and nothing else, matching the ticketing format. */
export function ticketLockContent(agentId: string): string {
  return `${TICKET_LOCK_PREFIX} ${agentId}\n`
}

/** The agent a lock file names, or undefined for content that is not a claim line. */
export function ticketLockHolder(md: string): string | undefined {
  const line = md.trimStart()
  if (!line.startsWith(TICKET_LOCK_PREFIX)) return undefined
  const holder = line.slice(TICKET_LOCK_PREFIX.length).split('\n', 1)[0]!.trim()
  return holder || undefined
}

/** The commit a batch of locks lands as. Names the count so the history reads as what happened. */
export function lockMessage(count: number): string {
  return `[The Framework] lock ${count} ticket${count === 1 ? '' : 's'} for concurrent agents`
}

/** The commit a manual release lands as, naming the ticket freed. */
export function releaseMessage(ticket: string): string {
  return `[The Framework] release the lock on ${ticket}`
}

/** The commit an abandoned claim's release lands as (#1583), naming why the daemon freed it. */
export function abandonedReleaseMessage(ticket: string): string {
  return `${releaseMessage(ticket)} — its agent ended with nothing to hand off`
}

/** Injectable seams so every operation is unit-testable off disk and git. */
export interface TicketLockDeps {
  /** Write one lock file (default `fs.writeFile`). */
  write?: (path: string, content: string) => Promise<void>
  /** Read one sibling (default `fs.readFile`); a rejection reads as "absent". */
  read?: (path: string) => Promise<string>
  /** Delete one lock file (default `fs.rm`). */
  remove?: (path: string) => Promise<void>
  /** The data-branch write funnel (default {@link withDataBranch}); a test's fake stands in. */
  funnel?: typeof withDataBranch
  /** Progress line. */
  log?: (message: string) => void
}

/**
 * Which side of a ticket's life a batch claims for (#1420). A `plan` batch is about to *write*
 * plans, so an existing `.plan.md` means the work it came for is already done and the ticket is
 * skipped. A `drain` batch is about to *implement* a plan — the `.plan.md` is its input, not a
 * competing claim — so only an existing `.lock.md` stands in its way.
 */
export type TicketLockPhase = 'plan' | 'drain'

/**
 * Claim `assignments`' tickets for their agents: one `.lock.md` per ticket, written on the data
 * branch in one funneled cycle (#1582) — the funnel commits the batch and pushes the branch. The
 * cycle re-runs the checks against origin's state when a push loses a race, so a ticket whose
 * lock (or, for a `plan` batch, whose plan — see {@link TicketLockPhase}) appeared meanwhile is
 * skipped, not overwritten: an existing file is someone's claim or someone's work, and either
 * outranks this batch.
 *
 * Resolves the subset actually locked. A batch that could not land at all resolves `[]`; a batch
 * that committed but could not *push* is kept and resolved as locked — the commit still guards
 * every agent forked from this machine, which is the common case, and the sweep should not stand
 * a healthy local fan-out down over a network blip. The push is what closes the cross-machine
 * window (#1320), so its failure is logged rather than swallowed.
 *
 * Never throws: this runs on a background tick with nothing to catch it.
 */
export async function acquireTicketLocks(
  cwd: string,
  assignments: readonly PlanAssignment[],
  deps: TicketLockDeps = {},
  phase: TicketLockPhase = 'plan',
): Promise<PlanAssignment[]> {
  // Creating parents, because `tickets/` itself is not a given: retiring the last ticket removes
  // the directory (git keeps no empty dirs), and the branch is born without it.
  const write =
    deps.write ??
    (async (path: string, content: string) => {
      await mkdir(dirname(path), { recursive: true })
      await writeFile(path, content, 'utf8')
    })
  const read = deps.read ?? (path => readFile(path, 'utf8'))
  const funnel = deps.funnel ?? withDataBranch
  const log = deps.log ?? (() => {})

  let locked: PlanAssignment[] = []
  const result = await funnel(
    cwd,
    () => lockMessage(locked.length),
    async dataDir => {
      locked = []
      for (const assignment of assignments) {
        const stem = assignment.ticket.replace(/\.md$/, '')
        const lock = `${TICKETS_DIR}/${stem}.lock.md`
        const plan = `${TICKETS_DIR}/${stem}.plan.md`
        // Any existing lock file outranks this batch — except one naming THIS agent, which is
        // the batch's own claim seen again on a re-run (the funnel re-runs the op when a push
        // loses a race, and the first attempt's commit survives the re-sync): still locked.
        const existing = await read(join(dataDir, lock)).then(md => ({ md }), () => undefined)
        if (existing) {
          if (ticketLockHolder(existing.md) === assignment.agentId) locked.push(assignment)
          continue
        }
        if (phase === 'plan' && (await read(join(dataDir, plan)).then(() => true, () => false))) continue
        await write(join(dataDir, lock), ticketLockContent(assignment.agentId))
        locked.push(assignment)
      }
    },
    { log },
  )
  if (!result.ok && !result.committed) {
    // Said even for an empty batch: a cycle that failed before any lock landed is the sweep's
    // real stand-down reason, and swallowing it left "no claims" indistinguishable from "lost
    // every race".
    log(`[framework] ticket locks: the batch could not be committed (${result.error})`)
    return []
  }
  if (!result.ok)
    log(`[framework] ticket locks: the lock commit could not be pushed, so agents on other machines cannot see these ${locked.length} claim(s)`)
  return locked
}

/**
 * What a release did: freed the ticket, found nothing to free, found someone else's claim
 * (`heldBy` releases only, #1583), or could not commit.
 */
export type ReleaseTicketLockResult = 'released' | 'no-lock' | 'not-holder' | 'error'

/**
 * Free one ticket's `.lock.md` by hand (#1420): the dashboard's answer to a dead agent, now that
 * no timer releases locks. One funneled data-branch cycle (#1582); a release that cannot land
 * reports `error` and changes nothing — the funnel restores the checkout, so the committed state
 * keeps telling the truth about the claim.
 */
export async function releaseTicketLock(
  cwd: string,
  ticket: string,
  deps: TicketLockDeps = {},
  opts: {
    /**
     * Free the lock only while it still names this exact agent (#1583): the daemon releasing a
     * claim it minted for an agent that ended with nothing to hand off. A lock naming anyone
     * else is someone's live claim — re-locked after a manual release, say — and outranks the
     * cleanup. Absent (the dashboard button), whoever holds the lock is released.
     */
    heldBy?: string
  } = {},
): Promise<ReleaseTicketLockResult> {
  const read = deps.read ?? (path => readFile(path, 'utf8'))
  const remove = deps.remove ?? (path => rm(path))
  const funnel = deps.funnel ?? withDataBranch
  const log = deps.log ?? (() => {})

  const lock = `${TICKETS_DIR}/${ticketLockName(ticket)}`
  let outcome: ReleaseTicketLockResult = 'released'
  const result = await funnel(
    cwd,
    () => (opts.heldBy !== undefined ? abandonedReleaseMessage(ticket) : releaseMessage(ticket)),
    async dataDir => {
      outcome = 'released'
      const md = await read(join(dataDir, lock)).catch(() => undefined)
      if (md === undefined) {
        outcome = 'no-lock'
        return
      }
      if (opts.heldBy !== undefined && ticketLockHolder(md) !== opts.heldBy) {
        outcome = 'not-holder'
        return
      }
      await remove(join(dataDir, lock))
    },
    { log },
  )
  if (!result.ok && !result.committed) return 'error'
  if (!result.ok) log(`[framework] ticket locks: the release of ${ticket} could not be pushed`)
  return outcome
}
