import { createHash } from 'node:crypto'
import { join } from 'node:path'
import { DATA_BRANCH, fileBranchPath, nodeBranchFileFs, withFileBranch, type GitRunner } from '@gemstack/agent-data'
import { worktreePath } from '@gemstack/skill-branches'
import { personDir, runCardFile, RUNS_DIR } from '@gemstack/skill-logs'
import { continuationPrompt } from 'agent-driver'
import { readLiveDiary } from 'agent-runner'

/**
 * A main agent's plan: one markdown file beside its run record on the data branch, and the
 * person's approval of it. The plan is what the person reads before any subagent starts; the
 * approval is their answer to one question, which names the plan by a mark made from its text,
 * so a plan changed after it was approved is a plan not approved.
 */

/** The option the person picks to let the subagents start. */
export const APPROVE = 'Approve'

/** The plan's file name beside the run's card: named after the run, so it goes when the run is deleted. */
export function planFile(id: string): string {
  return `${id}.plan.md`
}

/** A plan's mark: the first eight hex digits of the SHA-256 of its text. */
export function planMark(text: string): string {
  return createHash('sha256').update(text).digest('hex').slice(0, 8)
}

/** The question whose answer `Approve` approves this plan, and no other text. */
export function planQuestion(text: string): string {
  return `Start the subagents on plan ${planMark(text)}?`
}

/** Where a run's plan sits in a checkout of the data branch: beside its card, else where a plan already is, else under the person the repository commits as. */
async function planPath(checkout: string, id: string, person: string): Promise<string> {
  const fs = nodeBranchFileFs()
  const runs = join(checkout, RUNS_DIR)
  for (const dir of await fs.list(runs)) {
    const names = await fs.list(join(runs, dir))
    if (names.includes(runCardFile(id)) || names.includes(planFile(id))) return join(runs, dir, planFile(id))
  }
  return join(runs, person, planFile(id))
}

/** Save a run's plan over the one it had, as one commit on the data branch. */
export async function writePlan(repo: string, id: string, text: string, git: GitRunner): Promise<void> {
  const person = personDir(await git(['config', 'user.email'], repo).catch(() => ''))
  const written = await withFileBranch(repo, DATA_BRANCH, `orchestration: plan of run ${id}`, async checkout => nodeBranchFileFs().write(await planPath(checkout, id, person), text))
  if (!written.ok && !written.committed) throw new Error(`the plan could not be saved: ${written.error}`)
}

/** A run's plan as it was last saved, or `undefined` when it has none. */
export async function readPlan(repo: string, id: string, git: GitRunner): Promise<string | undefined> {
  const fs = nodeBranchFileFs()
  const runs = join(await fileBranchPath(repo, DATA_BRANCH, git), RUNS_DIR)
  for (const dir of await fs.list(runs)) {
    const text = await fs.read(join(runs, dir, planFile(id))).catch(() => undefined)
    if (text !== undefined) return text
  }
  return undefined
}

/**
 * Whether the person approved this plan: the run's log, as its checkout holds it, has a prompt
 * that is the continuation of the plan's question with the answer `Approve`, word for word as
 * the runner sends an answer. A message of any other kind, a subagent's end or the person's own
 * words, begins differently and never counts.
 */
export async function planApproved(repo: string, id: string, text: string): Promise<boolean> {
  const approval = continuationPrompt(planQuestion(text), APPROVE)
  const diary = await readLiveDiary(worktreePath(repo, id), id)
  return diary.some(line => line.kind === 'start' && typeof line['prompt'] === 'string' && line['prompt'].startsWith(approval))
}
