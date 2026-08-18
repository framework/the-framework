import { readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { nodeGitRunner, type GitRunner } from './project.js'
import { TICKETS_DIR } from './tickets.js'
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
// The daemon writes and pushes the locks, never the agent (#1320): an agent pushes at the *end*
// of its session, onto its own branch, and a lock protects nothing unless it is on the default
// branch — the branch runs fork from — *before* work starts. (Cloud sessions cannot push at all.)
//
// There is no timed release (#1420 dropped #1327's 6-hour staleness rule): a coordinator agent
// can legitimately hold a ticket for days, and a lock released under a live agent re-opens the
// exact double-work window it exists to close. The lock lifts when the agent's own PR deletes the
// file alongside the plan it lands, or when a human releases it ({@link releaseTicketLock}) —
// watching for dead agents is the user's job, with the dashboard button as the tool.

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

/** Injectable seams so every operation is unit-testable off disk and git. */
export interface TicketLockDeps {
  git?: GitRunner
  /** Write one lock file (default `fs.writeFile`). */
  write?: (path: string, content: string) => Promise<void>
  /** Read one sibling (default `fs.readFile`); a rejection reads as "absent". */
  read?: (path: string) => Promise<string>
  /** Delete one lock file (default `fs.rm`). */
  remove?: (path: string) => Promise<void>
  /** Progress line. */
  log?: (message: string) => void
}

/**
 * Push the just-made lock commit to origin's default branch — the branch other machines fork
 * from, the only place a lock closes the cross-machine window (#1320, #1364 review). Pushed only
 * when the checkout is *on* that branch: `HEAD:main` from anywhere else would carry the branch's
 * own commits onto main, and the old `HEAD:<current branch>` published whatever branch the
 * checkout happened to be on. Resolves false when the push was skipped for that reason; a failed
 * push still throws, so each caller keeps its own log line.
 */
async function pushLockCommit(git: GitRunner, cwd: string): Promise<boolean> {
  const current = (await git(['rev-parse', '--abbrev-ref', 'HEAD'], cwd)).trim()
  // `origin/main` in almost every checkout; asked rather than assumed, with the assumption as
  // the fallback for a clone whose origin/HEAD was never set.
  const head = await git(['symbolic-ref', '--short', 'refs/remotes/origin/HEAD'], cwd).then(out => out.trim(), () => 'origin/main')
  const target = head.replace(/^origin\//, '')
  if (current !== target) return false
  await git(['push', 'origin', `HEAD:${target}`], cwd)
  return true
}

/**
 * Which side of a ticket's life a batch claims for (#1420). A `plan` batch is about to *write*
 * plans, so an existing `.plan.md` means the work it came for is already done and the ticket is
 * skipped. A `drain` batch is about to *implement* a plan — the `.plan.md` is its input, not a
 * competing claim — so only an existing `.lock.md` stands in its way.
 */
export type TicketLockPhase = 'plan' | 'drain'

/**
 * Claim `assignments`' tickets for their agents: write one `.lock.md` per ticket, commit the
 * whole batch in one pathspec-scoped commit, and push it to origin's default branch
 * ({@link pushLockCommit}). Resolves the subset actually locked — a ticket whose lock (or, for a
 * `plan` batch, whose plan — see {@link TicketLockPhase}) appeared since the candidates were
 * enumerated is skipped, not overwritten: an existing file is someone's claim or someone's work,
 * and either outranks this batch.
 *
 * A batch whose commit failed is rolled back (the written files removed) and resolves `[]`:
 * uncommitted locks in the user's checkout would be noise git blames on nobody. A batch whose
 * *push* failed is kept and resolved as locked — the commit still guards every agent forked from
 * this checkout, which is the common case, and the sweep should not stand a healthy local
 * fan-out down over a network blip. The push is what closes the cross-machine window (#1320), so
 * its failure is logged rather than swallowed.
 *
 * Never throws: this runs on a background tick with nothing to catch it.
 */
export async function acquireTicketLocks(
  cwd: string,
  assignments: readonly PlanAssignment[],
  deps: TicketLockDeps = {},
  phase: TicketLockPhase = 'plan',
): Promise<PlanAssignment[]> {
  const git = deps.git ?? nodeGitRunner()
  const write = deps.write ?? ((path, content) => writeFile(path, content, 'utf8'))
  const read = deps.read ?? (path => readFile(path, 'utf8'))
  const remove = deps.remove ?? (path => rm(path))
  const log = deps.log ?? (() => {})

  const locked: PlanAssignment[] = []
  const files: string[] = []
  try {
    for (const assignment of assignments) {
      const stem = assignment.ticket.replace(/\.md$/, '')
      const lock = `${TICKETS_DIR}/${stem}.lock.md`
      const plan = `${TICKETS_DIR}/${stem}.plan.md`
      // Existence via a read, so one seam serves every operation. A lock is someone's claim; a
      // plan is someone's finished work — for a `plan` batch either means the ticket is not this
      // batch's to claim, while a `drain` batch reads the plan as its input ({@link TicketLockPhase}).
      const siblings = phase === 'plan' ? [lock, plan] : [lock]
      const taken = await Promise.all(siblings.map(file => read(join(cwd, file)).then(() => true, () => false)))
      if (taken.some(Boolean)) continue
      await write(join(cwd, lock), ticketLockContent(assignment.agentId))
      locked.push(assignment)
      files.push(lock)
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
    if (!(await pushLockCommit(git, cwd)))
      log(`[framework] ticket locks: the checkout is not on the default branch, so the lock commit was not pushed — agents on other machines cannot see these ${locked.length} claim(s)`)
  } catch {
    log(`[framework] ticket locks: the lock commit could not be pushed, so agents on other machines cannot see these ${locked.length} claim(s)`)
  }
  return locked
}

/** What a manual release did: freed the ticket, found nothing to free, or could not commit. */
export type ReleaseTicketLockResult = 'released' | 'no-lock' | 'error'

/**
 * Free one ticket's `.lock.md` by hand (#1420): the dashboard's answer to a dead agent, now that
 * no timer releases locks. Deletes the lock, commits it pathspec-scoped, and pushes best-effort
 * like the acquisition — a release other machines cannot see would leave the ticket claimed
 * everywhere the claim actually matters.
 *
 * A failed commit puts the file back: the lock's protection is the committed state, and a
 * deletion that never landed would make the checkout lie about it. Never throws.
 */
export async function releaseTicketLock(cwd: string, ticket: string, deps: TicketLockDeps = {}): Promise<ReleaseTicketLockResult> {
  const git = deps.git ?? nodeGitRunner()
  const write = deps.write ?? ((path, content) => writeFile(path, content, 'utf8'))
  const read = deps.read ?? (path => readFile(path, 'utf8'))
  const remove = deps.remove ?? (path => rm(path))
  const log = deps.log ?? (() => {})

  const lock = `${TICKETS_DIR}/${ticketLockName(ticket)}`
  const md = await read(join(cwd, lock)).catch(() => undefined)
  if (md === undefined) return 'no-lock'
  try {
    await remove(join(cwd, lock))
    await git(['add', '--', lock], cwd)
    await git(['commit', '-m', releaseMessage(ticket), '--', lock], cwd)
  } catch {
    await write(join(cwd, lock), md).catch(() => undefined)
    return 'error'
  }
  try {
    if (!(await pushLockCommit(git, cwd)))
      log(`[framework] ticket locks: the checkout is not on the default branch, so the release of ${ticket} was not pushed`)
  } catch {
    log(`[framework] ticket locks: the release of ${ticket} could not be pushed`)
  }
  return 'released'
}
