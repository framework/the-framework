import { stat } from 'node:fs/promises'
import { join } from 'node:path'
import type { GitRunner } from './project.js'

/**
 * The safety commit (#1638): before the framework does something to a checkout that could lose
 * what is sitting in it, it commits everything pending under one fixed message. Two callers:
 * activation, so the install commit lands on a clean tree, and the teardown of an agent's
 * worktree, so the diff the checkout held outlives the checkout.
 *
 * It runs unattended, and it used to add whatever it found: 7,632 turborepo cache files went to
 * main that way, and nobody noticed for four days. So it now refuses an implausible sweep — far
 * more than a session leaves behind — and reports what it saw instead of committing it. That is
 * a property of the situation, not of any one tool, so it needs no list of cache directories to
 * keep current.
 */
export const SAFETY_COMMIT_MESSAGE = '[The Framework] uncommitted changes'

/** Past either, the sweep is refused. A real session leaves a handful of files; the incident was 7,632 and 262 MB. */
export const SAFETY_COMMIT_LIMITS = { files: 200, bytes: 20 * 1024 * 1024 }

export interface SafetyCommitLimits {
  files: number
  bytes: number
}

/** What is pending in a checkout: every file `git add -A` would stage. */
export interface PendingWork {
  files: number
  /** Total size of the pending files still on disk (a deleted file weighs nothing). */
  bytes: number
  /** Pending files per top-level directory (`''` for the repository root), most first. */
  byTopDir: [string, number][]
}

/** Thrown by {@link safetyCommit} when the sweep is refused. The message is the report. */
export class SafetyCommitRefused extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SafetyCommitRefused'
  }
}

/**
 * The paths in `git status --porcelain -uall -z` output. `-uall` lists every untracked file
 * rather than collapsing a directory to one entry (`?? .turbo/` is one line for 7,632 files),
 * and `-z` gives raw NUL-separated paths, unquoted. A rename or copy carries the original path as
 * an extra entry after the new one; it is skipped.
 */
export function parsePendingPaths(porcelainZ: string): string[] {
  const entries = porcelainZ.split('\0')
  const paths: string[] = []
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i] ?? ''
    if (entry.length < 4) continue
    paths.push(entry.slice(3))
    const status = entry.slice(0, 2)
    if (status.includes('R') || status.includes('C')) i++
  }
  return paths
}

/** The size of the file at `path`, or 0 when it is not there (deleted, or a broken link). */
const sizeOnDisk = async (path: string): Promise<number> => stat(path).then(s => s.size).catch(() => 0)

/**
 * What `git add -A` would stage in `cwd`. Sizes are read only while the file count is within its
 * limit: past it the sweep is refused on the count alone, and a checkout with thousands of
 * pending files is exactly where thousands of size reads would cost.
 */
export async function pendingWork(
  git: GitRunner,
  cwd: string,
  limits: SafetyCommitLimits = SAFETY_COMMIT_LIMITS,
  size: (path: string) => Promise<number> = sizeOnDisk,
): Promise<PendingWork> {
  const paths = parsePendingPaths(await git(['status', '--porcelain', '-uall', '-z'], cwd))
  const counts = new Map<string, number>()
  for (const path of paths) {
    const top = path.includes('/') ? path.slice(0, path.indexOf('/')) : ''
    counts.set(top, (counts.get(top) ?? 0) + 1)
  }
  let bytes = 0
  if (paths.length <= limits.files) for (const path of paths) bytes += await size(join(cwd, path))
  return { files: paths.length, bytes, byTopDir: [...counts].sort((a, b) => b[1] - a[1]) }
}

const formatBytes = (bytes: number): string =>
  bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(bytes >= 10 * 1024 * 1024 ? 0 : 1)} MB` : `${Math.ceil(bytes / 1024)} KB`

const count = (n: number): string => n.toLocaleString('en-US')

/**
 * The refusal for pending work past a limit, or undefined when it is within both. The report
 * says how much was seen and where most of it sits, so the reader knows what to commit or ignore.
 */
export function sweepRefusal(work: PendingWork, limits: SafetyCommitLimits = SAFETY_COMMIT_LIMITS): string | undefined {
  if (work.files <= limits.files && work.bytes <= limits.bytes) return undefined
  const where = work.byTopDir
    .slice(0, 3)
    .map(([dir, n]) => `${dir ? `${dir}/` : 'the repository root'} (${count(n)} ${n === 1 ? 'file' : 'files'})`)
    .join(', ')
  const measure = work.files > limits.files ? `${count(work.files)} pending files` : `${count(work.files)} pending files, ${formatBytes(work.bytes)}`
  return `refused to commit ${measure} as "${SAFETY_COMMIT_MESSAGE}": far more than a session leaves behind (the limit is ${count(limits.files)} files or ${formatBytes(limits.bytes)}), mostly under ${where}. Commit or ignore them yourself, then retry.`
}

/**
 * Commit everything pending in `cwd` under the safety-commit message. `'clean'` when there was
 * nothing to commit, `'committed'` otherwise; throws {@link SafetyCommitRefused} — commits nothing —
 * when the pending work is past a limit.
 */
export async function safetyCommit(
  git: GitRunner,
  cwd: string,
  opts: { limits?: SafetyCommitLimits; size?: (path: string) => Promise<number> } = {},
): Promise<'clean' | 'committed'> {
  const limits = opts.limits ?? SAFETY_COMMIT_LIMITS
  const work = await pendingWork(git, cwd, limits, opts.size)
  if (work.files === 0) return 'clean'
  const refusal = sweepRefusal(work, limits)
  if (refusal) throw new SafetyCommitRefused(refusal)
  await git(['add', '-A'], cwd)
  await git(['commit', '-m', SAFETY_COMMIT_MESSAGE], cwd)
  return 'committed'
}
