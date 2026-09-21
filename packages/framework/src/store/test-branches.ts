import { mkdir, readFile, symlink, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { BranchesFor, BranchesSource, BranchState, Checkout } from './branches.js'

/**
 * A branches provider as a test would have it: the checkouts of every project held in memory,
 * answering what a real provider's command would. `writes` records every publish, merge and
 * remove; a remove takes the checkout out of the list, the way the command would.
 */
export function testBranches(byProject: Record<string, Checkout[]> = {}, states: BranchState[] = []): BranchesFor & { writes: string[] } {
  const writes: string[] = []
  const checkouts = new Map(Object.entries(byProject).map(([root, rows]) => [root, [...rows]]))
  const sourceFor = (root: string): BranchesSource => ({
    async list() {
      return [...(checkouts.get(root) ?? [])]
    },
    async show(branches) {
      return branches.flatMap(branch => states.filter(state => state.branch === branch))
    },
    async push(branch) {
      writes.push(`push ${branch}`)
      return { ok: true, pushed: true }
    },
    async remove(id, opts = {}) {
      writes.push(`remove ${id}${opts.discard ? ' --discard' : ''}`)
      const rows = checkouts.get(root) ?? []
      if (!rows.some(row => row.id === id)) return { ok: false, error: `no checkout for agent ${id}` }
      checkouts.set(
        root,
        rows.filter(row => row.id !== id),
      )
      return { ok: true }
    },
  })
  return Object.assign(async (root: string) => (checkouts.has(root) ? sourceFor(root) : undefined), { writes })
}

/** The name of the package whose command is the branches provider of every project a test makes real. */
const BRANCHES_PACKAGE = '@gemstack/skill-branches'

/**
 * Make the real branches package the project's provider, the way a project has it: listed as a
 * dependency in its package.json (kept, when one is there), and installed under `node_modules` as
 * a link to this workspace's copy, whose built command is what the provider runs. The package
 * lists the project's checkouts from `.branches/`, so the project must be a git repository whose
 * checkouts are real worktrees.
 */
export async function linkBranchesProvider(root: string): Promise<void> {
  const manifestPath = join(root, 'package.json')
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8').catch(() => '{}')) as Record<string, unknown>
  const devDependencies = (manifest['devDependencies'] ?? {}) as Record<string, string>
  await writeFile(manifestPath, JSON.stringify({ ...manifest, devDependencies: { ...devDependencies, [BRANCHES_PACKAGE]: '*' } }))
  const link = join(root, 'node_modules', ...BRANCHES_PACKAGE.split('/'))
  await mkdir(dirname(link), { recursive: true })
  await symlink(resolve(dirname(fileURLToPath(import.meta.resolve(BRANCHES_PACKAGE))), '..'), link).catch((err: NodeJS.ErrnoException) => {
    if (err.code !== 'EEXIST') throw err
  })
}
