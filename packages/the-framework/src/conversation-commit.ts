import { join } from 'node:path'
import type { ProjectSummary } from './dashboard/projects.js'
import { CONVERSATIONS_DIR } from './conversations.js'
import { SESSIONS_DIR } from './store/index.js'
import { THE_FRAMEWORK_DIR } from './framework-dir.js'
import type { GitRunner } from './project.js'
import { nodeGitRunner } from './project.js'
import { errorMessage } from './error-message.js'

/**
 * Committing the conversations the daemon records (#912) into the project checkout.
 *
 * #908 made `.the-framework/conversations/<runId>.md` tracked files, and the paths that already
 * commit pick them up: a run's worktree sweeps its own on teardown (`store/worktree.ts`). The main
 * checkout has no such path — `install.ts` commits once at activation and nothing after — so a
 * conversation held there sat as a working-tree change until a human happened to commit it. That
 * is the one gap between "the chat is in Git" (#857) and "the chat reaches Git by itself".
 *
 * Two rules shape the whole module, both about writing into a repo somebody else is using.
 *
 * Path-scoped, never `git add -A`. The pathspec names the conversations directory and nothing
 * else, the way `queue-promote.ts` names the queue file, so whatever the user has in progress
 * cannot ride along in our commit. A pathspec commit also leaves their index alone: what they had
 * staged is still staged afterwards. Scoped down further at commit time to the pathspecs that
 * actually have something pending — see {@link pathspecsFor}.
 *
 * Debounced on an idle window rather than committed per turn. A chat turn is seconds apart, and a
 * commit each would bury the project's real history under transcript noise. A poll that sees the
 * same pending set twice running treats the conversation as settled and commits the batch; a burst
 * keeps resetting it. {@link ConversationCommitterOptions.maxWaitMs} caps that, so a conversation
 * that never goes idle still lands instead of being starved forever.
 *
 * Tolerates not being alone (the #605 question this waited on). One daemon per machine is the rule
 * today (#393), but the committer never assumes it: a locked index or a rebase/merge in progress
 * means somebody else is mid-operation, so it skips rather than commits into their work, and a
 * failed commit is swallowed and retried on the next window. That way #605's eventual answer about
 * who owns the chat bot does not invalidate any of this.
 */

/** The pathspec the conversations live under. Posix separators: it is a git pathspec, not a path. */
export const CONVERSATIONS_PATHSPEC = `${THE_FRAMEWORK_DIR}/${CONVERSATIONS_DIR}`

/**
 * The committed session archives (#1179), under every user's own directory.
 *
 * `:(glob)` magic so the `*` stops at a path separator — a plain pathspec wildcard matches `/` too,
 * and would reach further down `.the-framework/` than this means to.
 *
 * The trailing `/**` is load-bearing, and its absence is silent: glob magic matches the pattern
 * against each file's whole path rather than treating a directory as a prefix, so
 * `.the-framework/*​/sessions` matches no *file* and `git add` fails with "did not match any files"
 * — a committer that commits nothing, every time. Only a real repo shows this.
 */
export const SESSIONS_PATHSPEC = `:(glob)${THE_FRAMEWORK_DIR}/*/${SESSIONS_DIR}/**`

/**
 * Everything this committer is scoped to. Both are records the daemon writes into the repo and
 * nobody would think to commit by hand: the chat of a run (#908) and the run's own archived history
 * (#1179). They share one debounce because they are written by the same events and a commit each
 * would double the noise in the project's log.
 */
export const COMMITTED_PATHSPECS: readonly string[] = [CONVERSATIONS_PATHSPEC, SESSIONS_PATHSPEC]

/**
 * Which pending file belongs to which pathspec, so a pathspec with nothing under it can be left out
 * of `add`/`commit` (see {@link pathspecsFor}). Kept beside the pathspecs themselves: a predicate
 * that drifts from the pattern it mirrors would silently drop a file from every commit.
 */
const PATHSPEC_MEMBERSHIP: ReadonlyArray<readonly [pathspec: string, holds: (file: string) => boolean]> = [
  [CONVERSATIONS_PATHSPEC, file => file.startsWith(`${CONVERSATIONS_PATHSPEC}/`)],
  [SESSIONS_PATHSPEC, file => file.startsWith(`${THE_FRAMEWORK_DIR}/`) && file.includes(`/${SESSIONS_DIR}/`)],
]

/**
 * The subset of {@link COMMITTED_PATHSPECS} that `files` actually has something under.
 *
 * `git add` and `git commit` are all-or-nothing about their pathspecs: one that matches no file
 * aborts the whole command with "pathspec ... did not match any files", so passing both patterns
 * unconditionally means a project that has sessions but has never recorded a conversation — every
 * project, until its first chat — fails to commit and puts that failure in the daemon log on every
 * poll. Nothing to commit under a pattern is the ordinary state, not an error, so the pattern is
 * dropped instead.
 *
 * This covers the empty directory as well as the missing one, and the two fail in different places:
 * `git add` tolerates an existing-but-empty directory, and then `git commit` rejects it, because by
 * then the pathspec has to match a file git knows about.
 */
export function pathspecsFor(files: readonly string[]): string[] {
  return PATHSPEC_MEMBERSHIP.filter(([, holds]) => files.some(holds)).map(([pathspec]) => pathspec)
}

/** How often the committer looks for settled conversations. */
export const COMMIT_POLL_MS = 30_000

/** How long a conversation may keep changing before it is committed anyway. */
export const COMMIT_MAX_WAIT_MS = 5 * 60_000

/** What one attempt did, or why it did nothing. */
export type CommitOutcome =
  | { committed: true; files: string[] }
  | { committed: false; reason: string }

/** Whether a path exists. Injectable so the busy check is testable without real lock files. */
export type PathProbe = (path: string) => Promise<boolean>

/** A {@link PathProbe} over `fs.access`. */
export function nodePathProbe(): PathProbe {
  return async path => {
    const { access } = await import('node:fs/promises')
    return access(path).then(
      () => true,
      () => false,
    )
  }
}

/**
 * The commit message a batch writes. Names what moved, so the log line stands alone.
 *
 * Sessions are counted by run, not by file: one archived run is a `<id>.json` and a `<id>.jsonl`,
 * and "2 sessions" for a single session would be a lie told by the batch's own commit message.
 */
export function commitMessage(files: string[]): string {
  const sessionFiles = files.filter(file => file.includes(`/${SESSIONS_DIR}/`))
  const runs = new Set(sessionFiles.map(file => file.replace(/\.[^./]+$/, ''))).size
  const conversations = files.length - sessionFiles.length
  const parts: string[] = []
  if (conversations > 0) parts.push(conversations === 1 ? 'a conversation' : `${conversations} conversations`)
  if (runs > 0) parts.push(runs === 1 ? 'a session' : `${runs} sessions`)
  return `[The Framework] ${parts.join(' and ')}`
}

/**
 * The conversation files with uncommitted changes, as repo-relative paths, sorted so the result is
 * a stable fingerprint the debounce can compare across polls.
 *
 * `--porcelain` v1 is parsed rather than `--short` because its two status columns are fixed-width
 * and its paths are quoted consistently. A rename (`R  old -> new`) reports the destination, which
 * is the path we would commit. Anything unreadable — not a repo, no git — reads as no changes.
 *
 * `-uall` is load-bearing, not a detail. By default git collapses a wholly-untracked directory into
 * one entry (`?? .the-framework/conversations/`) instead of naming the files under it, which makes
 * the fingerprint identical whether one conversation is being written or ten. The debounce compares
 * fingerprints, so without this the idle window could never see a burst and would commit straight
 * through the middle of one. Only a real repo shows this; a per-file fake does not.
 */
export async function pendingConversations(cwd: string, git: GitRunner = nodeGitRunner()): Promise<string[]> {
  const out = await git(['status', '--porcelain', '-uall', '--', ...COMMITTED_PATHSPECS], cwd).catch(() => '')
  const files = new Set<string>()
  for (const line of out.split('\n')) {
    if (line.length < 4) continue
    // Columns 0-1 are the status codes, 2 is a space, the path starts at 3.
    const entry = line.slice(3)
    const arrow = entry.indexOf(' -> ')
    files.add(unquotePath(arrow === -1 ? entry : entry.slice(arrow + ' -> '.length)))
  }
  return [...files].sort()
}

/**
 * Undo git's C-style quoting of a path holding non-ASCII or special characters. Only the escapes
 * git actually emits are handled; anything else is left as written rather than mangled.
 */
function unquotePath(entry: string): string {
  if (!entry.startsWith('"') || !entry.endsWith('"')) return entry
  return entry
    .slice(1, -1)
    .replace(/\\([\\"])/g, '$1')
    .replace(/\\t/g, '\t')
    .replace(/\\n/g, '\n')
}

/** The markers that mean another git operation owns this repo right now. */
const BUSY_MARKERS: ReadonlyArray<readonly [string, string]> = [
  ['index.lock', 'another git process holds the index lock'],
  ['rebase-merge', 'a rebase is in progress'],
  ['rebase-apply', 'a rebase is in progress'],
  ['MERGE_HEAD', 'a merge is in progress'],
  ['CHERRY_PICK_HEAD', 'a cherry-pick is in progress'],
  ['REVERT_HEAD', 'a revert is in progress'],
  ['BISECT_LOG', 'a bisect is in progress'],
]

/**
 * Why the repo is in no state to be committed into, or `undefined` when it is fine.
 *
 * The git dir is resolved through git rather than assumed to be `<cwd>/.git`, so this is right in a
 * linked worktree, where `.git` is a file pointing elsewhere and the markers live in the real dir.
 */
export async function gitBusy(
  cwd: string,
  git: GitRunner = nodeGitRunner(),
  exists: PathProbe = nodePathProbe(),
): Promise<string | undefined> {
  const gitDir = await git(['rev-parse', '--absolute-git-dir'], cwd).then(
    out => out.trim(),
    () => '',
  )
  if (!gitDir) return 'not a git repository'
  for (const [name, reason] of BUSY_MARKERS) {
    if (await exists(join(gitDir, name))) return reason
  }
  return undefined
}

/** The everyday no-op outcome. Named so the poller can tell it apart from a real failure. */
const NOTHING_PENDING = 'no conversation changes'

/**
 * Stage and commit the pending conversations under `cwd`, scoped to {@link COMMITTED_PATHSPECS}.
 *
 * `add` before `commit` because a brand-new conversation is untracked, and `git commit -- <path>`
 * only knows paths git already knows. Both are pathspec-scoped, so the staging is as narrow as the
 * commit and the user's own staged work is neither swept in nor disturbed, and both are narrowed to
 * the pathspecs that have something pending ({@link pathspecsFor}) — a pathspec matching nothing is
 * a hard error to git, and "no conversation has been recorded here yet" is not an error at all.
 *
 * Never throws: this runs on a background tick with nothing to catch it.
 */
export async function commitConversations(
  cwd: string,
  git: GitRunner = nodeGitRunner(),
  exists: PathProbe = nodePathProbe(),
): Promise<CommitOutcome> {
  const busy = await gitBusy(cwd, git, exists)
  if (busy) return { committed: false, reason: busy }

  const files = await pendingConversations(cwd, git)
  if (files.length === 0) return { committed: false, reason: NOTHING_PENDING }

  // Only the pathspecs that have something pending, or git aborts on the one that matches nothing.
  // An empty result should be unreachable — `status` was scoped to these same pathspecs — but an
  // empty pathspec list means "everything", which would sweep the user's whole checkout into our
  // commit, so it reads as nothing pending rather than as a commit.
  const pathspecs = pathspecsFor(files)
  if (pathspecs.length === 0) return { committed: false, reason: NOTHING_PENDING }

  try {
    await git(['add', '--', ...pathspecs], cwd)
    await git(['commit', '-m', commitMessage(files), '--', ...pathspecs], cwd)
    return { committed: true, files }
  } catch (err) {
    return { committed: false, reason: errorMessage(err) }
  }
}

/** A running committer; call {@link ConversationCommitter.stop} to end it. */
export interface ConversationCommitter {
  stop: () => void
  /** Run one poll now. Exposed so the daemon and tests can drive it deterministically. */
  poll: () => Promise<void>
  /**
   * Commit every project's pending conversations now, skipping the idle window. For shutdown: the
   * daemon is going away, so waiting for quiet would just defer the work to the next boot. Returns
   * how many projects committed.
   */
  flush: () => Promise<number>
}

/** Options for {@link startConversationCommitter}. */
export interface ConversationCommitterOptions {
  /** The projects to sweep each poll (the daemon passes the registry, mapped to summaries). */
  projects: () => Promise<ProjectSummary[]>
  /** Poll cadence and idle window, ms. Default {@link COMMIT_POLL_MS}. */
  intervalMs?: number
  /** Commit anyway once a project has been pending this long, ms. Default {@link COMMIT_MAX_WAIT_MS}. */
  maxWaitMs?: number
  /** Injectable git (tests). */
  git?: GitRunner
  /** Injectable existence probe for the busy check (tests). */
  exists?: PathProbe
  /** Clock, injectable for the max-wait cap (tests). */
  now?: () => number
  /** Where a committed batch is announced. */
  log?: (message: string) => void
}

/**
 * One project's debounce state: the pending set the last poll saw, and when the project first went
 * dirty. `since` deliberately survives a changing fingerprint — it is what makes the max-wait cap
 * reachable, since a conversation being written to every poll would otherwise reset its own clock
 * forever and never commit.
 */
interface Pending {
  fingerprint: string
  since: number
  /** The last failure already announced, so a stuck project logs on change rather than per poll. */
  loggedReason: string | undefined
}

/**
 * Start committing settled conversations, and return the handle that stops it.
 *
 * The idle window is the poll itself: a project whose pending set is byte-identical to the previous
 * poll's has stopped being written to, so its batch is committed. Anything still moving is recorded
 * and reconsidered next time, unless it has been dirty past `maxWaitMs`, which forces it through.
 *
 * Forgiving throughout — a failed project scan, a busy repo or a rejected commit costs one window
 * and is retried, never a throw. Runs immediately, then every `intervalMs`; the timer is unref'd so
 * it never keeps the daemon alive past shutdown.
 */
export function startConversationCommitter(opts: ConversationCommitterOptions): ConversationCommitter {
  const git = opts.git ?? nodeGitRunner()
  const exists = opts.exists ?? nodePathProbe()
  const now = opts.now ?? Date.now
  const intervalMs = opts.intervalMs ?? COMMIT_POLL_MS
  const maxWaitMs = opts.maxWaitMs ?? COMMIT_MAX_WAIT_MS
  const pending = new Map<string, Pending>()
  let stopped = false
  let running = false

  const poll = async (): Promise<void> => {
    if (stopped || running) return
    running = true
    try {
      const projects = await opts.projects().catch(() => [])
      const seen = new Set<string>()
      for (const project of projects) {
        if (stopped) break
        seen.add(project.path)
        const files = await pendingConversations(project.path, git).catch((): string[] => [])
        if (files.length === 0) {
          pending.delete(project.path)
          continue
        }
        const fingerprint = files.join('\n')
        const previous = pending.get(project.path)
        const since = previous?.since ?? now()
        // Settled (nothing changed since the last poll), or dirty long enough that waiting for
        // quiet is no longer worth it.
        const settled = previous?.fingerprint === fingerprint || now() - since >= maxWaitMs
        const loggedReason = previous?.loggedReason
        if (!settled) {
          pending.set(project.path, { fingerprint, since, loggedReason })
          continue
        }
        const outcome = await commitConversations(project.path, git, exists)
        if (outcome.committed) {
          pending.delete(project.path)
          opts.log?.(`[framework] committed ${outcome.files.length} conversation(s) in ${project.name}`)
        } else {
          // A busy repo or a rejected commit keeps its place, so the next window retries it
          // rather than starting the idle count over.
          const reason = outcome.reason === NOTHING_PENDING ? undefined : outcome.reason
          // Announced on change only: this is a poll, so logging every failure would repeat the
          // same line forever while a project stays stuck.
          if (reason !== undefined && reason !== loggedReason) {
            opts.log?.(`[framework] conversation commit failed in ${project.name}: ${reason}`)
          }
          pending.set(project.path, { fingerprint, since, loggedReason: reason })
        }
      }
      // Drop state for projects that went away, so the map cannot grow without bound.
      for (const path of [...pending.keys()]) if (!seen.has(path)) pending.delete(path)
    } finally {
      running = false
    }
  }

  const flush = async (): Promise<number> => {
    let committed = 0
    for (const project of await opts.projects().catch(() => [])) {
      const outcome = await commitConversations(project.path, git, exists)
      if (outcome.committed) {
        pending.delete(project.path)
        committed++
      }
    }
    return committed
  }

  void poll()
  const timer = setInterval(() => void poll(), intervalMs)
  timer.unref?.()
  return {
    stop: () => {
      stopped = true
      clearInterval(timer)
    },
    poll,
    flush,
  }
}
